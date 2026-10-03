import { describe, it, expect } from 'vitest';
import {
  TimelineClipSchema,
  TimelineCompositionSchema,
  TimelineComposition,
} from '@/types/timeline';
import {
  timeToPixels,
  pixelsToTime,
  buildSnapPoints,
  resolveTimelineSnap,
  getRulerConfig,
  formatTimecode,
  formatRulerLabel,
  canPlaceClipOnTrack,
} from '../timeline-math';

describe('Timeline Schema Validation', () => {
  it('validates a correct timeline composition', () => {
    const validComp: TimelineComposition = {
      version: 1,
      projectId: 'proj_123',
      fps: 24,
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
              startTime: 4.5,
              duration: 5.5,
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

    const parsed = TimelineCompositionSchema.parse(validComp);
    expect(parsed.projectId).toBe('proj_123');
    expect(parsed.tracks[0].clips).toHaveLength(2);
  });

  it('rejects negative startTime and zero/negative duration', () => {
    expect(() =>
      TimelineClipSchema.parse({
        id: 'c1',
        trackId: 't1',
        startTime: -1,
        duration: 4.0,
        label: 'Bad Start',
        assetType: 'VIDEO',
      })
    ).toThrow();

    expect(() =>
      TimelineClipSchema.parse({
        id: 'c2',
        trackId: 't1',
        startTime: 0,
        duration: 0,
        label: 'Zero Duration',
        assetType: 'VIDEO',
      })
    ).toThrow();
  });

  it('rejects trims exceeding sourceDuration', () => {
    expect(() =>
      TimelineClipSchema.parse({
        id: 'c3',
        trackId: 't1',
        startTime: 0,
        duration: 6.0,
        trimIn: 2.0,
        trimOut: 0,
        sourceDuration: 5.0, // trimIn (2) + duration (6) = 8 > sourceDuration (5)
        label: 'Trim Exceeds Source',
        assetType: 'VIDEO',
      })
    ).toThrow();
  });

  it('rejects overlapping video clips on primary VIDEO track', () => {
    const overlappingComp = {
      version: 1,
      projectId: 'proj_123',
      fps: 24,
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
              startTime: 0,
              duration: 4.0,
              label: 'Clip 1',
              assetType: 'VIDEO',
            },
            {
              id: 'c2',
              trackId: 'v1',
              startTime: 3.5, // Overlaps with c1 (0 to 4.0)
              duration: 4.0,
              label: 'Clip 2',
              assetType: 'VIDEO',
            },
          ],
        },
      ],
    };

    expect(() => TimelineCompositionSchema.parse(overlappingComp)).toThrow(
      /Clips on the primary VIDEO track cannot overlap/
    );
  });
});

describe('Timeline Math & Conversion', () => {
  it('converts time to pixels and back accurately', () => {
    const time = 5.5;
    const zoom = 1.5;
    const pixels = timeToPixels(time, zoom);
    const convertedTime = pixelsToTime(pixels, zoom);

    expect(pixels).toBe(5.5 * 60 * 1.5);
    expect(convertedTime).toBeCloseTo(time, 4);
  });

  it('formats timecode correctly', () => {
    expect(formatTimecode(0)).toBe('00:00.0');
    expect(formatTimecode(65.4)).toBe('01:05.4');
    expect(formatRulerLabel(0)).toBe('00:00');
    expect(formatRulerLabel(4.5)).toBe('00:04.5');
  });

  it('calculates ruler tick intervals cleanly', () => {
    const ruler1 = getRulerConfig({ zoomLevel: 1.0, fps: 24 });
    expect(ruler1.labelIntervalSeconds).toBeGreaterThan(0);
    expect(ruler1.tickIntervalSeconds).toBeGreaterThan(0);
    // tick interval must divide label interval
    expect(
      Math.round(ruler1.labelIntervalSeconds * 1000) %
        Math.round(ruler1.tickIntervalSeconds * 1000)
    ).toBe(0);
  });
});

describe('Snapping Logic', () => {
  const mockTracks: any[] = [
    {
      id: 'v1',
      type: 'VIDEO',
      clips: [
        { id: 'c1', startTime: 2.0, duration: 4.0, label: 'Clip 1' },
        { id: 'c2', startTime: 8.0, duration: 3.0, label: 'Clip 2' },
      ],
    },
  ];

  it('builds snap points from clips, playhead, and scene boundaries', () => {
    const snapPoints = buildSnapPoints({
      tracks: mockTracks,
      playheadTime: 1.5,
      sceneBoundaries: [0, 5.0],
      excludeClipId: 'c1',
    });

    const times = snapPoints.map((s) => s.time);
    expect(times).toContain(1.5); // Playhead
    expect(times).toContain(0); // Scene boundary
    expect(times).toContain(5.0); // Scene boundary
    expect(times).toContain(8.0); // c2 start
    expect(times).toContain(11.0); // c2 end
    expect(times).not.toContain(2.0); // c1 start excluded
  });

  it('snaps to nearest point within threshold and ignores points outside threshold', () => {
    const snapPoints = [
      { time: 2.0, type: 'clip-start' as const },
      { time: 6.0, type: 'clip-end' as const },
    ];

    // Inside threshold (0.2s max distance)
    const result1 = resolveTimelineSnap({
      targetTime: 2.08,
      snapPoints,
      maxSnapDistance: 0.15,
    });
    expect(result1.snappedTime).toBe(2.0);
    expect(result1.snapPoint?.time).toBe(2.0);

    // Outside threshold
    const result2 = resolveTimelineSnap({
      targetTime: 2.4,
      snapPoints,
      maxSnapDistance: 0.15,
    });
    expect(result2.snappedTime).toBe(2.4);
    expect(result2.snapPoint).toBeNull();
  });
});

describe('Collision & Placement', () => {
  const track: any = {
    id: 'v1',
    type: 'VIDEO',
    clips: [
      { id: 'c1', startTime: 0, duration: 4.0 },
      { id: 'c2', startTime: 6.0, duration: 4.0 },
    ],
  };

  it('allows placement in empty gaps without overlap', () => {
    expect(
      canPlaceClipOnTrack({
        track,
        clipId: 'new_clip',
        startTime: 4.0,
        duration: 2.0,
      })
    ).toBe(true);

    expect(
      canPlaceClipOnTrack({
        track,
        clipId: 'new_clip',
        startTime: 10.0,
        duration: 3.0,
      })
    ).toBe(true);
  });

  it('rejects placement that overlaps existing clips', () => {
    expect(
      canPlaceClipOnTrack({
        track,
        clipId: 'new_clip',
        startTime: 2.0,
        duration: 3.0,
      })
    ).toBe(false);

    expect(
      canPlaceClipOnTrack({
        track,
        clipId: 'new_clip',
        startTime: 5.5,
        duration: 2.0,
      })
    ).toBe(false);
  });
});
