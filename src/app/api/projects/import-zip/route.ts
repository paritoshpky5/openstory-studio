import { NextRequest, NextResponse } from 'next/server';
import { ProjectArchiveService } from '@/lib/services/project-archive-service';

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
