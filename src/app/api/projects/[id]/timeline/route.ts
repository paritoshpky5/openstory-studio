import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { TimelineCompositionSchema, TimelineComposition } from '@/types/timeline';
import { buildDefaultTimeline } from '@/lib/timeline/timeline-builder';

export async function GET(
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

    const savedTimeline = await prisma.timeline.findUnique({
      where: { projectId },
    });

    if (savedTimeline) {
      try {
        const parsed = JSON.parse(savedTimeline.data);
        const validated = TimelineCompositionSchema.parse(parsed);
        return NextResponse.json(
          { success: true, timeline: validated, isDefault: false },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      } catch (parseError: any) {
        console.warn(`Saved timeline corrupt for ${projectId}, regenerating default:`, parseError.message);
      }
    }

    // Generate deterministic default timeline
    const defaultTimeline = buildDefaultTimeline(project);

    return NextResponse.json(
      { success: true, timeline: defaultTimeline, isDefault: true },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const projectId = params.id;

  try {
    const body = await request.json();
    const validated: TimelineComposition = TimelineCompositionSchema.parse(body);

    if (validated.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: 'Timeline projectId does not match URL project ID' },
        { status: 400 }
      );
    }

    // Verify project boundaries
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        scenes: {
          include: {
            shots: true,
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

    const validSceneIds = new Set(project.scenes.map((s) => s.id));
    const validShotIds = new Set(project.scenes.flatMap((s) => s.shots.map((sh) => sh.id)));
    const validAssetIds = new Set([
      ...project.assetVersions.map((a) => a.id),
      ...project.scenes.flatMap((s) => s.assetVersions.map((a) => a.id)),
    ]);

    // Validate referenced clips
    for (const track of validated.tracks) {
      for (const clip of track.clips) {
        if (clip.sceneId && !validSceneIds.has(clip.sceneId)) {
          return NextResponse.json(
            { success: false, error: `Invalid scene reference: ${clip.sceneId}` },
            { status: 400 }
          );
        }
        if (clip.shotId && !validShotIds.has(clip.shotId)) {
          return NextResponse.json(
            { success: false, error: `Invalid shot reference: ${clip.shotId}` },
            { status: 400 }
          );
        }
        if (clip.assetVersionId && !validAssetIds.has(clip.assetVersionId)) {
          return NextResponse.json(
            { success: false, error: `Invalid asset reference: ${clip.assetVersionId}` },
            { status: 400 }
          );
        }

        // Validate source file path security
        if (clip.sourceFilePath) {
          const norm = clip.sourceFilePath.replace(/\\/g, '/');
          if (
            norm.includes('\0') ||
            norm.startsWith('/') ||
            /^[a-zA-Z]:/.test(norm) ||
            norm.split('/').some((part) => part === '..')
          ) {
            return NextResponse.json(
              { success: false, error: `Unsafe path in timeline clip: ${clip.sourceFilePath}` },
              { status: 400 }
            );
          }

          // If path has projects prefix, ensure it belongs to this project
          if (norm.startsWith('projects/') && !norm.startsWith(`projects/${projectId}/`)) {
            return NextResponse.json(
              { success: false, error: `Path escapes project boundaries: ${clip.sourceFilePath}` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Persist to database
    const saved = await prisma.timeline.upsert({
      where: { projectId },
      create: {
        projectId,
        version: validated.version || 1,
        data: JSON.stringify(validated),
      },
      update: {
        version: validated.version || 1,
        data: JSON.stringify(validated),
      },
    });

    return NextResponse.json({
      success: true,
      timeline: JSON.parse(saved.data),
    });
  } catch (error: any) {
    console.error('Error saving timeline:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation or persistence error' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const projectId = params.id;

  try {
    await prisma.timeline.deleteMany({
      where: { projectId },
    });

    return NextResponse.json({
      success: true,
      message: 'Timeline deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
