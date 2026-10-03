import { TimelineComposition, TimelineTrack, TimelineClip } from '@/types/timeline';
import { canPlaceClipOnTrack, calculateTotalDuration } from './timeline-math';

export interface MoveClipPayload {
  clipId: string;
  targetTrackId?: string;
  newStartTime: number;
}

export interface TrimClipPayload {
  clipId: string;
  newStartTime: number;
  newDuration: number;
  newTrimIn: number;
  newTrimOut?: number;
}

export interface DeleteClipPayload {
  clipId: string;
}

export interface ToggleTrackMutePayload {
  trackId: string;
}

export interface SetTrackVolumePayload {
  trackId: string;
  volume: number;
}

export interface SetClipVolumePayload {
  clipId: string;
  volume: number;
}

/**
 * Deep clones a timeline composition immutably.
 */
export function cloneComposition(comp: TimelineComposition): TimelineComposition {
  return JSON.parse(JSON.stringify(comp));
}

/**
 * Moves a clip to a new start time (and optionally across compatible tracks).
 */
export function moveClip(
  comp: TimelineComposition,
  payload: MoveClipPayload
): TimelineComposition {
  const { clipId, targetTrackId, newStartTime } = payload;
  const next = cloneComposition(comp);

  let sourceTrack: TimelineTrack | undefined;
  let targetClip: TimelineClip | undefined;

  for (const track of next.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) {
      sourceTrack = track;
      targetClip = found;
      break;
    }
  }

  if (!sourceTrack || !targetClip) return comp;

  const targetTrack = targetTrackId
    ? next.tracks.find((t) => t.id === targetTrackId) || sourceTrack
    : sourceTrack;

  // Validate non-negative time
  const clampedStartTime = Math.max(0, newStartTime);

  // If VIDEO track, enforce no overlap
  if (targetTrack.type === 'VIDEO') {
    const canPlace = canPlaceClipOnTrack({
      track: targetTrack,
      clipId: targetClip.id,
      startTime: clampedStartTime,
      duration: targetClip.duration,
    });
    if (!canPlace) {
      return comp; // Collision prevented
    }
  }

  // Update clip
  targetClip.startTime = Math.round(clampedStartTime * 1000) / 1000;

  if (targetTrack.id !== sourceTrack.id) {
    sourceTrack.clips = sourceTrack.clips.filter((c) => c.id !== clipId);
    targetClip.trackId = targetTrack.id;
    targetTrack.clips.push(targetClip);
  }

  next.totalDuration = calculateTotalDuration(next.tracks);
  next.updatedAt = new Date().toISOString();
  return next;
}

/**
 * Trims a clip's start, duration, and in/out points.
 */
export function trimClip(
  comp: TimelineComposition,
  payload: TrimClipPayload
): TimelineComposition {
  const { clipId, newStartTime, newDuration, newTrimIn, newTrimOut = 0 } = payload;
  const next = cloneComposition(comp);

  let parentTrack: TimelineTrack | undefined;
  let targetClip: TimelineClip | undefined;

  for (const track of next.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) {
      parentTrack = track;
      targetClip = found;
      break;
    }
  }

  if (!parentTrack || !targetClip) return comp;

  const safeStartTime = Math.max(0, newStartTime);
  const safeDuration = Math.max(0.1, newDuration);
  const safeTrimIn = Math.max(0, newTrimIn);
  const safeTrimOut = Math.max(0, newTrimOut);

  // Respect source duration boundary
  if (targetClip.sourceDuration && targetClip.sourceDuration > 0) {
    if (safeTrimIn + safeDuration > targetClip.sourceDuration + 0.05) {
      return comp;
    }
  }

  // If VIDEO track, check overlap with neighbors
  if (parentTrack.type === 'VIDEO') {
    const canPlace = canPlaceClipOnTrack({
      track: parentTrack,
      clipId: targetClip.id,
      startTime: safeStartTime,
      duration: safeDuration,
    });
    if (!canPlace) return comp;
  }

  targetClip.startTime = Math.round(safeStartTime * 1000) / 1000;
  targetClip.duration = Math.round(safeDuration * 1000) / 1000;
  targetClip.trimIn = Math.round(safeTrimIn * 1000) / 1000;
  targetClip.trimOut = Math.round(safeTrimOut * 1000) / 1000;

  next.totalDuration = calculateTotalDuration(next.tracks);
  next.updatedAt = new Date().toISOString();
  return next;
}

/**
 * Deletes a clip from the composition.
 */
export function deleteClip(
  comp: TimelineComposition,
  payload: DeleteClipPayload
): TimelineComposition {
  const { clipId } = payload;
  const next = cloneComposition(comp);

  for (const track of next.tracks) {
    track.clips = track.clips.filter((c) => c.id !== clipId);
  }

  next.totalDuration = calculateTotalDuration(next.tracks);
  next.updatedAt = new Date().toISOString();
  return next;
}

/**
 * Toggles the muted state of an entire track.
 */
export function toggleTrackMute(
  comp: TimelineComposition,
  payload: ToggleTrackMutePayload
): TimelineComposition {
  const { trackId } = payload;
  const next = cloneComposition(comp);

  const track = next.tracks.find((t) => t.id === trackId);
  if (track) {
    track.muted = !track.muted;
    next.updatedAt = new Date().toISOString();
  }

  return next;
}

/**
 * Sets volume of a track.
 */
export function setTrackVolume(
  comp: TimelineComposition,
  payload: SetTrackVolumePayload
): TimelineComposition {
  const { trackId, volume } = payload;
  const next = cloneComposition(comp);

  const track = next.tracks.find((t) => t.id === trackId);
  if (track) {
    track.volume = Math.max(0, Math.min(2.0, volume));
    next.updatedAt = new Date().toISOString();
  }

  return next;
}

/**
 * Sets volume of an individual clip.
 */
export function setClipVolume(
  comp: TimelineComposition,
  payload: SetClipVolumePayload
): TimelineComposition {
  const { clipId, volume } = payload;
  const next = cloneComposition(comp);

  for (const track of next.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) {
      clip.volume = Math.max(0, Math.min(2.0, volume));
      next.updatedAt = new Date().toISOString();
      break;
    }
  }

  return next;
}

/**
 * Timeline Command History Stack for undo/redo.
 */
export class TimelineHistoryManager {
  private past: TimelineComposition[] = [];
  private present: TimelineComposition;
  private future: TimelineComposition[] = [];
  private maxHistory: number;

  constructor(initialState: TimelineComposition, maxHistory = 50) {
    this.present = cloneComposition(initialState);
    this.maxHistory = maxHistory;
  }

  getState(): TimelineComposition {
    return this.present;
  }

  push(nextState: TimelineComposition): void {
    this.past.push(this.present);
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.present = cloneComposition(nextState);
    this.future = [];
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): TimelineComposition {
    if (!this.canUndo()) return this.present;
    const previous = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = previous;
    return this.present;
  }

  redo(): TimelineComposition {
    if (!this.canRedo()) return this.present;
    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;
    return this.present;
  }

  reset(newState: TimelineComposition): void {
    this.past = [];
    this.present = cloneComposition(newState);
    this.future = [];
  }
}
