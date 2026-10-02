import path from 'path';

export type UploadCategory = 'image' | 'video' | 'audio';

export interface DetectedMedia {
  category: UploadCategory;
  extension: string;
  mimeType: string;
}

export const MAX_UPLOAD_BYTES: Record<UploadCategory, number> = {
  image: 25 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  video: 500 * 1024 * 1024,
};

function ascii(buffer: Buffer, start: number, length: number): string {
  return buffer.subarray(start, start + length).toString('ascii');
}

export function detectMedia(buffer: Buffer): DetectedMedia | null {
  if (buffer.length >= 12 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { category: 'image', extension: 'png', mimeType: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { category: 'image', extension: 'jpg', mimeType: 'image/jpeg' };
  }
  if (buffer.length >= 12 && ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') {
    return { category: 'image', extension: 'webp', mimeType: 'image/webp' };
  }
  if (buffer.length >= 6 && (ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a')) {
    return { category: 'image', extension: 'gif', mimeType: 'image/gif' };
  }
  if (buffer.length >= 12 && ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WAVE') {
    return { category: 'audio', extension: 'wav', mimeType: 'audio/wav' };
  }
  if (buffer.length >= 4 && ascii(buffer, 0, 4) === 'OggS') {
    return { category: 'audio', extension: 'ogg', mimeType: 'audio/ogg' };
  }
  if (buffer.length >= 3 && ascii(buffer, 0, 3) === 'ID3') {
    return { category: 'audio', extension: 'mp3', mimeType: 'audio/mpeg' };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { category: 'audio', extension: 'mp3', mimeType: 'audio/mpeg' };
  }
  if (buffer.length >= 12 && ascii(buffer, 4, 4) === 'ftyp') {
    const brand = ascii(buffer, 8, 4).toLowerCase();
    if (brand.includes('m4a')) {
      return { category: 'audio', extension: 'm4a', mimeType: 'audio/mp4' };
    }
    const extension = brand === 'qt  ' ? 'mov' : 'mp4';
    return { category: 'video', extension, mimeType: extension === 'mov' ? 'video/quicktime' : 'video/mp4' };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { category: 'video', extension: 'webm', mimeType: 'video/webm' };
  }
  return null;
}

export function expectedUploadCategory(assetType: string): UploadCategory {
  if (assetType === 'VIDEO' || assetType === 'LIPSYNC') return 'video';
  if (['NARRATION', 'DIALOGUE', 'MUSIC', 'SFX', 'AMBIENCE'].includes(assetType)) return 'audio';
  return 'image';
}

export function sanitizeOriginalFilename(filename: string): string {
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}
