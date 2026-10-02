import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { ImageWorkflowService } from '@/lib/services/image-workflow-service';
import { PromptCompiler } from '@/lib/prompt-compiler/prompt-compiler';
import {
  projectBoundaryStatus,
  requireProjectCharacter,
  requireProjectScene,
  requireProjectShot,
} from '@/lib/security/project-boundary';

const generateImageSchema = z.object({
  sceneId: z.string().optional().nullable(),
  shotId: z.string().optional().nullable(),
  characterId: z.string().optional().nullable(),
  assetType: z.enum(['STORYBOARD', 'PRODUCTION_IMAGE', 'CHARACTER_REFERENCE']).default('PRODUCTION_IMAGE'),
  provider: z.enum(['FLUX', 'GEMINI', 'OPENAI']).default('FLUX'),
  modelId: z.string().optional(),
  channel: z.string().default('DIRECT_API'),
  customPrompt: z.string().optional(),
  customNegativePrompt: z.string().optional(),
  settings: z.record(z.any()).default({ aspectRatio: '16:9' }),
  referencePaths: z.array(z.string()).default([]),
  forceRegeneration: z.boolean().default(false),
});

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const projectId = params.id;
    const body = await request.json();
    const validated = generateImageSchema.parse(body);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        styleBible: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Default modelId based on provider if not passed
    let modelId = validated.modelId;
    if (!modelId) {
      if (validated.provider === 'FLUX') modelId = 'flux-1-dev';
      else if (validated.provider === 'GEMINI') modelId = 'gemini-3.1-flash-image';
      else if (validated.provider === 'OPENAI') modelId = 'gpt-image-1';
      else modelId = 'flux-1-dev';
    }

    let finalPrompt = validated.customPrompt || '';
    let finalNegative = validated.customNegativePrompt || '';

    let scene: any = null;
    let activeReferences: { characterId: string; filePath: string; type: string }[] = [];

    if (validated.sceneId) {
      await requireProjectScene(projectId, validated.sceneId);
      scene = await prisma.scene.findFirst({
        where: { id: validated.sceneId, projectId },
        include: {
          characters: {
            include: {
              character: { include: { references: true } },
            },
          },
        },
      });

      activeReferences = scene.characters.flatMap((sc: any) =>
        sc.character.references
          .filter((ref: any) => ref.isActive && ref.isApproved)
          .map((ref: any) => ({
            characterId: sc.character.id,
            filePath: ref.filePath,
            type: ref.referenceType,
          }))
      );
    }
    if (validated.characterId) await requireProjectCharacter(projectId, validated.characterId);
    if (validated.shotId) {
      const shot = await requireProjectShot(projectId, validated.shotId);
      if (validated.sceneId && shot.sceneId !== validated.sceneId) {
        return NextResponse.json({ error: 'Shot does not belong to the selected scene' }, { status: 400 });
      }
    }

    // Client-provided reference paths are accepted only when they match approved references in this project.
    if (validated.referencePaths.length > 0) {
      const approved = await prisma.characterReference.findMany({
        where: {
          filePath: { in: validated.referencePaths },
          isActive: true,
          isApproved: true,
          character: { projectId },
        },
      });
      activeReferences.push(...approved.map((ref) => ({
        characterId: ref.characterId,
        filePath: ref.filePath,
        type: ref.referenceType,
      })));
    }
    activeReferences = Array.from(new Map(activeReferences.map((ref) => [ref.filePath, ref])).values());
    if (validated.provider === 'FLUX' && activeReferences.length > 0 && modelId === 'flux-1-dev') {
      modelId = 'flux-kontext-pro';
    }

    // Compile the same character-aware prompt used by API and manual workflows.
    if (!finalPrompt && scene) {

      if (scene && project.styleBible) {
        const characters = scene.characters.map((sc: any) => sc.character as any);
        const compiled = PromptCompiler.compileForImage(
          {
            scene: scene as any,
            styleBible: project.styleBible as any,
            characters,
            activeReferences,
          },
          validated.provider as any
        );

        finalPrompt = compiled.positivePrompt;
        finalNegative = compiled.negativePrompt || '';
      }
    }

    if (!finalPrompt) {
      return NextResponse.json(
        { error: 'Prompt is required or scene must exist to auto-compile' },
        { status: 400 }
      );
    }

    const result = await ImageWorkflowService.generateImage({
      projectId,
      sceneId: validated.sceneId,
      shotId: validated.shotId,
      characterId: validated.characterId,
      assetType: validated.assetType,
      provider: validated.provider,
      modelId,
      channel: validated.channel,
      prompt: finalPrompt,
      negativePrompt: finalNegative,
      settings: validated.settings,
      referencePaths: activeReferences.map((ref) => ref.filePath),
      forceRegeneration: validated.forceRegeneration,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: error.message || 'Image generation failed' },
      { status: projectBoundaryStatus(error) }
    );
  }
}
