import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { KlingVideoProvider } from '../kling-provider';
import { SeedanceVideoProvider } from '../seedance-provider';
import prisma from '@/lib/db/prisma';
import fs from 'fs';
import path from 'path';

describe('Video Providers (Kling & Seedance)', () => {
  const testProjectId = 'test_vid_prov_1';
  let testImagePath: string;

  beforeAll(async () => {
    // Create dummy image file for image-to-video testing
    const projectDir = path.join(process.cwd(), 'data', 'projects', testProjectId, 'images');
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    testImagePath = path.join(projectDir, 'test_frame.png');
    fs.writeFileSync(testImagePath, Buffer.from('dummy png content'));
  });

  afterAll(async () => {
    const projectDir = path.join(process.cwd(), 'data', 'projects', testProjectId);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  describe('KlingVideoProvider', () => {
    const kling = new KlingVideoProvider();

    it('returns supported Kling models with capabilities and pricing', () => {
      const models = kling.getSupportedModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models.some((m) => m.id === 'kling-v1')).toBe(true);
      expect(models.some((m) => m.id === 'kling-v1-5')).toBe(true);

      const cost = kling.estimateCost('kling-v1', { duration: 5 });
      expect(cost).toBe(0.25); // 5s * 0.05
    });

    it('simulates async image-to-video submission and status polling', async () => {
      const { providerJobId } = await kling.generateVideo(
        'kling-v1',
        'Camera slowly pushes in on the king sitting on the throne',
        testImagePath,
        { duration: 5 }
      );

      expect(providerJobId).toBeDefined();
      expect(providerJobId.startsWith('kling_mock_')).toBe(true);

      // Check immediate status
      const statusRes = await kling.checkStatus(providerJobId);
      expect(statusRes.status).toBe('PROCESSING');
      expect(statusRes.progress).toBeDefined();
    });
  });

  describe('SeedanceVideoProvider', () => {
    const seedance = new SeedanceVideoProvider();

    it('returns supported Seedance models with capabilities and pricing', () => {
      const models = seedance.getSupportedModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models.some((m) => m.id === 'seedance-v1')).toBe(true);
      expect(models.some((m) => m.id === 'seedance-pro')).toBe(true);

      const cost = seedance.estimateCost('seedance-pro', { duration: 5 });
      expect(cost).toBe(0.60); // 5s * 0.12
    });

    it('simulates async image-to-video submission and status polling', async () => {
      const { providerJobId } = await seedance.generateVideo(
        'seedance-v1',
        'Expressive dialogue acting with subtle eye contact',
        testImagePath,
        { duration: 5 }
      );

      expect(providerJobId).toBeDefined();
      expect(providerJobId.startsWith('seedance_mock_')).toBe(true);

      // Check immediate status
      const statusRes = await seedance.checkStatus(providerJobId);
      expect(statusRes.status).toBe('PROCESSING');
    });
  });
});
