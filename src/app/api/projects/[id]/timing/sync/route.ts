import { NextRequest, NextResponse } from 'next/server';
import { projectBoundaryStatus, requireProject } from '@/lib/security/project-boundary';
import { syncProjectTimingToSpeech } from '@/lib/services/audio-timing-service';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  try {
    await requireProject(projectId);
    const scenes = await syncProjectTimingToSpeech(projectId);
    return NextResponse.json({ success: true, scenes });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to synchronize audio timing.' },
      { status: projectBoundaryStatus(error) }
    );
  }
}
