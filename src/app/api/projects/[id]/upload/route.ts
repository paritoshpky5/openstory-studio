import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const assetType = formData.get('assetType') as string;
    const sceneId = formData.get('sceneId') as string | null;
    const characterId = formData.get('characterId') as string | null;
    const prompt = (formData.get('prompt') as string) || 'Manual web generation import';
    const viewType = formData.get('viewType') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!assetType) {
      return NextResponse.json(
        { success: false, error: 'assetType is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Determine subfolder
    let subfolder = 'images';
    if (assetType === 'VIDEO') subfolder = 'videos';
    else if (assetType === 'NARRATION') subfolder = 'narration';
    else if (assetType === 'DIALOGUE') subfolder = 'dialogue';
    else if (assetType === 'MUSIC') subfolder = 'music';
    else if (assetType === 'SFX') subfolder = 'sfx';
    else if (assetType === 'AMBIENCE') subfolder = 'ambience';
    else if (assetType === 'CHARACTER_REF') subfolder = 'character-references';
    else if (assetType === 'STORYBOARD') subfolder = 'storyboards';

    const projectDir = path.join(process.cwd(), 'data', 'projects', projectId, subfolder);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Sanitize filename & save
    const ext = path.extname(file.name) || (file.type.includes('video') ? '.mp4' : file.type.includes('audio') ? '.wav' : '.png');
    const timestamp = Date.now();
    const cleanFileName = `import_${timestamp}${ext}`;
    const destinationPath = path.join(projectDir, cleanFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(destinationPath, buffer);

    const relativePath = path.join('projects', projectId, subfolder, cleanFileName).replace(/\\/g, '/');

    // If setting active, deactivate existing assets of same type for this scene/character
    if (sceneId) {
      await prisma.assetVersion.updateMany({
        where: {
          sceneId,
          assetType,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    // Create AssetVersion record
    const asset = await prisma.assetVersion.create({
      data: {
        id: `manual_${timestamp}`,
        projectId,
        sceneId: sceneId || null,
        characterId: characterId || null,
        assetType: assetType === 'CHARACTER_REF' ? 'PRODUCTION_IMAGE' : assetType,
        provider: 'MANUAL_IMPORT',
        modelId: 'WEB_GENERATED',
        channel: 'MANUAL_IMPORT',
        filePath: relativePath,
        mimeType: file.type || (ext === '.mp4' ? 'video/mp4' : ext === '.wav' ? 'audio/wav' : 'image/png'),
        prompt,
        settings: JSON.stringify({ originalFilename: file.name, viewType: viewType || undefined }),
        approvalStatus: 'APPROVED',
        isActive: true,
      },
    });

    // Update scene status if applicable
    if (sceneId) {
      let nextStatus = undefined;
      if (assetType === 'STORYBOARD') nextStatus = 'STORYBOARD_APPROVED';
      else if (assetType === 'PRODUCTION_IMAGE') nextStatus = 'IMAGE_APPROVED';
      else if (assetType === 'VIDEO') nextStatus = 'VIDEO_APPROVED';

      if (nextStatus) {
        await prisma.scene.update({
          where: { id: sceneId },
          data: { status: nextStatus },
        });
      }
    }

    // If character reference, link to character via CharacterReference
    if (characterId && assetType === 'CHARACTER_REF') {
      const type = viewType || 'PRIMARY_FACE';
      // Set existing references of this type to inactive
      await prisma.characterReference.updateMany({
        where: {
          characterId,
          referenceType: type,
        },
        data: { isActive: false },
      });

      await prisma.characterReference.create({
        data: {
          characterId,
          referenceType: type,
          filePath: relativePath,
          promptUsed: prompt,
          isApproved: true,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      asset,
      filePath: relativePath,
    });
  } catch (error: any) {
    console.error('[Upload API] Error saving manual asset:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'File upload failed' },
      { status: 500 }
    );
  }
}
