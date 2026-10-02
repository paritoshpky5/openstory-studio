import { NextRequest, NextResponse } from 'next/server';
import { MAX_ARCHIVE_COMPRESSED_BYTES, ProjectArchiveService } from '@/lib/services/project-archive-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No zip file provided in request.' },
        { status: 400 }
      );
    }
    if (!file.name.toLowerCase().endsWith('.zip') || file.size <= 0 || file.size > MAX_ARCHIVE_COMPRESSED_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Upload a non-empty .zip file no larger than 250 MB.' },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    const result = await ProjectArchiveService.importProjectZip(zipBuffer);

    return NextResponse.json({
      success: true,
      projectId: result.projectId,
      name: result.name,
      message: 'Whole project successfully imported and restored!',
    });
  } catch (error: any) {
    console.error('[Import ZIP API] Error importing project archive:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to import project archive' },
      { status: 500 }
    );
  }
}
