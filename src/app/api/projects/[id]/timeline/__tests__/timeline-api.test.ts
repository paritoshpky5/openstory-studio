import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { GET, PUT, DELETE } from '../route';
import { POST as resetPOST } from '../reset/route';
import { TimelineComposition } from '@/types/timeline';

describe('Timeline API Routes & Project Boundary Protection', () => {
  const testProjectId = `test_api_tl_${Date.now()}`;
  const otherProjectId = `other_proj_tl_${Date.now()}`;
  let validSceneId: string;
  let otherSceneId: string;

  beforeAll(async () => {
    // 1. Create main project
    await prisma.project.create({
      data: {
        id: testProjectId,
        name: 'API Timeline Test',
      },
    });

    const scene = await prisma.scene.create({
      data: {
        projectId: testProjectId,
        sceneNumber: 1,
        title: 'Scene One',
        durationSeconds: 4.0,
        location: 'Interior',
        timeOfDay: 'NIGHT',
        environment: 'INDOOR',
        lighting: 'DIM',
        mood: 'DRAMATIC',
        summary: 'Scene one summary',
      },
    });
    validSceneId = scene.id;

    // 2. Create another project to test cross-project boundary protection
    await prisma.project.create({
      data: {
        id: otherProjectId,
        name: 'Other Project',
      },
    });

    const otherScene = await prisma.scene.create({
      data: {
        projectId: otherProjectId,
        sceneNumber: 1,
        title: 'Other Scene',
        durationSeconds: 4.0,
        location: 'Exterior',
        timeOfDay: 'DAY',
        environment: 'OUTDOOR',
        lighting: 'BRIGHT',
        mood: 'HAPPY',
        summary: 'Other scene summary',
      },
    });
    otherSceneId = otherScene.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: testProjectId } }).catch(() => undefined);
    await prisma.project.delete({ where: { id: otherProjectId } }).catch(() => undefined);
  });

  it('GET returns deterministic default timeline when none is saved yet', async () => {
    const req = new NextRequest(`http://localhost:3000/api/projects/${testProjectId}/timeline`);
    const res = await GET(req, { params: Promise.resolve({ id: testProjectId }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.isDefault).toBe(true);
    expect(data.timeline.tracks.length).toBeGreaterThan(0);
  });

  it('PUT rejects referenced scene from another project (project boundary protection)', async () => {
    const maliciousPayload: TimelineComposition = {
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
              sceneId: otherSceneId, // Alien scene from otherProjectId!
              startTime: 0,
              duration: 4.0,
              trimIn: 0,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Alien Clip',
              assetType: 'VIDEO',
            },
          ],
        },
      ],
    };

    const req = new NextRequest(`http://localhost:3000/api/projects/${testProjectId}/timeline`, {
      method: 'PUT',
      body: JSON.stringify(maliciousPayload),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: testProjectId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid scene reference');
  });

  it('PUT rejects path traversal attempts in clips', async () => {
    const traversalPayload: TimelineComposition = {
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
              sceneId: validSceneId,
              sourceFilePath: '../../../../etc/passwd', // Traversal attempt!
              startTime: 0,
              duration: 4.0,
              trimIn: 0,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Traversal Clip',
              assetType: 'VIDEO',
            },
          ],
        },
      ],
    };

    const req = new NextRequest(`http://localhost:3000/api/projects/${testProjectId}/timeline`, {
      method: 'PUT',
      body: JSON.stringify(traversalPayload),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: testProjectId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Unsafe path in timeline clip');
  });

  it('PUT saves valid timeline and GET retrieves the saved composition', async () => {
    const validPayload: TimelineComposition = {
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
              sceneId: validSceneId,
              sourceFilePath: `projects/${testProjectId}/video/s1.mp4`,
              startTime: 0,
              duration: 4.0,
              trimIn: 0,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Valid Clip',
              assetType: 'VIDEO',
            },
          ],
        },
      ],
    };

    // Save
    const putReq = new NextRequest(`http://localhost:3000/api/projects/${testProjectId}/timeline`, {
      method: 'PUT',
      body: JSON.stringify(validPayload),
    });
    const putRes = await PUT(putReq, { params: Promise.resolve({ id: testProjectId }) });
    expect(putRes.status).toBe(200);

    // Retrieve
    const getReq = new NextRequest(`http://localhost:3000/api/projects/${testProjectId}/timeline`);
    const getRes = await GET(getReq, { params: Promise.resolve({ id: testProjectId }) });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.isDefault).toBe(false);
    expect(getData.timeline.tracks[0].clips[0].label).toBe('Valid Clip');
  });

  it('POST /reset rebuilds timeline layout to project defaults', async () => {
    const req = new NextRequest(`http://localhost:3000/api/projects/${testProjectId}/timeline/reset`, {
      method: 'POST',
    });
    const res = await resetPOST(req, { params: Promise.resolve({ id: testProjectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.timeline.tracks.length).toBeGreaterThan(0);
  });

  it('DELETE removes the saved timeline composition', async () => {
    const req = new NextRequest(`http://localhost:3000/api/projects/${testProjectId}/timeline`, {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: testProjectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const saved = await prisma.timeline.findUnique({
      where: { projectId: testProjectId },
    });
    expect(saved).toBeNull();
  });
});
