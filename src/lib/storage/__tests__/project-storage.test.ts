import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ensureProjectStorage,
  generateMediaFilename,
  saveProjectManifest,
  readProjectManifest,
  getProjectDir,
  PROJECT_SUBDIRECTORIES,
} from '../project-storage';

describe('ProjectStorage Local Filesystem', () => {
  const testProjectId = 'test_proj_' + Date.now();
  const testDir = getProjectDir(testProjectId);

  afterAll(() => {
    // Clean up test directory if created
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('generates non-destructive unique filenames with timestamp and random suffix', () => {
    const fn1 = generateMediaFilename('shot_01', 'png');
    const fn2 = generateMediaFilename('shot_01', 'png');
    expect(fn1).toMatch(/^shot_01_\d+_[a-z0-9]+\.png$/);
    expect(fn2).toMatch(/^shot_01_\d+_[a-z0-9]+\.png$/);
    expect(fn1).not.toBe(fn2);
  });

  it('creates complete project subdirectory hierarchy on disk', () => {
    const dir = ensureProjectStorage(testProjectId);
    expect(fs.existsSync(dir)).toBe(true);

    for (const subdir of PROJECT_SUBDIRECTORIES) {
      const subPath = path.join(dir, subdir);
      expect(fs.existsSync(subPath)).toBe(true);
    }
  });

  it('saves and reads project.json manifest correctly', async () => {
    const manifest = {
      test: true,
      name: 'Test Project',
      timestamp: Date.now(),
    };

    const savedPath = await saveProjectManifest(testProjectId, manifest);
    expect(fs.existsSync(savedPath)).toBe(true);

    const loaded = await readProjectManifest(testProjectId);
    expect(loaded).toEqual(manifest);
  });
});
