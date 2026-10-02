import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { LipSyncProvider, ModelDefinition } from '../base-provider';

if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

export class SyncLabsLipSyncProvider extends LipSyncProvider {
  readonly providerName = 'SYNCLABS';

  getSupportedModels(): ModelDefinition[] {
    return [
      {
        id: 'sync-1.6.0',
        provider: 'SYNCLABS',
        displayName: 'SyncLabs 1.6 (High Precision)',
        type: 'LIPSYNC',
        channel: 'DIRECT_API',
        capabilities: { supportsLipSync: true },
        pricing: { perSecond: 0.08, currency: 'USD' },
      },
    ];
  }

  estimateCost(modelId: string, settings: any): number {
    const duration = settings?.duration || 5;
    return duration * 0.08;
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;
    if (filePath.startsWith('projects/') || filePath.startsWith('projects\\')) {
      return path.join(process.cwd(), 'data', filePath);
    }
    return path.join(process.cwd(), 'data', 'projects', filePath);
  }

  async syncLips(
    modelId: string,
    videoPath: string,
    audioPath: string,
    settings: any = {}
  ): Promise<{ providerJobId?: string; buffer?: Buffer; url?: string }> {
    const apiKey = process.env.SYNCLABS_API_KEY;

    // Check for API key vs local mock execution
    if (!apiKey) {
      console.warn('[SyncLabsLipSyncProvider] SYNCLABS_API_KEY not found. Using local FFmpeg audio-video muxing mock.');

      const absVideoPath = this.resolvePath(videoPath);
      const absAudioPath = this.resolvePath(audioPath);

      // Verify input files exist
      if (!fs.existsSync(absVideoPath)) {
        throw new Error(`Video file not found for lip sync: ${absVideoPath}`);
      }
      if (!fs.existsSync(absAudioPath)) {
        throw new Error(`Audio file not found for lip sync: ${absAudioPath}`);
      }

      // Generate a local muxed output file
      const tempOutDir = path.join(process.cwd(), 'data', 'temp');
      if (!fs.existsSync(tempOutDir)) {
        fs.mkdirSync(tempOutDir, { recursive: true });
      }

      const tempOutputFile = path.join(tempOutDir, `lipsync_${Date.now()}.mp4`);

      // Use FFmpeg to replace/mux audio track onto video
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(absVideoPath)
          .input(absAudioPath)
          .outputOptions([
            '-c:v copy',
            '-c:a aac',
            '-map 0:v:0',
            '-map 1:a:0',
            '-shortest',
          ])
          .save(tempOutputFile)
          .on('end', () => resolve())
          .on('error', (err) => {
            console.warn('[SyncLabsLipSyncProvider] Muxing error, creating mock buffer fallback:', err.message);
            // Fallback: If copy fails (e.g. dummy test file), copy the video directly
            try {
              fs.copyFileSync(absVideoPath, tempOutputFile);
              resolve();
            } catch (copyErr) {
              reject(err);
            }
          });
      });

      const buffer = fs.readFileSync(tempOutputFile);
      // Clean up temp file
      try {
        fs.unlinkSync(tempOutputFile);
      } catch {}

      return { buffer };
    }

    // Direct Cloud API implementation
    try {
      const response = await fetch('https://api.synclabs.so/lipsync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: modelId || 'sync-1.6.0',
          videoUrl: settings.videoUrl || videoPath,
          audioUrl: settings.audioUrl || audioPath,
          synergize: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SyncLabs error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      return { providerJobId: data.id };
    } catch (error: any) {
      console.error('[SyncLabsLipSyncProvider] syncLips error:', error);
      throw error;
    }
  }

  async checkStatus(
    providerJobId: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress?: number; buffer?: Buffer; url?: string; error?: string }> {
    const apiKey = process.env.SYNCLABS_API_KEY;
    if (!apiKey) {
      return { status: 'COMPLETED', progress: 1.0 };
    }

    try {
      const response = await fetch(`https://api.synclabs.so/lipsync/${providerJobId}`, {
        headers: { 'x-api-key': apiKey },
      });

      if (!response.ok) {
        throw new Error(`SyncLabs status error (${response.status})`);
      }

      const data = await response.json();
      if (data.status === 'COMPLETED') {
        return { status: 'COMPLETED', progress: 1.0, url: data.url };
      }
      if (data.status === 'FAILED') {
        return { status: 'FAILED', error: data.error || 'Lip sync failed on provider' };
      }

      return { status: 'PROCESSING', progress: 0.5 };
    } catch (error: any) {
      return { status: 'FAILED', error: error.message };
    }
  }
}
