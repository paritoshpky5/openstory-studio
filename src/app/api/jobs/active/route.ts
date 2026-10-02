import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET() {
  try {
    const activeJobs = await prisma.generationJob.findMany({
      where: {
        status: { in: ['PENDING', 'SUBMITTED', 'PROCESSING'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        scene: {
          select: { sceneNumber: true, title: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      jobs: activeJobs,
    });
  } catch (error: any) {
    console.error('[API active-jobs] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch active jobs' },
      { status: 500 }
    );
  }
}
