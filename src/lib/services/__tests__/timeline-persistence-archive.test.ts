import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/db/prisma';
import { ProjectArchiveService } from '../project-archive-service';
import { TimelineComposition } from '@/types/timeline';

describe('Timeline Persistence and Archive Compatibility', () => {
  const testProjectId = `test_arch_timeline_${Date.now()}`;
  let importedProjectId: string | null = null;
  let sceneId: string;
  let shotId: string;
  let assetId: string;

  beforeAll(async () => {
    // 1. Create project
    await prisma.project.create({
      data: {
        id: testProjectId,
        name: 'Archive Timeline Test',
        aspectRatio: '16:9',
        fps: 24,
      },
    });

    // 2. Create scene & shot
    const scene = await prisma.scene.create({
      data: {
        projectId: testProjectId,
        sceneNumber: 1,
        title: 'Opening',
        durationSeconds: 4.0,
        location: 'Forest',
        timeOfDay: 'DAY',
        environment: 'OUTDOOR',
        lighting: 'NATURAL',
        mood: 'PEACEFUL',
        summary: 'A quiet morning in the forest',
      },
    });
    sceneId = scene.id;

    const shot = await prisma.shot.create({
      data: {
        sceneId: scene.id,
        shotNumber: 1,
        description: 'First shot',
        duration: 4.0,
      },
    });
    shotId = shot.id;

    // 3. Create asset version
    const asset = await prisma.assetVersion.create({
      data: {
        projectId: testProjectId,
        sceneId: scene.id,
        shotId: shot.id,
        assetType: 'VIDEO',
        provider: 'LOCAL',
        modelId: 'TEST',
        channel: 'LOCAL',
        filePath: `projects/${testProjectId}/video/shot1.mp4`,
        mimeType: 'video/mp4',
        duration: 4.0,
        prompt: 'Scene 1',
        isActive: true,
        settings: '{}',
      },
    });
    assetId = asset.id;

    // 4. Save a timeline composition in DB
    const timelineData: TimelineComposition = {
      version: 1,
      projectId: testProjectId,
      fps: 24,
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      totalDuration: 4.0,
      tracks: [
        {
          id: 'v1',
          type: 'VIDEO',
          name: 'Video',
          order: 0,
          muted: false,
          volume: 1.0,
          clips: [
            {
              id: 'c1',
              trackId: 'v1',
              sceneId: scene.id,
              shotId: shot.id,
              assetVersionId: asset.id,
              sourceFilePath: asset.filePath,
              startTime: 0,
              duration: 4.0,
              trimIn: 0,
              trimOut: 0,
              sourceDuration: 4.0,
              volume: 1.0,
              muted: false,
              label: 'Scene 1',
              assetType: 'VIDEO',
            },
          ],
        },
      ],
    };

    await prisma.timeline.create({
      data: {
        projectId: testProjectId,
        version: 1,
        data: JSON.stringify(timelineData),
      },
    });
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: testProjectId } }).catch(() => undefined);
    if (importedProjectId) {
      await prisma.project.delete({ where: { id: importedProjectId } }).catch(() => undefined);
    }
  });

  it('persists and retrieves timeline composition from Prisma', async () => {
    const saved = await prisma.timeline.findUnique({
      where: { projectId: testProjectId },
    });

    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!.data);
    expect(parsed.projectId).toBe(testProjectId);
    expect(parsed.tracks[0].clips[0].sceneId).toBe(sceneId);
  });

  it('exports timeline data in project ZIP and remaps identifiers upon import', async () => {
    // Export ZIP
    const { zipBuffer } = await ProjectArchiveService.exportProjectZip(testProjectId);
    expect(zipBuffer.length).toBeGreaterThan(0);

    // Import ZIP into a new project
    const importResult = await ProjectArchiveService.importProjectZip(zipBuffer);
    importedProjectId = importResult.projectId;
    expect(importedProjectId).not.toBe(testProjectId);

    // Verify imported timeline exists in database
    const importedTimeline = await prisma.timeline.findUnique({
      where: { projectId: importedProjectId },
    });
    expect(importedTimeline).not.toBeNull();

    const restoredData: TimelineComposition = JSON.parse(importedTimeline!.data);
    expect(restoredData.projectId).toBe(importedProjectId);

    const clip = restoredData.tracks[0].clips[0];
    // Must be remapped to new scene, shot, and asset IDs!
    expect(clip.sceneId).not.toBe(sceneId);
    expect(clip.shotId).not.toBe(shotId);
    expect(clip.assetVersionId).not.toBe(assetId);

    // Verify remapped scene actually exists in new project
    const restoredScene = await prisma.scene.findUnique({
      where: { id: clip.sceneId! },
    });
    expect(restoredScene?.projectId).toBe(importedProjectId);

    // Verify remapped file path contains new project ID
    expect(clip.sourceFilePath).toContain(importedProjectId);
  });

  it('imports legacy archive without timeline data cleanly (backward compatibility)', async () => {
    // Create a mock manifest without timeline property
    const legacyManifest = {
      format: 'openstory-archive',
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      project: {
        name: 'Legacy Project',
        aspectRatio: '16:9',
        fps: 24,
      },
      scenes: [
        {
          id: 'old_s1',
          sceneNumber: 1,
          title: 'Legacy Scene',
          durationSeconds: 4.0,
          location: 'Studio',
          timeOfDay: 'DAY',
          environment: 'INDOOR',
          lighting: 'STUDIO',
          mood: 'NEUTRAL',
          summary: 'A legacy scene test',
        },
      ],
      allAssetVersions: [],
      characters: [],
      pronunciations: [],
      // Notice: NO timeline property!
    };

    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('project.json', Buffer.from(JSON.stringify(legacyManifest), 'utf-8'));

    const zipBuffer = zip.toBuffer();
    const result = await ProjectArchiveService.importProjectZip(zipBuffer);

    expect(result.projectId).toBeDefined();

    // Verify legacy project imported successfully and has no error
    const importedProj = await prisma.project.findUnique({
      where: { id: result.projectId },
      include: { timeline: true },
    });
    expect(importedProj).not.toBeNull();
    expect(importedProj?.timeline).toBeNull(); // Legacy project starts with null timeline, ready for automatic generation!

    // Cleanup
    await prisma.project.delete({ where: { id: result.projectId } }).catch(() => undefined);
  });
});
