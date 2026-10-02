import { NextRequest, NextResponse } from 'next/server';
import { generateChatGPTStoryPrompt } from '@/lib/prompt-templates/chatgpt-story-prompt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const storyPrompt = generateChatGPTStoryPrompt({
      userStoryText: body.storyText,
      narrationMode: body.narrationMode,
      narratorTone: body.narratorTone,
    });
    return NextResponse.json({ success: true, prompt: storyPrompt });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
