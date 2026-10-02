import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { VideoJobOrchestrator } from '@/lib/services/video-job-orchestrator';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'FAILED') {
      return NextResponse.json(
        { success: false, error: 'Only FAILED jobs can be manually retried' },
        { status: 400 }
      );
    }

    // Reset retry count and mark as PENDING to bypass strict protection
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        retryCount: 0,
        errorMessage: null,
      },
    });

    // We can resubmit the job directly using the stored payload
    if (job.jobType === 'VIDEO') {
      const payload = JSON.parse(job.requestPayload);
      const resubmittedJob = await VideoJobOrchestrator.submitVideoJob({
        projectId: payload.projectId,
        sceneId: payload.sceneId,
        prompt: payload.prompt,
        imageReferencePath: payload.settings?.imageReferencePath,
        provider: payload.provider,
        modelId: payload.modelId,
        settings: payload.settings,
        forceRegeneration: true, // Force new execution
      });
      return NextResponse.json({ success: true, job: resubmittedJob });
    }

    return NextResponse.json({ success: true, message: 'Job reset to PENDING' });
  } catch (error: any) {
    console.error(`[API retry-job] Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retry job' },
      { status: 500 }
    );
  }
}
