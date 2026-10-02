import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BenchmarkService } from '@/lib/services/benchmark-service';
import { JobType } from '@/schemas/job.schema';

const runBenchmarkSchema = z.object({
  projectId: z.string(),
  jobType: z.enum(['IMAGE', 'VIDEO', 'AUDIO']),
  prompt: z.string(),
  settings: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = runBenchmarkSchema.parse(body);

    const session = await BenchmarkService.startBlindBenchmark(
      validated.projectId,
      validated.jobType as JobType,
      validated.prompt,
      validated.settings
    );

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error('Error running benchmark:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
