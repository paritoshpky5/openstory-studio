import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

if (ffprobeInstaller?.path) {
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
}

/** Returns a container duration in seconds, or null for unreadable media. */
export function probeMediaDuration(filePath: string): Promise<number | null> {
  if (!fs.existsSync(filePath)) return Promise.resolve(null);

  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) return resolve(null);
      const duration = Number(metadata.format.duration);
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
    });
  });
}
