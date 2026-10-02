import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

export interface SpeechSegment {
  startSeconds: number;
  endSeconds: number;
  speakerId?: string;
  text?: string;
}

export interface DuckingOptions {
  normalGain?: number; // e.g. 1.0 (0dB)
  duckedGain?: number; // e.g. 0.20 (-14dB)
  fadeMarginSeconds?: number; // e.g. 0.2s margin around speech
}

export class AudioDuckingEngine {
  /**
   * Generates a deterministic FFmpeg volume filter expression that ducks background music
   * during dialogue and narration intervals.
   */
  static buildDuckingFilterExpression(
    segments: SpeechSegment[],
    options: DuckingOptions = {}
  ): string {
    const normal = options.normalGain ?? 1.0;
    const ducked = options.duckedGain ?? 0.22; // ~ -13 dB
    const margin = options.fadeMarginSeconds ?? 0.15;

    if (!segments || segments.length === 0) {
      return `volume=${normal}`;
    }

    // Combine overlapping or contiguous intervals
    const sorted = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);
    const merged: { start: number; end: number }[] = [];

    for (const seg of sorted) {
      const start = Math.max(0, seg.startSeconds - margin);
      const end = seg.endSeconds + margin;

      if (merged.length === 0) {
        merged.push({ start, end });
      } else {
        const last = merged[merged.length - 1];
        if (start <= last.end) {
          last.end = Math.max(last.end, end);
        } else {
          merged.push({ start, end });
        }
      }
    }

    // Build chained if conditions: if(between(t, s1, e1)+between(t, s2, e2), ducked, normal)
    const betweenChecks = merged
      .map((m) => `between(t,${m.start.toFixed(2)},${m.end.toFixed(2)})`)
      .join('+');

    return `volume='if(${betweenChecks},${ducked},${normal})':eval=frame`;
  }

  /**
   * Applies volume ducking to a background music file given speech time intervals
   */
  static async applyDucking(
    musicPath: string,
    outputPath: string,
    speechSegments: SpeechSegment[],
    options: DuckingOptions = {}
  ): Promise<string> {
    if (!fs.existsSync(musicPath)) {
      throw new Error(`Music file not found: ${musicPath}`);
    }

    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const volumeFilter = this.buildDuckingFilterExpression(speechSegments, options);

    return new Promise((resolve, reject) => {
      ffmpeg(musicPath)
        .audioFilters([volumeFilter])
        .audioCodec('pcm_s16le')
        .format('wav')
        .save(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => {
          console.error('[AudioDuckingEngine] FFmpeg error:', err);
          // Fallback: Copy original music without ducking
          try {
            fs.copyFileSync(musicPath, outputPath);
            resolve(outputPath);
          } catch (copyErr) {
            reject(err);
          }
        });
    });
  }
}
