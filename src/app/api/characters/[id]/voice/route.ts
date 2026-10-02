import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';

const updateVoiceSchema = z.object({
  voiceProvider: z.string(),
  voiceId: z.string(),
  voiceSettings: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const characterId = params.id;
    const body = await request.json();
    const validated = updateVoiceSchema.parse(body);

    const updated = await prisma.character.update({
      where: { id: characterId },
      data: {
        voiceProvider: validated.voiceProvider,
        voiceId: validated.voiceId,
        voiceSettings: validated.voiceSettings ? JSON.stringify(validated.voiceSettings) : null,
      },
    });

    return NextResponse.json({
      success: true,
      character: updated,
    });
  } catch (error: any) {
    console.error('[API character-voice] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update character voice' },
      { status: 500 }
    );
  }
}
