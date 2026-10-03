import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import prisma from '@/lib/db/prisma';
import {
  requireProject,
  requireProjectCharacter,
  requireProjectScene,
  requireProjectShot,
  projectBoundaryStatus,
} from '@/lib/security/project-boundary';
import {
  detectMedia,
  expectedUploadCategory,
  MAX_UPLOAD_BYTES,
  sanitizeOriginalFilename,
} from '@/lib/security/media-upload';
import { ProjectSubdirectory, saveProjectMediaFile } from '@/lib/storage/project-storage';
import { probeMediaDuration } from '@/lib/media/media-probe';
import { syncSceneTimingToSpeech } from '@/lib/services/audio-timing-service';

const ALLOWED_ASSET_TYPES = new Set([
  'STORYBOARD', 'PRODUCTION_IMAGE', 'CHARACTER_REF', 'CHARACTER_REFERENCE',
  'VIDEO', 'NARRATION', 'DIALOGUE', 'MUSIC', 'SFX', 'AMBIENCE',
]);

function subdirectoryFor(assetType: string): ProjectSubdirectory {
  switch (assetType) {
    case 'VIDEO': return 'videos';
    case 'NARRATION': return 'narration';
    case 'DIALOGUE': return 'dialogue';
    case 'MUSIC': return 'music';
    case 'SFX': return 'sfx';
    case 'AMBIENCE': return 'ambience';
    case 'CHARACTER_REFERENCE': return 'character-references';
    case 'STORYBOARD': return 'storyboards';
    default: return 'images';
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let savedPath: string | null = null;
  try {
    const projectId = params.id;
    const formData = await request.formData();
    const file = formData.get('file');
    const requestedAssetType = String(formData.get('assetType') || '');
    const assetType = requestedAssetType === 'CHARACTER_REF' ? 'CHARACTER_REFERENCE' : requestedAssetType;
    const sceneId = formData.get('sceneId') ? String(formData.get('sceneId')) : null;
    const shotId = formData.get('shotId') ? String(formData.get('shotId')) : null;
    const characterId = formData.get('characterId') ? String(formData.get('characterId')) : null;
    const prompt = String(formData.get('prompt') || 'Manual web generation import').slice(0, 20_000);
    const viewType = formData.get('viewType') ? String(formData.get('viewType')) : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }
    if (!ALLOWED_ASSET_TYPES.has(requestedAssetType)) {
      return NextResponse.json({ success: false, error: 'Unsupported assetType' }, { status: 400 });
    }
    if (assetType === 'CHARACTER_REFERENCE' && !characterId) {
      return NextResponse.json({ success: false, error: 'characterId is required for a character reference' }, { status: 400 });
    }

    await requireProject(projectId);
    if (sceneId) await requireProjectScene(projectId, sceneId);
    if (shotId) {
      const shot = await requireProjectShot(projectId, shotId);
      if (sceneId && shot.sceneId !== sceneId) {
        return NextResponse.json({ success: false, error: 'Shot does not belong to the selected scene' }, { status: 400 });
      }
    }
    if (characterId) await requireProjectCharacter(projectId, characterId);

    const expectedCategory = expectedUploadCategory(assetType);
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES[expectedCategory]) {
      const maxMb = Math.floor(MAX_UPLOAD_BYTES[expectedCategory] / (1024 * 1024));
      return NextResponse.json(
        { success: false, error: `Invalid file size. ${expectedCategory} uploads are limited to ${maxMb} MB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectMedia(buffer);
    if (!detected || detected.category !== expectedCategory) {
      return NextResponse.json(
        { success: false, error: `File contents do not match the expected ${expectedCategory} format.` },
        { status: 415 }
      );
    }

    const saved = await saveProjectMediaFile(
      projectId,
      subdirectoryFor(assetType),
      `import_${assetType.toLowerCase()}`,
      detected.extension,
      buffer
    );
    savedPath = saved.absolutePath;
    const duration = expectedCategory === 'image'
      ? null
      : await probeMediaDuration(saved.absolutePath);

    const asset = await prisma.$transaction(async (tx) => {
      if (sceneId) {
        await tx.assetVersion.updateMany({
          where: { projectId, sceneId, shotId, assetType, isActive: true },
          data: { isActive: false },
        });
      }
      if (characterId && assetType === 'CHARACTER_REFERENCE') {
        await tx.characterReference.updateMany({
          where: { characterId, referenceType: viewType || 'PRIMARY_FACE' },
          data: { isActive: false },
        });
      }

      const createdAsset = await tx.assetVersion.create({
        data: {
          projectId, sceneId, shotId, characterId, assetType,
          provider: 'MANUAL_IMPORT', modelId: 'WEB_GENERATED', channel: 'MANUAL_IMPORT',
          filePath: saved.relativePath, mimeType: detected.mimeType, prompt,
          duration,
          settings: JSON.stringify({
            originalFilename: sanitizeOriginalFilename(file.name),
            viewType: viewType || undefined,
          }),
          approvalStatus: 'APPROVED', isActive: true,
        },
      });

      if (sceneId) {
        const nextStatus = assetType === 'STORYBOARD'
          ? 'STORYBOARD_APPROVED'
          : assetType === 'PRODUCTION_IMAGE'
            ? 'IMAGE_APPROVED'
            : assetType === 'VIDEO' ? 'VIDEO_APPROVED' : undefined;
        if (nextStatus) {
          await tx.scene.update({ where: { id: sceneId }, data: { status: nextStatus } });
        }
      }

      if (characterId && assetType === 'CHARACTER_REFERENCE') {
        await tx.characterReference.create({
          data: {
            characterId, referenceType: viewType || 'PRIMARY_FACE',
            filePath: saved.relativePath, promptUsed: prompt,
            isApproved: true, isActive: true,
          },
        });
      }
      return createdAsset;
    });

    if (sceneId && duration && (assetType === 'NARRATION' || assetType === 'DIALOGUE')) {
      await syncSceneTimingToSpeech(sceneId, duration);
    }

    return NextResponse.json({ success: true, asset, filePath: saved.relativePath });
  } catch (error: any) {
    if (savedPath) await fs.promises.rm(savedPath, { force: true }).catch(() => undefined);
    console.error('[Upload API] Error saving manual asset:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'File upload failed' },
      { status: projectBoundaryStatus(error) }
    );
  }
}
