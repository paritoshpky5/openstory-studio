import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDataRootDir } from '@/lib/storage/project-storage';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.srt': 'text/plain',
  '.vtt': 'text/vtt',
  '.json': 'application/json',
};

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  try {
    const requestedSegments = params.path;
    if (!requestedSegments || requestedSegments.length === 0) {
      return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
    }

    // Security check: prevent directory traversal
    for (const segment of requestedSegments) {
      if (segment === '..' || segment.includes('/') || segment.includes('\\')) {
        return NextResponse.json({ error: 'Invalid path traversal' }, { status: 400 });
      }
    }

    const dataRootDir = getDataRootDir();
    let filePath = path.join(dataRootDir, ...requestedSegments);
    let normalizedTarget = path.normalize(filePath);

    // If the file doesn't exist at root (e.g. data/images/foo.png) and it's missing the "projects" prefix,
    // this is a legacy/project-relative path. We dynamically locate which project it belongs to.
    if (!fs.existsSync(normalizedTarget) && requestedSegments[0] !== 'projects') {
      const projectsDir = path.join(dataRootDir, 'projects');
      if (fs.existsSync(projectsDir)) {
        const projectDirs = fs.readdirSync(projectsDir);
        for (const pid of projectDirs) {
          const possiblePath = path.join(projectsDir, pid, ...requestedSegments);
          if (fs.existsSync(possiblePath)) {
            normalizedTarget = path.normalize(possiblePath);
            break;
          }
        }
      }
    }

    // Verify file stays within dataRootDir
    if (!normalizedTarget.startsWith(path.normalize(dataRootDir))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!fs.existsSync(normalizedTarget)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stats = await fs.promises.stat(normalizedTarget);
    if (stats.isDirectory()) {
      return NextResponse.json({ error: 'Cannot stream directory' }, { status: 400 });
    }

    const ext = path.extname(normalizedTarget).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    const fileStream = fs.createReadStream(normalizedTarget);
    // Convert Node ReadStream to Web ReadableStream
    const readable = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new NextResponse(readable, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Error serving media file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
