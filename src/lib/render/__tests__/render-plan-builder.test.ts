import { describe, it, expect } from 'vitest';
import { TimelineComposition } from '@/types/timeline';
import { RenderPlanBuilder } from '../render-plan-builder';

const mockResolvers = {
  resolveMediaPath: (pId: string, relPath: string) => `/mock/storage/${relPath}`,
  fileExists: (absPath: string) => !absPath.includes('missing'),
};

describe('RenderPlanBuilder - Timeline Composition Mode', () => {
  it('builds a complete render plan from a multi-track timeline', () => {
    const timeline: TimelineComposition = {
      version: 1,
      projectId: 'proj_render_test',
      fps: 30,
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      totalDuration: 10.0,
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
              sourceFilePath: 'projects/proj_render_test/video/clip1.mp4',
              startTime: 0,
              duration: 4.0,
              trimIn: 0.5,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Clip 1',
              assetType: 'VIDEO',
            },
          ],
        },
        {
          id: 'a1',
          type: 'NARRATION',
          name: 'Narration',
          order: 1,
          muted: false,
          volume: 1.0,
          clips: [
            {
              id: 'ac1',
              trackId: 'a1',
              sourceFilePath: 'projects/proj_render_test/audio/narr.wav',
              startTime: 0.5,
              duration: 3.0,
              trimIn: 0,
              trimOut: 0,
              volume: 0.9,
              muted: false,
              label: 'Voice',
              assetType: 'NARRATION',
            },
          ],
        },
      ],
    };

    const plan = RenderPlanBuilder.buildFromTimeline(
      timeline,
      {
        projectId: 'proj_render_test',
        preset: 'YOUTUBE_1080',
        burnSubtitles: false,
      },
      mockResolvers
    );

    expect(plan.projectId).toBe('proj_render_test');
    expect(plan.width).toBe(1920);
    expect(plan.height).toBe(1080);
    expect(plan.fps).toBe(30);
    expect(plan.inputFiles).toHaveLength(2); // 1 video + 1 audio

    // Filtergraph check
    const filterStr = plan.filterGraph.join(';');
    expect(filterStr).toContain('trim=start=0.500:duration=4.000');
    expect(filterStr).toContain('tpad=stop_mode=clone:stop_duration=4.000');
    expect(filterStr).toContain('trim=duration=4.000');
    expect(filterStr).toContain('scale=1920:1080');
    expect(filterStr).toContain('adelay=500|500'); // 0.5s audio delay = 500ms
    expect(filterStr).toContain('volume=0.90');
    expect(filterStr).toContain('amix=inputs=1');
  });

  it('handles intentional gaps in video tracks by synthesizing black video filler', () => {
    const timelineWithGap: TimelineComposition = {
      version: 1,
      projectId: 'proj_gap_test',
      fps: 24,
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      totalDuration: 12.0,
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
              sourceFilePath: 'projects/proj_gap_test/video/clip1.mp4',
              startTime: 0,
              duration: 4.0,
              trimIn: 0,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Clip 1',
              assetType: 'VIDEO',
            },
            {
              id: 'c2',
              trackId: 'v1',
              sourceFilePath: 'projects/proj_gap_test/video/clip2.mp4',
              startTime: 7.0, // 3-second gap between 4.0 and 7.0!
              duration: 5.0,
              trimIn: 0,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Clip 2',
              assetType: 'VIDEO',
            },
          ],
        },
      ],
    };

    const plan = RenderPlanBuilder.buildFromTimeline(
      timelineWithGap,
      {
        projectId: 'proj_gap_test',
        preset: 'YOUTUBE_1080',
        burnSubtitles: false,
      },
      mockResolvers
    );

    // Should have 3 video segments: clip1, gap (3.0s), clip2
    expect(plan.videoSegments).toHaveLength(3);
    expect(plan.videoSegments[1].isGap).toBe(true);
    expect(plan.videoSegments[1].duration).toBeCloseTo(3.0, 2);

    const filterStr = plan.filterGraph.join(';');
    expect(filterStr).toContain('color=c=black:s=1920x1080:d=3.000,fps=30[v1]');
    expect(filterStr).toContain('concat=n=3:v=1:a=0[vout_base]');
  });

  it('respects track mute and ignores muted audio/video clips', () => {
    const timelineMuted: TimelineComposition = {
      version: 1,
      projectId: 'proj_mute_test',
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
              sourceFilePath: 'projects/proj_mute_test/video/clip1.mp4',
              startTime: 0,
              duration: 4.0,
              trimIn: 0,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Clip 1',
              assetType: 'VIDEO',
            },
          ],
        },
        {
          id: 'a1',
          type: 'SFX',
          name: 'SFX',
          order: 1,
          muted: true, // Entire track muted!
          volume: 1.0,
          clips: [
            {
              id: 's1',
              trackId: 'a1',
              sourceFilePath: 'projects/proj_mute_test/audio/boom.wav',
              startTime: 1.0,
              duration: 2.0,
              trimIn: 0,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Boom',
              assetType: 'SFX',
            },
          ],
        },
      ],
    };

    const plan = RenderPlanBuilder.buildFromTimeline(
      timelineMuted,
      {
        projectId: 'proj_mute_test',
        preset: 'YOUTUBE_1080',
        burnSubtitles: false,
      },
      mockResolvers
    );

    // Muted track clips should not be in audioSegments or inputs
    expect(plan.audioSegments).toHaveLength(0);
    expect(plan.inputFiles).toHaveLength(1); // Only the video file
    // Filtergraph should generate silence for audio
    const filterStr = plan.filterGraph.join(';');
    expect(filterStr).toContain('anullsrc=channel_layout=stereo:sample_rate=48000');
  });

  it('supports different export presets (4K, Shorts 9:16, Preview)', () => {
    const timeline: TimelineComposition = {
      version: 1,
      projectId: 'proj_preset_test',
      fps: 24,
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
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
              sourceFilePath: 'projects/proj_preset_test/video/v.mp4',
              startTime: 0,
              duration: 4.0,
              trimIn: 0,
              trimOut: 0,
              volume: 1.0,
              muted: false,
              label: 'Clip',
              assetType: 'VIDEO',
            },
          ],
        },
      ],
    };

    const shortsPlan = RenderPlanBuilder.buildFromTimeline(
      timeline,
      { projectId: 'proj_preset_test', preset: 'SHORTS_1080', burnSubtitles: false },
      mockResolvers
    );
    expect(shortsPlan.width).toBe(1080);
    expect(shortsPlan.height).toBe(1920);

    const k4Plan = RenderPlanBuilder.buildFromTimeline(
      timeline,
      { projectId: 'proj_preset_test', preset: 'YOUTUBE_4K', burnSubtitles: false },
      mockResolvers
    );
    expect(k4Plan.width).toBe(3840);
    expect(k4Plan.height).toBe(2160);
  });
});

