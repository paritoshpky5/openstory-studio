import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import path from 'path';
import fs from 'fs';
import { AudioMasteringService } from '@/lib/audio/audio-mastering';
import { syncSceneTimingToSpeech } from '@/lib/services/audio-timing-service';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; assetId: string }> }
) {
  const params = await props.params;
  const { id: projectId, assetId } = params;

  try {
    const { speedFactor } = await request.json();

    if (!speedFactor || speedFactor < 0.5 || speedFactor > 2.0) {
      return NextResponse.json(
        { success: false, error: 'speedFactor must be between 0.5 and 2.0' },
        { status: 400 }
      );
    }

    const asset = await prisma.assetVersion.findUnique({
      where: { id: assetId, projectId },
      include: { scene: true },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (asset.assetType !== 'NARRATION' && asset.assetType !== 'DIALOGUE') {
      return NextResponse.json(
        { success: false, error: 'Only NARRATION or DIALOGUE assets can be sped up' },
        { status: 400 }
      );
    }

    const sourcePath = path.join(process.cwd(), 'data', asset.filePath);
    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json(
        { success: false, error: 'Source audio file not found on disk' },
        { status: 404 }
      );
    }

    // Generate new filename
    const ext = path.extname(sourcePath) || '.wav';
    const parsed = path.parse(sourcePath);
    // Remove old speed suffix if it exists, or just append
    const baseName = parsed.name.replace(/_speed_\d+/, '');
    const outFilename = `${baseName}_speed_${Math.round(speedFactor * 100)}${ext}`;
    const newRelativePath = path.join('projects', projectId, 'audio', outFilename).replace(/\\/g, '/');
    const outPath = path.join(process.cwd(), 'data', newRelativePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    // Apply speed adjustment via FFmpeg
    const result = await AudioMasteringService.masterAudio(sourcePath, outPath, {
      speedFactor,
      targetLufs: -16,
    });

    // Create new asset version
    const newAsset = await prisma.$transaction(async (tx) => {
      await tx.assetVersion.update({
        where: { id: asset.id },
        data: { isActive: false },
      });
      return tx.assetVersion.create({
        data: {
          projectId,
          sceneId: asset.sceneId,
          characterId: asset.characterId,
          assetType: asset.assetType,
          provider: asset.provider,
          modelId: asset.modelId,
          channel: 'LOCAL',
          filePath: newRelativePath,
          mimeType: 'audio/wav',
          duration: result.durationSeconds,
          prompt: asset.prompt ? `${asset.prompt} [Speed: ${speedFactor}x]` : `Speed: ${speedFactor}x`,
          approvalStatus: 'APPROVED',
          isActive: true,
          settings: JSON.stringify({
            originalAssetId: asset.id,
            speedFactor,
            duration: result.durationSeconds,
          }),
        },
      });
    });

    if (asset.sceneId && result.durationSeconds > 0) {
      await syncSceneTimingToSpeech(asset.sceneId, result.durationSeconds);
    }

    return NextResponse.json({
      success: true,
      assetVersion: newAsset,
    });
  } catch (error: any) {
    console.error('Audio speed adjustment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to adjust speed' },
      { status: 500 }
    );
  }
}
