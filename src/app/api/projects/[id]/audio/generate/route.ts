import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AudioWorkflowService } from '@/lib/services/audio-workflow-service';

const generateAudioSchema = z.object({
  sceneId: z.string().optional(),
  characterId: z.string().optional(),
  assetType: z.enum(['NARRATION', 'DIALOGUE']),
  text: z.string().min(1, 'Text cannot be empty'),
  provider: z.string().optional().default('SARVAM'),
  modelId: z.string().optional(),
  voiceId: z.string().optional(),
  settings: z.record(z.any()).optional(),
  forceRegeneration: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();
    const validated = generateAudioSchema.parse(body);

    const result = await AudioWorkflowService.generateAudio({
      projectId,
      sceneId: validated.sceneId,
      characterId: validated.characterId,
      assetType: validated.assetType,
      text: validated.text,
      provider: validated.provider,
      modelId: validated.modelId,
      voiceId: validated.voiceId,
      settings: validated.settings,
      forceRegeneration: validated.forceRegeneration,
    });

    return NextResponse.json({
      success: true,
      assetVersion: result.assetVersion,
      job: result.job,
      processedText: result.processedText,
      durationSeconds: result.durationSeconds,
    });
  } catch (error: any) {
    console.error('[API generate-audio] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Audio generation failed' },
      { status: 500 }
    );
  }
}
