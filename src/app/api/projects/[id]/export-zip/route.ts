import { NextRequest, NextResponse } from 'next/server';
import { ProjectArchiveService } from '@/lib/services/project-archive-service';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const projectId = params.id;
    const { zipBuffer, filename } = await ProjectArchiveService.exportProjectZip(projectId);

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[Export ZIP API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to export project archive' },
      { status: 500 }
    );
  }
}