describe('RenderPlanBuilder - Legacy Scene Fallback Mode', () => {
  it('builds sequential scene render plan without timeline data (backward compatibility)', () => {
    const mockScenes = [
      {
        id: 's1',
        sceneNumber: 1,
        durationSeconds: 4.0,
        assetVersions: [
          {
            assetType: 'VIDEO',
            filePath: 'projects/p_legacy/video/s1.mp4',
            duration: 4.0,
            isActive: true,
          },
          {
            assetType: 'NARRATION',
            filePath: 'projects/p_legacy/audio/n1.wav',
            duration: 3.5,
            isActive: true,
          },
        ],
      },
      {
        id: 's2',
        sceneNumber: 2,
        durationSeconds: 3.0,
        assetVersions: [
          {
            assetType: 'VIDEO',
            filePath: 'projects/p_legacy/video/s2.mp4',
            duration: 3.0,
            isActive: true,
          },
        ],
      },
    ];

    const plan = RenderPlanBuilder.buildFromScenes(
      mockScenes,
      {
        projectId: 'p_legacy',
        preset: 'YOUTUBE_1080',
        burnSubtitles: false,
      },
      mockResolvers
    );

    expect(plan.inputFiles).toHaveLength(3); // 2 video + 1 audio
    expect(plan.totalDuration).toBe(7.0);
    expect(plan.videoSegments[0].duration).toBe(4.0);
    expect(plan.videoSegments[1].duration).toBe(3.0);

    const filterStr = plan.filterGraph.join(';');
    expect(filterStr).toContain('concat=n=2:v=1:a=0[vout_base]');
    expect(filterStr).toContain('concat=n=2:v=0:a=1[aout_base]');
    expect(filterStr).toContain('tpad=stop_mode=clone:stop_duration=4.000');
    expect(filterStr).toContain('[2:a]');
  });

  it('keeps a longer planned scene when the provider video take is short', () => {
    const plan = RenderPlanBuilder.buildFromScenes(
      [{
        id: 's_short_source',
        sceneNumber: 1,
        durationSeconds: 9,
        assetVersions: [
          { assetType: 'VIDEO', filePath: 'projects/p/video/s.mp4', duration: 5, isActive: true },
          { assetType: 'NARRATION', filePath: 'projects/p/audio/s.wav', duration: 8, isActive: true },
        ],
      }],
      { projectId: 'p', preset: 'PREVIEW', burnSubtitles: false },
      mockResolvers
    );

    expect(plan.totalDuration).toBe(9);
    expect(plan.videoSegments[0].duration).toBe(9);
    expect(plan.filterGraph.join(';')).toContain('tpad=stop_mode=clone:stop_duration=9.000');
  });
});
