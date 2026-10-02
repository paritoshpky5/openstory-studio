import path from 'path';
import { describe, expect, it } from 'vitest';
import { detectMedia, expectedUploadCategory } from '../media-upload';
import {
  mediaRelativePath,
  normalizedEntryName,
  resolveArchiveDestination,
} from '@/lib/services/project-archive-service';

describe('archive path safety', () => {
  it('accepts an exported media path and keeps it under the project root', () => {
    expect(mediaRelativePath('media/images/frame.png')).toBe('images/frame.png');
    const root = path.resolve('data/projects/example');
    expect(resolveArchiveDestination(root, 'images/frame.png')).toBe(path.join(root, 'images', 'frame.png'));
  });

  it.each([
    'media/images/../../../../.env',
    '../media/images/frame.png',
    '/media/images/frame.png',
    'C:/media/images/frame.png',
  ])('rejects unsafe archive name %s', (entryName) => {
    expect(() => normalizedEntryName(entryName)).toThrow(/Unsafe path/);
  });
});

describe('uploaded media signatures', () => {
  it('detects PNG bytes independently of the filename or declared MIME type', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectMedia(png)).toEqual({ category: 'image', extension: 'png', mimeType: 'image/png' });
  });

  it('does not accept arbitrary bytes as media', () => {
    expect(detectMedia(Buffer.from('not media'))).toBeNull();
    expect(expectedUploadCategory('VIDEO')).toBe('video');
    expect(expectedUploadCategory('NARRATION')).toBe('audio');
  });
});
