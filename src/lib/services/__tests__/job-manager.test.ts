import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { JobManager, GenerationRequest } from '../job-manager';
import prisma from '@/lib/db/prisma';

describe('JobManager Idempotency & Safety', () => {
  const dummyProjectId = 'test_proj_' + Date.now();
  
  beforeAll(async () => {
    // Create the dummy project to satisfy foreign key constraints
    await prisma.project.create({
      data: {
        id: dummyProjectId,
        name: 'Test Project',
      },
    });
  });

  beforeEach(async () => {
    // Clean up generation jobs between tests
    await prisma.generationJob.deleteMany({
      where: { projectId: dummyProjectId }
    });
  });

  afterAll(async () => {
    // Cascade delete will remove associated jobs
    await prisma.project.delete({
      where: { id: dummyProjectId },
    });
  });

  it('generates identical idempotency keys for identical requests', () => {
    const req1: GenerationRequest = {
      projectId: dummyProjectId,
      jobType: 'IMAGE',
      provider: 'FLUX',
      modelId: 'flux-1-pro',
      channel: 'DIRECT_API',
      prompt: 'A test prompt',
      settings: { aspectRatio: '16:9' },
    };

    const req2: GenerationRequest = {
      projectId: dummyProjectId,
      jobType: 'IMAGE',
      provider: 'FLUX',
      modelId: 'flux-1-pro',
      channel: 'DIRECT_API',
      prompt: 'A test prompt',
      settings: { aspectRatio: '16:9' },
    };

    const key1 = JobManager.generateIdempotencyKey(req1);
    const key2 = JobManager.generateIdempotencyKey(req2);

    expect(key1).toBe(key2);
  });

  it('prevents duplicate paid jobs by returning existing pending/processing/completed jobs', async () => {
    const req: GenerationRequest = {
      projectId: dummyProjectId,
      jobType: 'IMAGE',
      provider: 'FLUX',
      modelId: 'flux-1-pro',
      channel: 'DIRECT_API',
      prompt: 'Duplicate protection test',
      settings: { aspectRatio: '16:9' },
    };

    // First request should create a new job
    const result1 = await JobManager.getOrCreateJob(req);
    expect(result1.isNew).toBe(true);
    expect(result1.job.status).toBe('PENDING');

    // Manually mark it as PROCESSING to simulate it being picked up
    await JobManager.updateJobStatus(result1.job.id, 'PROCESSING');

    // Second request with exact same parameters
    const result2 = await JobManager.getOrCreateJob(req);
    expect(result2.isNew).toBe(false);
    expect(result2.job.id).toBe(result1.job.id);
    expect(result2.job.status).toBe('PROCESSING'); // Returns the exact processing job
  });

  it('allows forced regeneration by bypassing idempotency check', async () => {
    const req: GenerationRequest = {
      projectId: dummyProjectId,
      jobType: 'IMAGE',
      provider: 'FLUX',
      modelId: 'flux-1-pro',
      channel: 'DIRECT_API',
      prompt: 'Force regen test',
      settings: { aspectRatio: '16:9' },
    };

    const result1 = await JobManager.getOrCreateJob(req);
    expect(result1.isNew).toBe(true);

    // Request with forceRegeneration = true
    const reqForce = { ...req, forceRegeneration: true };
    const result2 = await JobManager.getOrCreateJob(reqForce);
    
    expect(result2.isNew).toBe(true);
    expect(result2.job.id).not.toBe(result1.job.id);
    expect(result2.job.idempotencyKey).not.toBe(result1.job.idempotencyKey);
  });
});
