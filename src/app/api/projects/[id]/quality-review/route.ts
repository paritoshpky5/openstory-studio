import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProject, projectBoundaryStatus } from '@/lib/security/project-boundary';
import {
  loadLatestAIDirectorReport,
  QualityReviewProviderSchema,
  runAIDirectorReview,
} from '@/lib/quality/ai-director';

const requestSchema = z.object({
  provider: QualityReviewProviderSchema.default('AUTO'),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  try {
    await requireProject(projectId);
    return NextResponse.json({
      success: true,
      report: loadLatestAIDirectorReport(projectId),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load quality report.' },
      { status: projectBoundaryStatus(error) }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  try {
    await requireProject(projectId);
    const { provider } = requestSchema.parse(await request.json());
    const report = await runAIDirectorReview(projectId, provider);
    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    const status = error instanceof z.ZodError ? 400 : projectBoundaryStatus(error);
    return NextResponse.json(
      { success: false, error: error.message || 'AI Director review failed.' },
      { status }
    );
  }
}
