import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import prisma from '@/lib/db/prisma';
import { resolveStoredMediaPath } from '@/lib/storage/project-storage';
import {
  RenderPlanBuilder,
  RenderPreset,
  getPresetSettings,
  escapeSubtitlePath,
  RenderPlan,
} from './render-plan-builder';
import { TimelineCompositionSchema } from '@/types/timeline';
import { probeMediaDuration } from '@/lib/media/media-probe';

if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

export type { RenderPreset };

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
    return getPresetSettings(preset);
  }

  /**
   * Escapes Windows paths for the FFmpeg subtitles filter
   */
  static escapeSubtitlePath(rawPath: string): string {
    return escapeSubtitlePath(rawPath);
  }

  /**
   * Main Orchestration for rendering the final project timeline.
   * Uses saved timeline composition when present; otherwise falls back to deterministic scenes.
   */
  static async renderProject(options: RenderOptions): Promise<string> {
    const { projectId, preset, burnSubtitles, onProgress } = options;

    const resolvers = {
      resolveMediaPath: (pId: string, relPath: string) => resolveStoredMediaPath(pId, relPath),
      fileExists: (absPath: string) => fs.existsSync(absPath),
    };

    // 1. Check for saved timeline composition first
    const savedTimelineRecord = await prisma.timeline.findUnique({
      where: { projectId },
    });

    let plan: RenderPlan;

    if (savedTimelineRecord) {
      try {
        const rawJson = JSON.parse(savedTimelineRecord.data);
        const validatedTimeline = TimelineCompositionSchema.parse(rawJson);
        plan = RenderPlanBuilder.buildFromTimeline(
          validatedTimeline,
          { projectId, preset, burnSubtitles },
          resolvers
        );
      } catch (err: any) {
        console.warn(`[FFmpegRenderer] Saved timeline invalid for ${projectId}, falling back to scenes:`, err.message);
        const scenes = await prisma.scene.findMany({
          where: { projectId },
          orderBy: { sceneNumber: 'asc' },
          include: {
            assetVersions: {
              where: { isActive: true },
            },
          },
        });
        const musicPath = path.join(process.cwd(), 'data', 'projects', projectId, 'music', 'master_music.wav');
        plan = RenderPlanBuilder.buildFromScenes(
          scenes,
          { projectId, preset, burnSubtitles, musicPath },
          resolvers
        );
      }
    } else {
      // 2. Backward compatibility fallback: render deterministically from scenes
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

      const musicPath = path.join(process.cwd(), 'data', 'projects', projectId, 'music', 'master_music.wav');
      plan = RenderPlanBuilder.buildFromScenes(
        scenes,
        { projectId, preset, burnSubtitles, musicPath },
        resolvers
      );
    }

    // 3. Prepare Output Directory
    const rendersDir = path.join(process.cwd(), 'data', 'projects', projectId, 'renders');
    if (!fs.existsSync(rendersDir)) {
      fs.mkdirSync(rendersDir, { recursive: true });
    }
    const outputFilename = `export_${preset}_${Date.now()}.mp4`;
    const outputPath = path.join(rendersDir, outputFilename);
    const relativeOutputPath = path.join('projects', projectId, 'renders', outputFilename).replace(/\\/g, '/');

    // 4. Execute FFmpeg
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Register all input files
      plan.inputFiles.forEach((file) => command.input(file));

      command
        .complexFilter(plan.filterGraph, ['vout', 'aout'])
        .outputOptions(plan.outputOptions)
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

          // Get first scene id if available
          const firstScene = await prisma.scene.findFirst({
            where: { projectId },
            orderBy: { sceneNumber: 'asc' },
            select: { id: true },
          });
          const duration = await probeMediaDuration(outputPath);

          // Save AssetVersion record
          await prisma.assetVersion.create({
            data: {
              id: `render_${Date.now()}`,
              projectId,
              sceneId: firstScene?.id || null,
              assetType: 'RENDER',
              provider: 'FFMPEG',
              modelId: preset,
              channel: 'LOCAL',
              filePath: relativeOutputPath,
              mimeType: 'video/mp4',
              duration,
              prompt: `Exported Preset: ${preset}`,
              approvalStatus: 'APPROVED',
              isActive: true,
              settings: JSON.stringify({
                width: plan.width,
                height: plan.height,
                fps: plan.fps,
                totalDuration: plan.totalDuration,
              }),
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
