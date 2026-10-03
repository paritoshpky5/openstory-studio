import { TimelineTrack } from '@/types/timeline';

export const BASE_TIMELINE_PIXELS_PER_SECOND = 60;
export const MIN_TIMELINE_ZOOM = 0.2;
export const MAX_TIMELINE_ZOOM = 5.0;
export const DEFAULT_SNAP_THRESHOLD_PX = 10;

/**
 * Converts timeline time (seconds) to pixel position.
 */
export function timeToPixels(
  timeSeconds: number,
  zoomLevel: number,
  basePixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND
): number {
  return Math.max(0, timeSeconds) * basePixelsPerSecond * zoomLevel;
}

/**
 * Converts pixel position to timeline time (seconds).
 */
export function pixelsToTime(
  pixels: number,
  zoomLevel: number,
  basePixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND
): number {
  const pps = basePixelsPerSecond * zoomLevel;
  if (pps <= 0) return 0;
  return Math.max(0, pixels / pps);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function snapPixelToDeviceGrid(pixel: number, devicePixelRatio = 1): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.round(pixel * dpr) / dpr;
}

/**
 * Ruler subdivision intervals adapted from OpenCut Classic
 */
const LABEL_FRAME_INTERVALS = [2, 3, 5, 10, 15] as const;
const TICK_FRAME_INTERVALS = [1, 2, 3, 5, 10, 15] as const;
const SECOND_MULTIPLIERS = [
  1, 2, 3, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
] as const;

const MIN_LABEL_SPACING_PX = 100;
const MIN_TICK_SPACING_PX = 15;

export interface RulerConfig {
  labelIntervalSeconds: number;
  tickIntervalSeconds: number;
}

export function getRulerConfig({
  zoomLevel,
  fps = 24,
}: {
  zoomLevel: number;
  fps?: number;
}): RulerConfig {
  const safeFps = Math.max(1, fps);
  const pixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND * zoomLevel;
  const pixelsPerFrame = pixelsPerSecond / safeFps;

  const labelIntervalSeconds = findOptimalInterval({
    pixelsPerFrame,
    pixelsPerSecond,
    fps: safeFps,
    minSpacingPx: MIN_LABEL_SPACING_PX,
    frameIntervals: LABEL_FRAME_INTERVALS,
  });

  const rawTickIntervalSeconds = findOptimalInterval({
    pixelsPerFrame,
    pixelsPerSecond,
    fps: safeFps,
    minSpacingPx: MIN_TICK_SPACING_PX,
    frameIntervals: TICK_FRAME_INTERVALS,
  });

  const tickIntervalSeconds = ensureTickDividesLabel({
    tickIntervalSeconds: rawTickIntervalSeconds,
    labelIntervalSeconds,
    pixelsPerFrame,
    pixelsPerSecond,
    fps: safeFps,
  });

  return { labelIntervalSeconds, tickIntervalSeconds };
}

function findOptimalInterval({
  pixelsPerFrame,
  pixelsPerSecond,
  fps,
  minSpacingPx,
  frameIntervals,
}: {
  pixelsPerFrame: number;
  pixelsPerSecond: number;
  fps: number;
  minSpacingPx: number;
  frameIntervals: readonly number[];
}): number {
  for (const frameInterval of frameIntervals) {
    const pixelSpacing = pixelsPerFrame * frameInterval;
    if (pixelSpacing >= minSpacingPx) {
      return frameInterval / fps;
    }
  }

  for (const secondMultiplier of SECOND_MULTIPLIERS) {
    const pixelSpacing = pixelsPerSecond * secondMultiplier;
    if (pixelSpacing >= minSpacingPx) {
      return secondMultiplier;
    }
  }

  return 60;
}

function ensureTickDividesLabel({
  tickIntervalSeconds,
  labelIntervalSeconds,
  pixelsPerFrame,
  pixelsPerSecond,
  fps,
}: {
  tickIntervalSeconds: number;
  labelIntervalSeconds: number;
  pixelsPerFrame: number;
  pixelsPerSecond: number;
  fps: number;
}): number {
  const labelFrames = Math.round(labelIntervalSeconds * fps);
  const tickFrames = Math.round(tickIntervalSeconds * fps);

  if (tickFrames > 0 && labelFrames % tickFrames === 0) {
    return tickIntervalSeconds;
  }

  for (const candidateFrames of TICK_FRAME_INTERVALS) {
    if (labelFrames % candidateFrames === 0) {
      const candidateSpacing = pixelsPerFrame * candidateFrames;
      if (candidateSpacing >= MIN_TICK_SPACING_PX) {
        return candidateFrames / fps;
      }
    }
  }

  for (const candidateSeconds of SECOND_MULTIPLIERS) {
    const ratio = labelIntervalSeconds / candidateSeconds;
    if (Math.abs(ratio - Math.round(ratio)) < 0.0001) {
      const candidateSpacing = pixelsPerSecond * candidateSeconds;
      if (candidateSpacing >= MIN_TICK_SPACING_PX) {
        return candidateSeconds;
      }
    }
  }

  return labelIntervalSeconds;
}

