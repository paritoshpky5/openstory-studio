import { NextResponse } from 'next/server';
import { AVAILABLE_VOICES } from '@/lib/providers/audio';

export async function GET() {
  return NextResponse.json({
    success: true,
    voices: AVAILABLE_VOICES,
  });
}
