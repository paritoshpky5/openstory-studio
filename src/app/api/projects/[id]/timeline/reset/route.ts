import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { buildDefaultTimeline } from '@/lib/timeline/timeline-builder';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const projectId = params.id;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        scenes: {
          orderBy: { sceneNumber: 'asc' },
          include: {
            shots: { orderBy: { shotNumber: 'asc' } },
            assetVersions: true,
          },
        },
        assetVersions: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const defaultTimeline = buildDefaultTimeline(project);

    const saved = await prisma.timeline.upsert({
      where: { projectId },
      create: {
        projectId,
        version: 1,
        data: JSON.stringify(defaultTimeline),
      },
      update: {
        version: 1,
        data: JSON.stringify(defaultTimeline),
      },
    });

    return NextResponse.json({
      success: true,
      timeline: JSON.parse(saved.data),
    });
  } catch (error: any) {
    console.error('Error resetting timeline:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
