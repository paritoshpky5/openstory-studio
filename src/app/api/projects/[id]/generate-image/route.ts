import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { ImageWorkflowService } from '@/lib/services/image-workflow-service';
import { PromptCompiler } from '@/lib/prompt-compiler/prompt-compiler';

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      else if (validated.provider === 'GEMINI') modelId = 'imagen-3.0-generate-001';
      else if (validated.provider === 'OPENAI') modelId = 'dall-e-3';
      else modelId = 'flux-1-dev';
    }

    let finalPrompt = validated.customPrompt || '';
    let finalNegative = validated.customNegativePrompt || '';

    // If no customPrompt was provided and we have a sceneId, compile prompt via PromptCompiler!
    if (!finalPrompt && validated.sceneId) {
      const scene = await prisma.scene.findUnique({
        where: { id: validated.sceneId },
        include: {
          characters: {
            include: { character: true },
          },
        },
      });

      if (scene && project.styleBible) {
        const characters = scene.characters.map((sc) => sc.character as any);
        const compiled = PromptCompiler.compileForImage(
          {
            scene: scene as any,
            styleBible: project.styleBible as any,
            characters,
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
      referencePaths: validated.referencePaths,
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
      { status: 500 }
    );
  }
}