export function formatTimecode(seconds: number): string {
  const totalSeconds = Math.max(0, seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export function formatRulerLabel(timeSeconds: number): string {
  const totalSeconds = Math.max(0, timeSeconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const frac = (totalSeconds % 1).toFixed(1);

  if (Math.abs(totalSeconds - Math.round(totalSeconds)) < 0.001) {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${frac.slice(1)}`;
}

/**
 * Snapping calculations adapted from OpenCut
 */
export type SnapPointType = 'playhead' | 'clip-start' | 'clip-end' | 'scene-boundary';

export interface SnapPoint {
  time: number;
  type: SnapPointType;
  clipId?: string;
  trackId?: string;
  label?: string;
}

export interface SnapResult {
  snappedTime: number;
  snapPoint: SnapPoint | null;
  snapDistance: number;
}

export function buildSnapPoints({
  tracks,
  playheadTime,
  sceneBoundaries = [],
  excludeClipId,
}: {
  tracks: TimelineTrack[];
  playheadTime?: number;
  sceneBoundaries?: number[];
  excludeClipId?: string;
}): SnapPoint[] {
  const snapPoints: SnapPoint[] = [];

  if (playheadTime !== undefined && playheadTime >= 0) {
    snapPoints.push({
      time: playheadTime,
      type: 'playhead',
      label: 'Playhead',
    });
  }

  for (const boundary of sceneBoundaries) {
    if (boundary >= 0) {
      snapPoints.push({
        time: boundary,
        type: 'scene-boundary',
        label: 'Scene boundary',
      });
    }
  }

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      snapPoints.push({
        time: clip.startTime,
        type: 'clip-start',
        clipId: clip.id,
        trackId: track.id,
        label: clip.label,
      });
      snapPoints.push({
        time: clip.startTime + clip.duration,
        type: 'clip-end',
        clipId: clip.id,
        trackId: track.id,
        label: clip.label,
      });
    }
  }

  return snapPoints;
}

export function resolveTimelineSnap({
  targetTime,
  snapPoints,
  maxSnapDistance,
}: {
  targetTime: number;
  snapPoints: SnapPoint[];
  maxSnapDistance: number;
}): SnapResult {
  let closestSnapPoint: SnapPoint | null = null;
  let closestDistance = Infinity;

  for (const snapPoint of snapPoints) {
    const distance = Math.abs(targetTime - snapPoint.time);
    if (distance <= maxSnapDistance && distance < closestDistance) {
      closestDistance = distance;
      closestSnapPoint = snapPoint;
    }
  }

  return {
    snappedTime: closestSnapPoint ? closestSnapPoint.time : targetTime,
    snapPoint: closestSnapPoint,
    snapDistance: closestDistance,
  };
}

export function getSnapThresholdInSeconds({
  zoomLevel,
  snapThresholdPx = DEFAULT_SNAP_THRESHOLD_PX,
  basePixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND,
}: {
  zoomLevel: number;
  snapThresholdPx?: number;
  basePixelsPerSecond?: number;
}): number {
  const pps = basePixelsPerSecond * zoomLevel;
  return snapThresholdPx / pps;
}

/**
 * Checks whether a clip can be placed on a track without overlapping existing clips.
 * Especially enforced for primary VIDEO tracks.
 */
export function canPlaceClipOnTrack({
  track,
  clipId,
  startTime,
  duration,
}: {
  track: TimelineTrack;
  clipId?: string;
  startTime: number;
  duration: number;
}): boolean {
  if (startTime < 0 || duration <= 0) return false;
  const endTime = startTime + duration;

  for (const existingClip of track.clips) {
    if (existingClip.id === clipId) continue;
    const existingEnd = existingClip.startTime + existingClip.duration;
    // Overlap check with small epsilon tolerance
    if (startTime < existingEnd - 0.001 && endTime > existingClip.startTime + 0.001) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates the total length of the composition based on the furthest clip end time.
 */
export function calculateTotalDuration(tracks: TimelineTrack[], minimumDuration = 5): number {
  let maxEnd = minimumDuration;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration;
      if (end > maxEnd) {
        maxEnd = end;
      }
    }
  }
  return Math.round(maxEnd * 100) / 100;
}
