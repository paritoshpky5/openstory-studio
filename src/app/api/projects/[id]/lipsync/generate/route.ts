import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db/prisma';
import { getLipSyncProvider } from '@/lib/providers/lipsync';
import { projectBoundaryStatus, requireProjectAsset, requireProjectScene } from '@/lib/security/project-boundary';

const lipSyncSchema = z.object({
  sceneId: z.string(),
  videoAssetId: z.string(),
  audioAssetId: z.string(),
  provider: z.string().optional().default('SYNCLABS'),
  modelId: z.string().optional().default('sync-1.6.0'),
});

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const projectId = params.id;
    const body = await request.json();
    const validated = lipSyncSchema.parse(body);

    await requireProjectScene(projectId, validated.sceneId);

    // Fetch video asset and audio asset
    const videoAsset = await requireProjectAsset(projectId, validated.videoAssetId);
    const audioAsset = await requireProjectAsset(projectId, validated.audioAssetId);
    if (videoAsset.sceneId !== validated.sceneId || audioAsset.sceneId !== validated.sceneId) {
      return NextResponse.json({ success: false, error: 'Lip-sync assets must belong to the selected scene' }, { status: 400 });
    }
    if (!['VIDEO', 'LIPSYNC'].includes(videoAsset.assetType)) {
      return NextResponse.json({ success: false, error: 'Selected video asset has an invalid type' }, { status: 400 });
    }
    if (!['NARRATION', 'DIALOGUE'].includes(audioAsset.assetType)) {
      return NextResponse.json({ success: false, error: 'Selected audio asset has an invalid type' }, { status: 400 });
    }

    const provider = getLipSyncProvider(validated.provider);
    const result = await provider.syncLips(
      validated.modelId,
      videoAsset.filePath,
      audioAsset.filePath
    );

    // Save lipsynced video
    const assetId = `lipsync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lipsyncDir = path.join(process.cwd(), 'data', 'projects', projectId, 'lipsync');
    if (!fs.existsSync(lipsyncDir)) {
      fs.mkdirSync(lipsyncDir, { recursive: true });
    }

    const fileName = `${assetId}.mp4`;
    const fullFilePath = path.join(lipsyncDir, fileName);
    const relativeFilePath = path.join('projects', projectId, 'lipsync', fileName).replace(/\\/g, '/');

    if (result.buffer) {
      fs.writeFileSync(fullFilePath, result.buffer);
    } else {
      // Fallback dummy file
      fs.writeFileSync(fullFilePath, Buffer.from('mock lipsync video'));
    }

    // Create AssetVersion record
    const assetVersion = await prisma.assetVersion.create({
      data: {
        id: assetId,
        projectId,
        sceneId: validated.sceneId,
        assetType: 'LIPSYNC',
        provider: validated.provider,
        modelId: validated.modelId,
        channel: 'DIRECT_API',
        filePath: relativeFilePath,
        mimeType: 'video/mp4',
        duration: videoAsset.duration || 5.0,
        prompt: `Lip sync: ${audioAsset.prompt || 'Speech sync'}`,
        settings: JSON.stringify({
          sourceVideoId: videoAsset.id,
          sourceAudioId: audioAsset.id,
        }),
        referencePaths: JSON.stringify([videoAsset.filePath, audioAsset.filePath]),
        approvalStatus: 'APPROVED',
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      assetVersion,
    });
  } catch (error: any) {
    console.error('[API generate-lipsync] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lip sync generation failed' },
      { status: projectBoundaryStatus(error) }
    );
  }
}
