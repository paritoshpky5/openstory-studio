import { TimelineComposition, TimelineClip } from '@/types/timeline';
import { AudioDuckingEngine } from '@/lib/audio/audio-ducking';
import { SubtitleGenerator, SubtitleCue } from '@/lib/subtitles/subtitle-generator';

export type RenderPreset = 'YOUTUBE_1080' | 'YOUTUBE_4K' | 'SHORTS_1080' | 'PREVIEW';

export interface PresetSettings {
  width: number;
  height: number;
  fps: number;
  videoBitrate: string;
}

export function getPresetSettings(preset: RenderPreset): PresetSettings {
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

export function escapeSubtitlePath(rawPath: string): string {
  let escaped = rawPath.replace(/\\/g, '/');
  escaped = escaped.replace(/^([a-zA-Z]):\//, '$1\\:/');
  escaped = escaped.replace(/'/g, "\\'");
  return escaped;
}

export interface VideoSegmentPlan {
  isGap: boolean;
  sourcePath?: string;
  inputIndex?: number;
  startTime: number;
  duration: number;
  trimIn: number;
}

export interface AudioSegmentPlan {
  sourcePath: string;
  inputIndex: number;
  trackType: string;
  startTime: number;
  duration: number;
  trimIn: number;
  volume: number;
}

export interface RenderPlan {
  projectId: string;
  preset: RenderPreset;
  width: number;
  height: number;
  fps: number;
  videoBitrate: string;
  burnSubtitles: boolean;
  totalDuration: number;
  inputFiles: string[];
  videoSegments: VideoSegmentPlan[];
  audioSegments: AudioSegmentPlan[];
  speechSegments: Array<{ startSeconds: number; endSeconds: number }>;
  filterGraph: string[];
  outputOptions: string[];
  subtitlePath: string | null;
}

export interface PathResolvers {
  resolveMediaPath: (projectId: string, relativePath: string) => string;
  fileExists: (absPath: string) => boolean;
}

export class RenderPlanBuilder {
  /**
   * Builds an FFmpeg render plan from a saved multi-track timeline composition.
   */
  static buildFromTimeline(
    timeline: TimelineComposition,
    options: {
      projectId: string;
      preset: RenderPreset;
      burnSubtitles: boolean;
    },
    resolvers: PathResolvers
  ): RenderPlan {
    const { projectId, preset, burnSubtitles } = options;
    const settings = getPresetSettings(preset);

    const videoTrack = timeline.tracks.find((t) => t.type === 'VIDEO' && !t.muted);
    const audioTracks = timeline.tracks.filter(
      (t) => t.type !== 'VIDEO' && t.type !== 'SUBTITLE' && !t.muted
    );
    const subtitleTrack = timeline.tracks.find((t) => t.type === 'SUBTITLE' && !t.muted);

    // 1. Process Video Track & Handle Gaps
    const rawVideoClips = videoTrack ? [...videoTrack.clips].sort((a, b) => a.startTime - b.startTime) : [];
    const validVideoClips: Array<{ clip: TimelineClip; absPath: string }> = [];

    for (const clip of rawVideoClips) {
      if (clip.muted || !clip.sourceFilePath) continue;
      const absPath = resolvers.resolveMediaPath(projectId, clip.sourceFilePath);
      if (resolvers.fileExists(absPath)) {
        validVideoClips.push({ clip, absPath });
      }
    }

    if (validVideoClips.length === 0) {
      throw new Error('No ready video assets found on the timeline to render.');
    }

    const inputFiles: string[] = [];
    const fileIndexMap = new Map<string, number>();

    const getOrAddInput = (filePath: string): number => {
      if (fileIndexMap.has(filePath)) {
        return fileIndexMap.get(filePath)!;
      }
      const idx = inputFiles.length;
      inputFiles.push(filePath);
      fileIndexMap.set(filePath, idx);
      return idx;
    };

    const videoSegments: VideoSegmentPlan[] = [];
    let currentTimelineHead = 0;

    for (let i = 0; i < validVideoClips.length; i++) {
      const { clip, absPath } = validVideoClips[i];

      // Insert black video gap if there is empty space before this clip
      if (clip.startTime > currentTimelineHead + 0.05) {
        const gapDuration = clip.startTime - currentTimelineHead;
        videoSegments.push({
          isGap: true,
          startTime: currentTimelineHead,
          duration: gapDuration,
          trimIn: 0,
        });
        currentTimelineHead = clip.startTime;
      }

      const inputIdx = getOrAddInput(absPath);
      videoSegments.push({
        isGap: false,
        sourcePath: absPath,
        inputIndex: inputIdx,
        startTime: clip.startTime,
        duration: clip.duration,
        trimIn: clip.trimIn || 0,
      });

      currentTimelineHead = clip.startTime + clip.duration;
    }

    const totalDuration = Math.max(
      timeline.totalDuration || currentTimelineHead,
      currentTimelineHead
    );

    // 2. Process Audio Tracks
    const audioSegments: AudioSegmentPlan[] = [];
    const speechSegments: Array<{ startSeconds: number; endSeconds: number }> = [];

    for (const track of audioTracks) {
      const trackVol = track.volume ?? 1.0;
      for (const clip of track.clips) {
        if (clip.muted || clip.volume <= 0 || !clip.sourceFilePath) continue;
        const absAudioPath = resolvers.resolveMediaPath(projectId, clip.sourceFilePath);
        if (!resolvers.fileExists(absAudioPath)) continue;

        const inputIdx = getOrAddInput(absAudioPath);
        const finalVol = Math.round((clip.volume ?? 1.0) * trackVol * 100) / 100;

        audioSegments.push({
          sourcePath: absAudioPath,
          inputIndex: inputIdx,
          trackType: track.type,
          startTime: clip.startTime,
          duration: clip.duration,
          trimIn: clip.trimIn || 0,
          volume: finalVol,
        });

        // Speech segments for narration / dialogue
        if (track.type === 'NARRATION' || track.type === 'DIALOGUE') {
          speechSegments.push({
            startSeconds: clip.startTime,
            endSeconds: clip.startTime + clip.duration,
          });
        }
      }
    }

    // 3. Process Subtitles
    let subtitlePath: string | null = null;
    let subtitleFilter = '';
    if (burnSubtitles) {
      const cues: SubtitleCue[] = [];
      if (subtitleTrack && subtitleTrack.clips.length > 0) {
        subtitleTrack.clips
          .filter((c) => !c.muted)
          .sort((a, b) => a.startTime - b.startTime)
          .forEach((clip, idx) => {
            const text = clip.metadata?.text || clip.label;
            if (text && text.trim()) {
              cues.push({
                index: idx + 1,
                startSeconds: clip.startTime,
                endSeconds: clip.startTime + clip.duration,
                textHindi: text.trim(),
                speakerName: clip.metadata?.speaker,
              });
            }
          });
      }

      if (cues.length > 0) {
        const { srtPath } = SubtitleGenerator.saveProjectSubtitles(projectId, cues);
        subtitlePath = srtPath;
        const escapedPath = escapeSubtitlePath(srtPath);
        const style =
          'FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=25';
        subtitleFilter = `subtitles='${escapedPath}':force_style='${style}'`;
      }
    }

    // 4. Construct Filtergraph
    const filterGraph: string[] = [];
    let concatVideoPads = '';

    videoSegments.forEach((segment, i) => {
      if (segment.isGap) {
        filterGraph.push(
          `color=c=black:s=${settings.width}x${settings.height}:d=${segment.duration.toFixed(3)},fps=${settings.fps}[v${i}]`
        );
      } else {
        const scaleFilter = `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`;
        const padFilter = `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
        filterGraph.push(
          // Image-to-video providers commonly return a five-second source for a longer
          // editorial scene. Pad the final frame so each visual segment *always* lasts
          // for its timeline duration; without this, FFmpeg's concat silently shortens
          // the film and cuts narration mid-sentence.
          `[${segment.inputIndex}:v]trim=start=${segment.trimIn.toFixed(3)}:duration=${segment.duration.toFixed(3)},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${segment.duration.toFixed(3)},trim=duration=${segment.duration.toFixed(3)},${scaleFilter},${padFilter},setsar=1,fps=${settings.fps}[v${i}]`
        );
      }
      concatVideoPads += `[v${i}]`;
    });

    filterGraph.push(
      `${concatVideoPads}concat=n=${videoSegments.length}:v=1:a=0[vout_base]`
    );

    if (subtitleFilter) {
      filterGraph.push(`[vout_base]${subtitleFilter}[vout]`);
    } else {
      filterGraph.push(`[vout_base]format=yuv420p[vout]`);
    }

    // 5. Construct Audio Filtergraph
    let concatAudioPads = '';
    const hasDucking = speechSegments.length > 0;
    const duckingFilter = hasDucking
      ? AudioDuckingEngine.buildDuckingFilterExpression(speechSegments)
      : '';

    audioSegments.forEach((segment, idx) => {
      const delayMs = Math.max(0, Math.round(segment.startTime * 1000));
      const padName = `a${idx}`;

      let clipChain = `[${segment.inputIndex}:a]atrim=start=${segment.trimIn.toFixed(3)}:duration=${segment.duration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${segment.volume.toFixed(2)}`;

      // Apply auto-ducking to music track when speech is present
      if (segment.trackType === 'MUSIC' && duckingFilter) {
        clipChain += `,${duckingFilter}`;
      }

      clipChain += `,adelay=${delayMs}|${delayMs},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[${padName}]`;
      filterGraph.push(clipChain);
      concatAudioPads += `[${padName}]`;
    });

    if (audioSegments.length > 0) {
      filterGraph.push(
        `${concatAudioPads}amix=inputs=${audioSegments.length}:duration=longest:dropout_transition=0,atrim=duration=${totalDuration.toFixed(3)}[aout]`
      );
    } else {
      // Fallback silence if no audio is present
      filterGraph.push(
        `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${totalDuration.toFixed(3)}[aout]`
      );
    }

    const outputOptions = [
      '-c:v libx264',
      '-preset fast',
      `-b:v ${settings.videoBitrate}`,
      '-pix_fmt yuv420p',
      '-c:a aac',
      '-b:a 256k',
      '-ac 2',
      '-ar 48000',
    ];

    return {
      projectId,
      preset,
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      videoBitrate: settings.videoBitrate,
      burnSubtitles,
      totalDuration,
      inputFiles,
      videoSegments,
      audioSegments,
      speechSegments,
      filterGraph,
      outputOptions,
      subtitlePath,
    };
  }

  /**
   * Backward-compatible legacy scene-sequential render plan builder.
   */
  static buildFromScenes(
    scenes: any[],
    options: {
      projectId: string;
      preset: RenderPreset;
      burnSubtitles: boolean;
      musicPath?: string | null;
    },
    resolvers: PathResolvers
  ): RenderPlan {
    const { projectId, preset, burnSubtitles, musicPath } = options;
    const settings = getPresetSettings(preset);

    const sortedScenes = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    const readyScenes = sortedScenes.filter((scene) => {
      const activeVideo =
        scene.assetVersions?.find((a: any) => a.assetType === 'LIPSYNC') ||
        scene.assetVersions?.find((a: any) => a.assetType === 'VIDEO');
      if (!activeVideo) return false;
      const absVideoPath = resolvers.resolveMediaPath(projectId, activeVideo.filePath);
      return resolvers.fileExists(absVideoPath);
    });

    if (readyScenes.length === 0) {
      throw new Error('No ready scenes with video assets found to render.');
    }

    const inputFiles: string[] = [];
    const videoInputs: Array<{ path: string; duration: number }> = [];
    const audioInputs: string[] = [];
    const speechSegments: Array<{ startSeconds: number; endSeconds: number }> = [];

    let currentTimelineSeconds = 0;

    for (const scene of readyScenes) {
      const activeDialogue = scene.assetVersions.find((a: any) => a.assetType === 'DIALOGUE');
      const activeAudio = activeDialogue ||
        scene.assetVersions.find((a: any) => a.assetType === 'NARRATION');
      const activeVideo = activeDialogue
        ? scene.assetVersions.find((a: any) => a.assetType === 'LIPSYNC') ||
          scene.assetVersions.find((a: any) => a.assetType === 'VIDEO')
        : scene.assetVersions.find((a: any) => a.assetType === 'VIDEO') ||
          scene.assetVersions.find((a: any) => a.assetType === 'LIPSYNC');

      const absVideoPath = resolvers.resolveMediaPath(projectId, activeVideo.filePath);
      // The source may only be a five-second provider take, while the planned
      // scene and its narration are longer. The visual filter pads it to this
      // editorial duration below, preserving the full spoken sentence.
      const videoDuration = Math.max(
        activeVideo.duration || 0,
        activeAudio?.duration || 0,
        scene.durationSeconds || 0
      ) || 5.0;

      videoInputs.push({ path: absVideoPath, duration: videoDuration });

      if (activeAudio) {
        const absAudioPath = resolvers.resolveMediaPath(projectId, activeAudio.filePath);
        if (resolvers.fileExists(absAudioPath)) {
          audioInputs.push(absAudioPath);
          const audioDuration = activeAudio.duration || (scene.narrationHindi ? videoDuration * 0.8 : 0);
          if (audioDuration > 0) {
            speechSegments.push({
              startSeconds: currentTimelineSeconds,
              endSeconds: currentTimelineSeconds + audioDuration,
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

    // FFmpeg input indices are addressed as every video first, followed by
    // every available audio input. Do not interleave these arrays: the filter
    // graph below intentionally starts audio indices after videoInputs.length.
    inputFiles.push(...videoInputs.map((video) => video.path));
    inputFiles.push(...audioInputs.filter((audioPath) => audioPath !== 'SILENCE'));

    // Subtitles
    let subtitlePath: string | null = null;
    let subtitleFilter = '';
    if (burnSubtitles) {
      const cues = SubtitleGenerator.buildCuesFromScenes(readyScenes);
      if (cues.length > 0) {
        const { srtPath } = SubtitleGenerator.saveProjectSubtitles(projectId, cues);
        subtitlePath = srtPath;
        const escapedPath = escapeSubtitlePath(srtPath);
        const style =
          'FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=25';
        subtitleFilter = `subtitles='${escapedPath}':force_style='${style}'`;
      }
    }

    // Music ducking
    const hasMusic = Boolean(musicPath && resolvers.fileExists(musicPath));
    let duckingFilter = '';
    if (hasMusic) {
      duckingFilter = AudioDuckingEngine.buildDuckingFilterExpression(speechSegments);
    }

    const filterGraph: string[] = [];
    let concatVideoInputs = '';
    let concatAudioInputs = '';
    let audioInputIndexOffset = videoInputs.length;

    videoInputs.forEach((videoConfig, index) => {
      const scaleFilter = `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`;
      const padFilter = `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
      filterGraph.push(
        `[${index}:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${videoConfig.duration.toFixed(3)},trim=duration=${videoConfig.duration.toFixed(3)},${scaleFilter},${padFilter},setsar=1,fps=${settings.fps}[v${index}]`
      );
      concatVideoInputs += `[v${index}]`;

      const audioPath = audioInputs[index];
      if (audioPath === 'SILENCE') {
        const duration = videoConfig.duration;
        filterGraph.push(`anullsrc=channel_layout=stereo:sample_rate=48000[a${index}_pre]`);
        filterGraph.push(`[a${index}_pre]atrim=duration=${duration}[a${index}]`);
        concatAudioInputs += `[a${index}]`;
      } else {
        const duration = videoConfig.duration;
        filterGraph.push(
          `[${audioInputIndexOffset}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${duration}[a${index}]`
        );
        concatAudioInputs += `[a${index}]`;
        audioInputIndexOffset++;
      }
    });

    filterGraph.push(`${concatVideoInputs}concat=n=${videoInputs.length}:v=1:a=0[vout_base]`);
    filterGraph.push(`${concatAudioInputs}concat=n=${videoInputs.length}:v=0:a=1[aout_base]`);

    if (subtitleFilter) {
      filterGraph.push(`[vout_base]${subtitleFilter}[vout]`);
    } else {
      filterGraph.push(`[vout_base]format=yuv420p[vout]`);
    }

    let finalAudioPad = 'aout_base';
    if (hasMusic && musicPath) {
      const musicIndex = inputFiles.length;
      inputFiles.push(musicPath);
      filterGraph.push(`[${musicIndex}:a]${duckingFilter}[music_ducked]`);
      filterGraph.push(`[aout_base][music_ducked]amix=inputs=2:duration=first[aout_mixed]`);
      finalAudioPad = 'aout_mixed';
    }

    // Rename pad to standard [aout]
    if (finalAudioPad !== 'aout') {
      filterGraph.push(`[${finalAudioPad}]anull[aout]`);
    }

    const outputOptions = [
      '-c:v libx264',
      '-preset fast',
      `-b:v ${settings.videoBitrate}`,
      '-pix_fmt yuv420p',
      '-c:a aac',
      '-b:a 256k',
      '-ac 2',
      '-ar 48000',
    ];

    return {
      projectId,
      preset,
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      videoBitrate: settings.videoBitrate,
      burnSubtitles,
      totalDuration: currentTimelineSeconds,
      inputFiles,
      videoSegments: videoInputs.map((v, i) => ({
        isGap: false,
        sourcePath: v.path,
        inputIndex: i,
        startTime: 0,
        duration: v.duration,
        trimIn: 0,
      })),
      audioSegments: [],
      speechSegments,
      filterGraph,
      outputOptions,
      subtitlePath,
    };
  }
}
