import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VideoJobOrchestrator } from '../video-job-orchestrator';
import prisma from '@/lib/db/prisma';
import fs from 'fs';
import path from 'path';

describe('VideoJobOrchestrator Architecture', () => {
  const testProjectId = 'test_vid_proj_1';
  let testSceneId: string;

  beforeAll(async () => {
    // Setup minimal project and scene
    await prisma.project.create({
      data: {
        id: testProjectId,
        name: 'Video Orchestrator Test Project',
        targetLanguage: 'hi',
        currentPhase: 'PRODUCTION',
      },
    });

    const scene = await prisma.scene.create({
      data: {
        projectId: testProjectId,
        sceneNumber: 1,
        title: 'Hero Walk',
        location: 'Forest',
        timeOfDay: 'DAY',
        environment: 'Lush',
        lighting: 'Dappled',
        mood: 'Epic',
        summary: 'Hero walks forward.',
      },
    });
    testSceneId = scene.id;
  });

  afterAll(async () => {
    // Teardown
    await prisma.assetVersion.deleteMany({ where: { projectId: testProjectId } });
    await prisma.generationJob.deleteMany({ where: { projectId: testProjectId } });
    await prisma.scene.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.deleteMany({ where: { id: testProjectId } });

    const testDir = path.join(process.cwd(), 'data', 'projects', testProjectId);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('submits a video job and transitions through polling lifecycle to COMPLETED', async () => {
    // 1. Submit
    const submittedJob = await VideoJobOrchestrator.submitVideoJob({
      projectId: testProjectId,
      sceneId: testSceneId,
      prompt: 'Cinematic walk cycle',
      imageReferencePath: 'fake/path.jpg',
      provider: 'MOCK_VIDEO',
      modelId: 'mock-video-1',
    });

    expect(submittedJob).toBeDefined();
    expect(submittedJob.status).toBe('PROCESSING');
    expect(submittedJob.providerJobId).toContain('mock_vid_');
    expect(submittedJob.retryCount).toBe(0);

    // 2. Poll immediately (Should throttle and return PROCESSING)
    const immediatePoll = await VideoJobOrchestrator.checkJobStatus(submittedJob.id);
    expect(immediatePoll?.status).toBe('PROCESSING');

    // 3. Time travel: modify the providerJobId so the mock provider thinks 20s have passed
    const parts = submittedJob.providerJobId!.split('_');
    const oldTime = parseInt(parts[2], 10);
    const newTime = oldTime - 20000; // 20s ago
    const timeTraveledId = `mock_vid_${newTime}_success`;
    
    // We also need to hack the updatedAt so it bypasses the 10s throttling check
    const pastDate = new Date(Date.now() - 20000);
    
    await prisma.generationJob.update({
      where: { id: submittedJob.id },
      data: { 
        providerJobId: timeTraveledId,
        updatedAt: pastDate 
      },
    });

    // 4. Poll again (Should now complete and fulfill the asset)
    const finalPoll = await VideoJobOrchestrator.checkJobStatus(submittedJob.id);
    expect(finalPoll?.status).toBe('COMPLETED');
    expect(finalPoll?.resultAssetId).toBeDefined();

    // Verify AssetVersion was created and saved to disk
    const asset = await prisma.assetVersion.findUnique({
      where: { id: finalPoll!.resultAssetId! },
    });
    expect(asset).toBeDefined();
    expect(asset?.assetType).toBe('VIDEO');
    
    const filePath = path.join(process.cwd(), 'data', asset!.filePath);
    expect(fs.existsSync(filePath)).toBe(true);
    
    const scene = await prisma.scene.findUnique({ where: { id: testSceneId } });
    expect(scene?.status).toBe('VIDEO_GENERATED');
  });

  it('triggers strict retry protection when provider fails in PROCESSING phase', async () => {
    // 1. Submit a job guaranteed to fail
    const failingJob = await VideoJobOrchestrator.submitVideoJob({
      projectId: testProjectId,
      sceneId: testSceneId,
      prompt: 'Exploding barrel',
      imageReferencePath: 'fake/path.jpg',
      provider: 'MOCK_VIDEO',
      modelId: 'mock-video-1',
      settings: { failOnPurpose: true },
      forceRegeneration: true, // Bypass idempotency for new job
    });

    expect(failingJob.status).toBe('PROCESSING');

    // Time travel to bypass throttle and force completion
    const pastDate = new Date(Date.now() - 20000);
    const parts = failingJob.providerJobId!.split('_');
    const oldTime = parseInt(parts[2], 10);
    const newTime = oldTime - 20000;
    const timeTraveledId = `mock_vid_${newTime}_fail`;

    await prisma.generationJob.update({
      where: { id: failingJob.id },
      data: { 
        providerJobId: timeTraveledId,
        updatedAt: pastDate 
      },
    });

    // 2. Poll: Provider returns FAILED. Orchestrator should intercept and RETRY!
    const retryPoll = await VideoJobOrchestrator.checkJobStatus(failingJob.id);
    
    // Status should be PROCESSING again (resubmitted), retryCount should be 1
    expect(retryPoll?.status).toBe('PROCESSING');
    expect(retryPoll?.retryCount).toBe(1);
    expect(retryPoll?.providerJobId).not.toBe(failingJob.providerJobId); // Should have a new provider Job ID
  });
});
