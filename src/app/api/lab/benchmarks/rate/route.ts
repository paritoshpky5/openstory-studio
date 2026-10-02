import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BenchmarkService } from '@/lib/services/benchmark-service';

const rateBenchmarkSchema = z.object({
  ratings: z.array(
    z.object({
      assetId: z.string(),
      rating: z.number().min(1).max(5),
      approved: z.boolean(),
      rejectionReasons: z.array(z.string()).optional(),
    })
  )
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = rateBenchmarkSchema.parse(body);

    const result = await BenchmarkService.submitBlindRatings(validated.ratings);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error submitting benchmark ratings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
