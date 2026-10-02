import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { VideoJobOrchestrator } from '@/lib/services/video-job-orchestrator';
import { projectBoundaryStatus, requireProjectAsset, requireProjectScene } from '@/lib/security/project-boundary';

const generateVideoSchema = z.object({
  sceneId: z.string(),
  imageAssetId: z.string().optional(),
  provider: z.string().optional().default('KLING'),
  modelId: z.string().optional().default('kling-v1'),
  motionPrompt: z.string().optional(),
  cameraAngle: z.string().optional(),
  cameraMovement: z.string().optional(),
  motionPreset: z.string().optional(),
  durationSeconds: z.number().optional().default(5),
  forceRegeneration: z.boolean().optional(),
});

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const projectId = params.id;
    const body = await request.json();
    const validated = generateVideoSchema.parse(body);

    // 1. Fetch Scene and verify its status
    await requireProjectScene(projectId, validated.sceneId);
    const scene = await prisma.scene.findFirst({
      where: { id: validated.sceneId, projectId },
      include: {
        assetVersions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!scene) {
      return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    // 2. Identify the Reference Image to Animate
    let referenceImagePath = '';

    if (validated.imageAssetId) {
      const explicitAsset = await requireProjectAsset(projectId, validated.imageAssetId);
      if (explicitAsset.sceneId !== validated.sceneId) {
        return NextResponse.json({ success: false, error: 'Image asset does not belong to the selected scene' }, { status: 400 });
      }
      if (!['PRODUCTION_IMAGE', 'STORYBOARD'].includes(explicitAsset.assetType)) {
        return NextResponse.json({ success: false, error: 'Selected asset is not an image frame' }, { status: 400 });
      }
      referenceImagePath = explicitAsset.filePath;
    }

    if (!referenceImagePath) {
      // Find the active approved PRODUCTION_IMAGE or STORYBOARD
      const approvedFrame = scene.assetVersions.find(
        (a) => a.isActive && (a.assetType === 'PRODUCTION_IMAGE' || a.assetType === 'STORYBOARD')
      ) || scene.assetVersions.find(
        (a) => a.approvalStatus === 'APPROVED' && (a.assetType === 'PRODUCTION_IMAGE' || a.assetType === 'STORYBOARD')
      );

      if (!approvedFrame) {
        return NextResponse.json(
          {
            success: false,
            error:
              'No approved frame found for this scene. OpenStory Studio enforces image-to-video workflow: generate and approve a production frame before animating.',
          },
          { status: 400 }
        );
      }

      referenceImagePath = approvedFrame.filePath;
    }

    // 3. Compile Motion Prompt
    const motionDirectives: string[] = [];
    if (validated.motionPrompt) {
      motionDirectives.push(validated.motionPrompt);
    } else {
      if (scene.cameraMovement) motionDirectives.push(`Camera movement: ${scene.cameraMovement}`);
      if (scene.motionPreset) motionDirectives.push(`Character motion: ${scene.motionPreset}`);
      if (scene.summary) motionDirectives.push(`Action: ${scene.summary}`);
    }
    const compiledMotionPrompt = motionDirectives.join('. ') || 'Cinematic character motion and natural camera movement.';

    // 4. Submit Job to Orchestrator
    const job = await VideoJobOrchestrator.submitVideoJob({
      projectId,
      sceneId: validated.sceneId,
      prompt: compiledMotionPrompt,
      imageReferencePath: referenceImagePath,
      provider: validated.provider,
      modelId: validated.modelId,
      settings: {
        cameraMovement: validated.cameraMovement || scene.cameraMovement || 'LOCKED',
        cameraAngle: validated.cameraAngle || scene.cameraAngle || 'EYE_LEVEL',
        motionPreset: validated.motionPreset || scene.motionPreset || 'NATURAL',
        duration: validated.durationSeconds,
      },
      forceRegeneration: validated.forceRegeneration,
    });

    return NextResponse.json({
      success: true,
      job,
      referenceImagePath,
      motionPrompt: compiledMotionPrompt,
    });
  } catch (error: any) {
    console.error('[API generate-video] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Video submission failed' },
      { status: projectBoundaryStatus(error) }
    );
  }
}
