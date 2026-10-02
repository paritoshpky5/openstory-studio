import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FFmpegRenderer, RenderPreset } from '@/lib/render/ffmpeg-renderer';

const renderSchema = z.object({
  preset: z.enum(['YOUTUBE_1080', 'YOUTUBE_4K', 'SHORTS_1080', 'PREVIEW']),
  burnSubtitles: z.boolean().default(false),
});

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const projectId = params.id;
    const body = await request.json();
    const validated = renderSchema.parse(body);

    const renderOptions = {
      projectId,
      preset: validated.preset as RenderPreset,
      burnSubtitles: validated.burnSubtitles,
      onProgress: (percent: number) => {
        // Real-time progress updates could be sent via SSE or WebSocket here.
        // For now, it logs server-side.
        console.log(`[Render ${projectId}] ${percent.toFixed(1)}%`);
      }
    };

    const finalPath = await FFmpegRenderer.renderProject(renderOptions);

    return NextResponse.json({
      success: true,
      filePath: finalPath,
    });
  } catch (error: any) {
    console.error('[API render-project] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Render failed' },
      { status: 500 }
    );
  }
}
