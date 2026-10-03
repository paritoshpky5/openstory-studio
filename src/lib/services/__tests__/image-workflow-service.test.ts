import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/db/prisma';
import { ImageWorkflowService } from '../image-workflow-service';

describe('ImageWorkflowService End-to-End', { timeout: 20000 }, () => {
  const testProjectId = 'test_img_proj_' + Date.now();
  let sceneId: string;
  let characterId: string;

  beforeAll(async () => {
    // Create test project
    await prisma.project.create({
      data: {
        id: testProjectId,
        name: 'Image Workflow Test Project',
      },
    });

    // Create test scene
    const scene = await prisma.scene.create({
      data: {
        projectId: testProjectId,
        sceneNumber: 1,
        title: 'Opening Haveli Courtyard',
        location: 'Jaipur Haveli',
        timeOfDay: 'Sunset',
        environment: 'Ancient courtyard with marigold petals',
        lighting: 'Warm golden backlight',
        mood: 'Nostalgic',
        summary: 'Raja Mohan stands gazing at the courtyard',
        status: 'NOT_STARTED',
      },
    });
    sceneId = scene.id;

    const character = await prisma.character.create({
      data: {
        projectId: testProjectId,
        name: 'Chintu',
        role: 'PROTAGONIST',
        ageDescription: 'Young adult rabbit',
        faceDescription: 'Rounded expressive rabbit face',
        skinDescription: 'Warm light brown fur',
        eyeDescription: 'Large deep brown eyes',
        hairDescription: 'Short plush fur',
        bodyDescription: 'Slim athletic rabbit body',
        clothingDescription: 'Saffron-orange neck scarf',
        consistencyPrompt: 'A light brown rabbit wearing a saffron scarf',
        negativeConsistencyPrompt: 'different scarf color',
      },
    });
    characterId = character.id;
  });

  afterAll(async () => {
    await prisma.project.delete({
      where: { id: testProjectId },
    });
  });

  it('generates a storyboard and updates scene status to STORYBOARD', async () => {
    const result = await ImageWorkflowService.generateImage({
      projectId: testProjectId,
      sceneId,
      assetType: 'STORYBOARD',
      provider: 'FLUX',
      modelId: 'flux-1-schnell',
      prompt: 'Storyboard sketch of Raja Mohan in haveli courtyard',
    });

    expect(result.job.status).toBe('COMPLETED');
    expect(result.assetVersion.assetType).toBe('STORYBOARD');
    expect(result.assetVersion.filePath).toContain('storyboards');
    expect(result.isReused).toBe(false);

    const updatedScene = await prisma.scene.findUnique({ where: { id: sceneId } });
    expect(updatedScene?.status).toBe('STORYBOARD');
  });

  it('approves a storyboard and transitions scene status to STORYBOARD_APPROVED', async () => {
    const assets = await ImageWorkflowService.getSceneAssets(sceneId);
    const storyboard = assets.find((a) => a.assetType === 'STORYBOARD');
    expect(storyboard).toBeDefined();

    const approved = await ImageWorkflowService.approveAssetVersion(storyboard!.id);
    expect(approved.approvalStatus).toBe('APPROVED');
    expect(approved.isActive).toBe(true);

    const updatedScene = await prisma.scene.findUnique({ where: { id: sceneId } });
    expect(updatedScene?.status).toBe('STORYBOARD_APPROVED');
  });

  it('generates a production image frame and updates scene to PRODUCTION_IMAGE', async () => {
    const result = await ImageWorkflowService.generateImage({
      projectId: testProjectId,
      sceneId,
      assetType: 'PRODUCTION_IMAGE',
      provider: 'GEMINI',
      modelId: 'imagen-3.0-generate-001',
      prompt: 'Cinematic 3D render of Raja Mohan in golden hour haveli courtyard',
    });

    expect(result.job.status).toBe('COMPLETED');
    expect(result.assetVersion.assetType).toBe('PRODUCTION_IMAGE');
    expect(result.assetVersion.filePath).toContain('images');

    const updatedScene = await prisma.scene.findUnique({ where: { id: sceneId } });
    expect(updatedScene?.status).toBe('PRODUCTION_IMAGE');
  });

  it('reuses existing asset when duplicate generation request is made without forceRegeneration', async () => {
    const duplicateResult = await ImageWorkflowService.generateImage({
      projectId: testProjectId,
      sceneId,
      assetType: 'PRODUCTION_IMAGE',
      provider: 'GEMINI',
      modelId: 'imagen-3.0-generate-001',
      prompt: 'Cinematic 3D render of Raja Mohan in golden hour haveli courtyard',
      forceRegeneration: false,
    });

    expect(duplicateResult.isReused).toBe(true);
  });

  it('approves production frame, unsets sibling active status, and sets scene to IMAGE_APPROVED', async () => {
    // Generate a second take with forceRegeneration = true
    const take2 = await ImageWorkflowService.generateImage({
      projectId: testProjectId,
      sceneId,
      assetType: 'PRODUCTION_IMAGE',
      provider: 'GEMINI',
      modelId: 'imagen-3.0-generate-001',
      prompt: 'Cinematic 3D render of Raja Mohan in golden hour haveli courtyard take 2',
      forceRegeneration: true,
    });

    // Approve take2
    const approvedTake2 = await ImageWorkflowService.approveAssetVersion(take2.assetVersion.id, true);
    expect(approvedTake2.approvalStatus).toBe('APPROVED');
    expect(approvedTake2.isActive).toBe(true);

    const updatedScene = await prisma.scene.findUnique({ where: { id: sceneId } });
    expect(updatedScene?.status).toBe('IMAGE_APPROVED');
  });

  it('rejects an asset version and records rejection reasons', async () => {
    const take3 = await ImageWorkflowService.generateImage({
      projectId: testProjectId,
      sceneId,
      assetType: 'PRODUCTION_IMAGE',
      provider: 'OPENAI',
      modelId: 'dall-e-3',
      prompt: 'Take with wrong clothing color',
      forceRegeneration: true,
    });

    const rejected = await ImageWorkflowService.rejectAssetVersion(
      take3.assetVersion.id,
      ['CHARACTER_CLOTHING_MISMATCH', 'WRONG_LIGHTING'],
      'Turban color should be saffron, not blue'
    );

    expect(rejected.approvalStatus).toBe('REJECTED');
    expect(rejected.isActive).toBe(false);
    expect(rejected.rejectionReasons).toContain('CHARACTER_CLOTHING_MISMATCH');
  });

  it('keeps exactly one active character reference and makes approval idempotent', async () => {
    const first = await ImageWorkflowService.generateImage({
      projectId: testProjectId,
      characterId,
      assetType: 'CHARACTER_REFERENCE',
      provider: 'GEMINI',
      modelId: 'gemini-3.1-flash-image',
      prompt: 'A centered character portrait of Chintu',
      settings: { aspectRatio: '1:1', referenceType: 'PRIMARY_FACE' },
      forceRegeneration: true,
    });
    await ImageWorkflowService.approveAssetVersion(first.assetVersion.id, true);
    await ImageWorkflowService.approveAssetVersion(first.assetVersion.id, true);

    let references = await prisma.characterReference.findMany({
      where: { characterId, referenceType: 'PRIMARY_FACE' },
    });
    expect(references).toHaveLength(1);
    expect(references[0].isActive).toBe(true);

    const second = await ImageWorkflowService.generateImage({
      projectId: testProjectId,
      characterId,
      assetType: 'CHARACTER_REFERENCE',
      provider: 'OPENAI',
      modelId: 'gpt-image-1',
      prompt: 'A refined centered character portrait of Chintu',
      settings: { aspectRatio: '1:1', referenceType: 'PRIMARY_FACE' },
      forceRegeneration: true,
    });
    await ImageWorkflowService.approveAssetVersion(second.assetVersion.id, true);

    references = await prisma.characterReference.findMany({
      where: { characterId, referenceType: 'PRIMARY_FACE' },
    });
    expect(references).toHaveLength(2);
    expect(references.filter((reference) => reference.isActive)).toHaveLength(1);
    expect(references.find((reference) => reference.isActive)?.filePath).toBe(second.assetVersion.filePath);
  });
});
