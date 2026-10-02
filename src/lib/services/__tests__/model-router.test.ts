import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/db/prisma';
import { ModelRouter, RouteRequirements } from '../model-router';
import { JobType } from '@/schemas/job.schema';

describe('ModelRouter - Quality Gate & Economic Routing', () => {
  beforeAll(async () => {
    // Clear out existing model registry items
    await prisma.modelRegistryItem.deleteMany();

    // Insert controlled mock data
    await prisma.modelRegistryItem.createMany({
      data: [
        {
          id: 'test-cheap-model',
          provider: 'MOCK',
          modelId: 'test-cheap-model',
          displayName: 'Cheap Model',
          type: 'IMAGE',
          capabilities: JSON.stringify({ maxResolution: '1024x1024' }),
          pricing: JSON.stringify({ perImage: 0.01 }),
          totalGenerations: 100,
          approvedGenerations: 20,
          approvalRate: 0.20, // 20% approval rate
          effectiveCost: 0.01,
          enabled: true,
        },
        {
          id: 'test-premium-model',
          provider: 'MOCK',
          modelId: 'test-premium-model',
          displayName: 'Premium Model',
          type: 'IMAGE',
          capabilities: JSON.stringify({ maxResolution: '2048x2048' }),
          pricing: JSON.stringify({ perImage: 0.10 }),
          totalGenerations: 100,
          approvedGenerations: 95,
          approvalRate: 0.95, // 95% approval rate
          effectiveCost: 0.10,
          enabled: true,
        },
        {
          id: 'test-mid-model',
          provider: 'MOCK',
          modelId: 'test-mid-model',
          displayName: 'Mid Model',
          type: 'IMAGE',
          capabilities: JSON.stringify({ maxResolution: '1024x1024' }),
          pricing: JSON.stringify({ perImage: 0.03 }),
          totalGenerations: 100,
          approvedGenerations: 60,
          approvalRate: 0.60, // 60% approval rate
          effectiveCost: 0.03,
          enabled: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.modelRegistryItem.deleteMany();
  });

  it('routes BACKGROUND shots to the cheapest capable model that passes a low quality gate', async () => {
    const req: RouteRequirements = {
      jobType: 'IMAGE',
      importance: 'BACKGROUND',
    };

    const result = await ModelRouter.route(req);

    // Cheap Model math: 0.01 / 0.20 = 0.05 Expected Cost Per Success
    // Mid Model math: 0.03 / 0.60 = 0.05 Expected Cost Per Success
    // Premium math: 0.10 / 0.95 = 0.105 Expected Cost Per Success
    
    // Background threshold is 5% (0.05). Both Cheap and Mid pass. 
    // They tie at $0.05 expected cost, but since Cheap Model's raw cost is 0.01, sort handles it, 
    // actually they both equal 0.05. Let's see which it picks.
    expect(['test-cheap-model', 'test-mid-model']).toContain(result.selectedModelId);
    expect(result.expectedCostPerSuccess).toBeCloseTo(0.05, 3);
  });

  it('routes HERO shots to the premium model because cheap models fail the strict quality gate', async () => {
    const req: RouteRequirements = {
      jobType: 'IMAGE',
      importance: 'HERO',
      // By default HERO expects 70% minimum quality
    };

    const result = await ModelRouter.route(req);

    // Cheap (20%) and Mid (60%) should FAIL the 70% quality gate for HERO.
    // Premium (95%) passes.
    expect(result.selectedModelId).toBe('test-premium-model');
    expect(result.expectedCostPerSuccess).toBeCloseTo(0.105, 3); // 0.10 / 0.95
  });

  it('falls back to the absolute highest quality model if NO model passes the custom high gate', async () => {
    const req: RouteRequirements = {
      jobType: 'IMAGE',
      importance: 'HERO',
      minApprovalRate: 0.99, // Impossible bar!
    };

    const result = await ModelRouter.route(req);

    // No one passes 99%. Fallback sorts by raw approvalRate (Premium has 95%).
    expect(result.selectedModelId).toBe('test-premium-model');
    expect(result.reasoning).toContain('Falling back to highest quality');
  });
});
