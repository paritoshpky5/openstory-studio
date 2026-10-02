import { NextRequest, NextResponse } from 'next/server';
import { VideoJobOrchestrator } from '@/lib/services/video-job-orchestrator';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const jobId = params.id;
    const job = await VideoJobOrchestrator.checkJobStatus(jobId);

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error(`[API job-status] Error fetching job ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check job status' },
      { status: 500 }
    );
  }
}
