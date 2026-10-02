import { NextRequest, NextResponse } from 'next/server';
import { SoundDesignService } from '@/lib/audio/sound-design-service';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const projectId = params.id;
    const result = await SoundDesignService.generateSubtitlesForProject(projectId);

    return NextResponse.json({
      success: true,
      cuesCount: result.cues.length,
      srtPath: result.srtPath,
      vttPath: result.vttPath,
      srtContent: result.srtContent,
      vttContent: result.vttContent,
    });
  } catch (error: any) {
    console.error('[API generate-subtitles] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate subtitles' },
      { status: 500 }
    );
  }
}
