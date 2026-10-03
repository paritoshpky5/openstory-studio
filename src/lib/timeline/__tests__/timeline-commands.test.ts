import { describe, it, expect } from 'vitest';
import { TimelineComposition } from '@/types/timeline';
import {
  moveClip,
  trimClip,
  deleteClip,
  toggleTrackMute,
  setClipVolume,
  TimelineHistoryManager,
} from '../timeline-commands';

function createMockComposition(): TimelineComposition {
  return {
    version: 1,
    projectId: 'test_p1',
    fps: 24,
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    totalDuration: 15.0,
    tracks: [
      {
        id: 'v1',
        type: 'VIDEO',
        name: 'Video (V1)',
        order: 0,
        muted: false,
        volume: 1.0,
        clips: [
          {
            id: 'vc1',
            trackId: 'v1',
            startTime: 0,
            duration: 5.0,
            trimIn: 0,
            trimOut: 0,
            sourceDuration: 10.0,
            volume: 1.0,
            muted: false,
            label: 'Scene 1',
            assetType: 'VIDEO',
          },
          {
            id: 'vc2',
            trackId: 'v1',
            startTime: 6.0,
            duration: 4.0,
            trimIn: 0,
            trimOut: 0,
            sourceDuration: 10.0,
            volume: 1.0,
            muted: false,
            label: 'Scene 2',
            assetType: 'VIDEO',
          },
        ],
      },
      {
        id: 'a1',
        type: 'NARRATION',
        name: 'Narration (A1)',
        order: 1,
        muted: false,
        volume: 1.0,
        clips: [
          {
            id: 'ac1',
            trackId: 'a1',
            startTime: 0.5,
            duration: 4.0,
            trimIn: 0,
            trimOut: 0,
            volume: 1.0,
            muted: false,
            label: 'Voice 1',
            assetType: 'NARRATION',
          },
        ],
      },
    ],
  };
}

describe('Timeline Commands', () => {
  it('moves a clip to a valid new start time', () => {
    const comp = createMockComposition();
    const updated = moveClip(comp, {
      clipId: 'vc2',
      newStartTime: 7.5,
    });

    const clip = updated.tracks[0].clips.find((c) => c.id === 'vc2');
    expect(clip?.startTime).toBe(7.5);
  });

  it('prevents moving a video clip into collision with another video clip', () => {
    const comp = createMockComposition();
    // vc1 is 0 to 5.0. Trying to move vc2 to 3.0 should be rejected!
    const updated = moveClip(comp, {
      clipId: 'vc2',
      newStartTime: 3.0,
    });

    // Should return original composition unchanged due to collision
    const clip = updated.tracks[0].clips.find((c) => c.id === 'vc2');
    expect(clip?.startTime).toBe(6.0);
  });

  it('clamps moving to non-negative start time', () => {
    const comp = createMockComposition();
    const updated = moveClip(comp, {
      clipId: 'ac1',
      newStartTime: -5.0,
    });

    const clip = updated.tracks[1].clips.find((c) => c.id === 'ac1');
    expect(clip?.startTime).toBe(0);
  });

  it('trims left edge (trim-in) correctly', () => {
    const comp = createMockComposition();
    // vc1 start=0, duration=5.0, trimIn=0. Trim in by 1s:
    const updated = trimClip(comp, {
      clipId: 'vc1',
      newStartTime: 1.0,
      newDuration: 4.0,
      newTrimIn: 1.0,
    });

    const clip = updated.tracks[0].clips.find((c) => c.id === 'vc1');
    expect(clip?.startTime).toBe(1.0);
    expect(clip?.duration).toBe(4.0);
    expect(clip?.trimIn).toBe(1.0);
  });

  it('trims right edge (trim-out) and rejects trims exceeding source duration', () => {
    const comp = createMockComposition();
    // vc1 sourceDuration=10.0. Trying duration=12.0 must be rejected
    const rejected = trimClip(comp, {
      clipId: 'vc1',
      newStartTime: 0,
      newDuration: 12.0,
      newTrimIn: 0,
    });

    expect(rejected.tracks[0].clips.find((c) => c.id === 'vc1')?.duration).toBe(5.0);

    // Valid expansion to 8.0s
    const valid = trimClip(comp, {
      clipId: 'vc1',
      newStartTime: 0,
      newDuration: 5.5, // 5.5 + gap to vc2 at 6.0 is fine
      newTrimIn: 0,
    });
    expect(valid.tracks[0].clips.find((c) => c.id === 'vc1')?.duration).toBe(5.5);
  });

  it('deletes a clip and updates composition', () => {
    const comp = createMockComposition();
    const updated = deleteClip(comp, { clipId: 'vc2' });

    expect(updated.tracks[0].clips).toHaveLength(1);
    expect(updated.tracks[0].clips.find((c) => c.id === 'vc2')).toBeUndefined();
  });

  it('toggles track muted state and clip volume', () => {
    const comp = createMockComposition();
    const muted = toggleTrackMute(comp, { trackId: 'v1' });
    expect(muted.tracks[0].muted).toBe(true);

    const unmuted = toggleTrackMute(muted, { trackId: 'v1' });
    expect(unmuted.tracks[0].muted).toBe(false);

    const withVolume = setClipVolume(comp, { clipId: 'ac1', volume: 1.5 });
    const clip = withVolume.tracks[1].clips.find((c) => c.id === 'ac1');
    expect(clip?.volume).toBe(1.5);
  });
});

describe('Timeline History Manager (Undo/Redo)', () => {
  it('manages undo and redo stacks correctly across multiple operations', () => {
    const initial = createMockComposition();
    const manager = new TimelineHistoryManager(initial);

    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);

    // Operation 1: move vc2 to 8.0
    const state1 = moveClip(initial, { clipId: 'vc2', newStartTime: 8.0 });
    manager.push(state1);

    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
    expect(manager.getState().tracks[0].clips.find((c) => c.id === 'vc2')?.startTime).toBe(8.0);

    // Operation 2: delete ac1
    const state2 = deleteClip(state1, { clipId: 'ac1' });
    manager.push(state2);

    expect(manager.getState().tracks[1].clips).toHaveLength(0);

    // Undo operation 2
    const undone1 = manager.undo();
    expect(undone1.tracks[1].clips).toHaveLength(1);
    expect(manager.canRedo()).toBe(true);

    // Undo operation 1
    const undone2 = manager.undo();
    expect(undone2.tracks[0].clips.find((c) => c.id === 'vc2')?.startTime).toBe(6.0);
    expect(manager.canUndo()).toBe(false);

    // Redo operation 1
    const redone1 = manager.redo();
    expect(redone1.tracks[0].clips.find((c) => c.id === 'vc2')?.startTime).toBe(8.0);
    expect(manager.canUndo()).toBe(true);

    // Making a new operation after undo clears redo stack
    const state3 = toggleTrackMute(redone1, { trackId: 'v1' });
    manager.push(state3);
    expect(manager.canRedo()).toBe(false);
  });
});
