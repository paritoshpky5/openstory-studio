import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import prisma from '@/lib/db/prisma';
import { SubtitleGenerator } from '@/lib/subtitles/subtitle-generator';
import { AudioDuckingEngine } from '@/lib/audio/audio-ducking';
import { SoundDesignService } from '@/lib/audio/sound-design-service';

if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

export type RenderPreset = 'YOUTUBE_1080' | 'YOUTUBE_4K' | 'SHORTS_1080' | 'PREVIEW';

export interface RenderOptions {
  projectId: string;
  preset: RenderPreset;
  burnSubtitles: boolean;
  onProgress?: (percent: number) => void;
}

export class FFmpegRenderer {
  /**
   * Retrieves preset resolution and formatting settings
   */
  static getPresetSettings(preset: RenderPreset) {
    switch (preset) {
      case 'YOUTUBE_4K':
        return { width: 3840, height: 2160, fps: 30, videoBitrate: '45000k' };
      case 'SHORTS_1080':
        return { width: 1080, height: 1920, fps: 30, videoBitrate: '8000k' };
      case 'PREVIEW':
        return { width: 854, height: 480, fps: 24, videoBitrate: '1500k' };
      case 'YOUTUBE_1080':
      default:
        return { width: 1920, height: 1080, fps: 30, videoBitrate: '8000k' };
    }
  }

  /**
   * Escapes Windows paths for the FFmpeg subtitles filter
   * C:\path\to\file.srt -> C\:\\path\\to\\file.srt
   */
  static escapeSubtitlePath(rawPath: string): string {
    // 1. Replace backslashes with forward slashes (FFmpeg prefers this)
    let escaped = rawPath.replace(/\\/g, '/');
    // 2. Escape the colon in the drive letter (e.g. C:/ -> C\:/)
    escaped = escaped.replace(/^([a-zA-Z]):\//, '$1\\:/');
    // 3. Escape single quotes if any
    escaped = escaped.replace(/'/g, "\\'");
    return escaped;
  }

  /**
   * Main Orchestration for rendering the final project timeline
   */
  static async renderProject(options: RenderOptions): Promise<string> {
    const { projectId, preset, burnSubtitles, onProgress } = options;
    const settings = this.getPresetSettings(preset);
    
    // 1. Fetch Timeline Assets
    const scenes = await prisma.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: 'asc' },
      include: {
        assetVersions: {
          where: { isActive: true },
        },
      },
    });

    if (!scenes || scenes.length === 0) {
      throw new Error('Project has no scenes to render.');
    }

    const { resolveStoredMediaPath } = await import('@/lib/storage/project-storage');

    // 1. Filter Timeline to Ready Assets Only
    const readyScenes = scenes.filter(scene => {
      const activeVideo = scene.assetVersions.find(a => a.assetType === 'LIPSYNC') 
                       || scene.assetVersions.find(a => a.assetType === 'VIDEO');
      if (!activeVideo) return false;
      const absVideoPath = resolveStoredMediaPath(projectId, activeVideo.filePath);
      return fs.existsSync(absVideoPath);
    });

    if (readyScenes.length === 0) {
      throw new Error('No ready scenes with video assets found to render.');
    }

    const videoInputs: Array<{ path: string; duration: number }> = [];
    const audioInputs: string[] = [];
    const speechSegments: Array<{startSeconds: number; endSeconds: number}> = [];

    let currentTimelineSeconds = 0;

    // Identify active video and audio for each scene
    for (const scene of readyScenes) {
      const activeVideo = scene.assetVersions.find(a => a.assetType === 'LIPSYNC') 
                       || scene.assetVersions.find(a => a.assetType === 'VIDEO');
      
      const activeAudio = scene.assetVersions.find(a => a.assetType === 'DIALOGUE')
                       || scene.assetVersions.find(a => a.assetType === 'NARRATION');
      
      const absVideoPath = resolveStoredMediaPath(projectId, activeVideo!.filePath);
      const videoDuration = activeVideo!.duration || scene.durationSeconds || 5.0;
      
      videoInputs.push({ 
        path: absVideoPath, 
        duration: videoDuration 
      });

      if (activeAudio) {
        const absAudioPath = resolveStoredMediaPath(projectId, activeAudio.filePath);
        if (fs.existsSync(absAudioPath)) {
          audioInputs.push(absAudioPath);
          const audioDuration = activeAudio.duration || (scene.narrationHindi ? videoDuration * 0.8 : 0);
          if (audioDuration > 0) {
            speechSegments.push({
              startSeconds: currentTimelineSeconds,
              endSeconds: currentTimelineSeconds + audioDuration
            });
          }
        } else {
          audioInputs.push('SILENCE');
        }
      } else {
        audioInputs.push('SILENCE');
      }

      currentTimelineSeconds += videoDuration;
    }

    // 2. Prepare Output Directory
    const rendersDir = path.join(process.cwd(), 'data', 'projects', projectId, 'renders');
    if (!fs.existsSync(rendersDir)) {
      fs.mkdirSync(rendersDir, { recursive: true });
    }
    const outputFilename = `export_${preset}_${Date.now()}.mp4`;
    const outputPath = path.join(rendersDir, outputFilename);
    const relativeOutputPath = path.join('projects', projectId, 'renders', outputFilename).replace(/\\/g, '/');

    // 3. Prepare Subtitles
    let subtitleFilter = '';
    if (burnSubtitles) {
      const cues = SubtitleGenerator.buildCuesFromScenes(readyScenes);
      if (cues.length > 0) {
        const { srtPath } = SubtitleGenerator.saveProjectSubtitles(projectId, cues);
        const escapedPath = this.escapeSubtitlePath(srtPath);
        const style = "FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=25";
        subtitleFilter = `subtitles='${escapedPath}':force_style='${style}'`;
      }
    }

    // 4. Background Music Ducking
    const musicPath = path.join(process.cwd(), 'data', 'projects', projectId, 'music', 'master_music.wav');
    const hasMusic = fs.existsSync(musicPath);
    let duckingFilter = '';
    
    if (hasMusic) {
      duckingFilter = AudioDuckingEngine.buildDuckingFilterExpression(speechSegments);
    }

    // 5. Build Filtergraph
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all video inputs
      videoInputs.forEach(input => command.input(input.path));

      // Add audio inputs (if not silent)
      let currentInputIndex = videoInputs.length;
      audioInputs.forEach(audioPath => {
        if (audioPath !== 'SILENCE') {
          command.input(audioPath);
          currentInputIndex++;
        }
      });
      
      // Build complex filter array
      const filterGraph: string[] = [];
      let concatVideoInputs = '';
      let concatAudioInputs = '';
      
      let audioInputIndexOffset = videoInputs.length;

      videoInputs.forEach((videoConfig, index) => {
        // Video processing
        const scaleFilter = `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`;
        const padFilter = `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
        
        filterGraph.push(`[${index}:v]${scaleFilter},${padFilter},setsar=1,fps=${settings.fps}[v${index}]`);
        concatVideoInputs += `[v${index}]`;

        // Audio processing
        const audioPath = audioInputs[index];
        if (audioPath === 'SILENCE') {
          const duration = videoConfig.duration;
          filterGraph.push(`anullsrc=channel_layout=stereo:sample_rate=48000[a${index}_pre]`);
          filterGraph.push(`[a${index}_pre]atrim=duration=${duration}[a${index}]`);
          concatAudioInputs += `[a${index}]`;
        } else {
          const duration = videoConfig.duration;
          // apad pads with silence if the audio is shorter than the video.
          // atrim cuts it if it is longer. This guarantees perfect sync across the concatenated timeline.
          filterGraph.push(`[${audioInputIndexOffset}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${duration}[a${index}]`);
          concatAudioInputs += `[a${index}]`;
          audioInputIndexOffset++;
        }
      });

      // Concat videos and audio
      filterGraph.push(`${concatVideoInputs}concat=n=${videoInputs.length}:v=1:a=0[vout_base]`);
      filterGraph.push(`${concatAudioInputs}concat=n=${videoInputs.length}:v=0:a=1[aout_base]`);

      // Apply Subtitles if requested
      if (subtitleFilter) {
        filterGraph.push(`[vout_base]${subtitleFilter}[vout]`);
      } else {
        filterGraph.push(`[vout_base]format=yuv420p[vout]`);
      }

      let finalAudioPad = 'aout_base';
      if (hasMusic) {
        command.input(musicPath);
        const musicIndex = currentInputIndex;
        filterGraph.push(`[${musicIndex}:a]${duckingFilter}[music_ducked]`);
        filterGraph.push(`[aout_base][music_ducked]amix=inputs=2:duration=first[aout_mixed]`);
        finalAudioPad = 'aout_mixed';
      }

      command
        .complexFilter(filterGraph, ['vout', finalAudioPad])
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          `-b:v ${settings.videoBitrate}`,
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 256k',
          '-ac 2',
          '-ar 48000',
        ])
        .save(outputPath)
        .on('start', (cmdLine) => {
          console.log('[FFmpegRenderer] Spawned FFmpeg with command:', cmdLine);
        })
        .on('progress', (progress) => {
          if (progress.percent && onProgress) {
            onProgress(Math.min(99, progress.percent));
          }
        })
        .on('end', async () => {
          if (onProgress) onProgress(100);
          
          // Save AssetVersion record
          await prisma.assetVersion.create({
            data: {
              id: `render_${Date.now()}`,
              projectId,
              sceneId: scenes[0].id, // Master asset linked to first scene or project
              assetType: 'RENDER',
              provider: 'FFMPEG',
              modelId: preset,
              channel: 'LOCAL',
              filePath: relativeOutputPath,
              mimeType: 'video/mp4',
              prompt: `Exported Preset: ${preset}`,
              approvalStatus: 'APPROVED',
              isActive: true,
              settings: '{}',
            },
          });

          resolve(relativeOutputPath);
        })
        .on('error', (err) => {
          console.error('[FFmpegRenderer] Error rendering project:', err);
          reject(err);
        });
    });
  }
}



