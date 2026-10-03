import { z } from 'zod';

export const TrackTypeEnum = z.enum([
  'VIDEO',
  'NARRATION',
  'DIALOGUE',
  'AMBIENCE',
  'SFX',
  'MUSIC',
  'SUBTITLE',
]);

export type TrackType = z.infer<typeof TrackTypeEnum>;

export const TimelineClipSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  sceneId: z.string().nullable().optional(),
  shotId: z.string().nullable().optional(),
  assetVersionId: z.string().nullable().optional(),
  sourceFilePath: z.string().nullable().optional(),
  startTime: z.number().min(0, 'Start time cannot be negative'),
  duration: z.number().positive('Duration must be greater than zero'),
  trimIn: z.number().min(0, 'Trim-in cannot be negative').default(0),
  trimOut: z.number().min(0, 'Trim-out cannot be negative').default(0),
  sourceDuration: z.number().positive().nullable().optional(),
  volume: z.number().min(0).max(2).default(1.0),
  muted: z.boolean().default(false),
  label: z.string().default('Clip'),
  assetType: z.string().default('VIDEO'),
  metadata: z.record(z.any()).optional(),
}).refine((clip) => {
  if (clip.sourceDuration && clip.sourceDuration > 0) {
    return clip.trimIn + clip.duration <= clip.sourceDuration + 0.05;
  }
  return true;
}, {
  message: 'Trim boundaries cannot exceed source duration',
});

export type TimelineClip = z.infer<typeof TimelineClipSchema>;

export const TimelineTrackSchema = z.object({
  id: z.string().min(1),
  type: TrackTypeEnum,
  name: z.string(),
  order: z.number().int().min(0),
  muted: z.boolean().default(false),
  volume: z.number().min(0).max(2).default(1.0),
  clips: z.array(TimelineClipSchema).default([]),
});

export type TimelineTrack = z.infer<typeof TimelineTrackSchema>;

export const TimelineCompositionSchema = z.object({
  version: z.number().int().min(1).default(1),
  projectId: z.string().min(1),
  fps: z.number().int().min(1).max(120).default(24),
  aspectRatio: z.string().default('16:9'),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  totalDuration: z.number().min(0).default(0),
  tracks: z.array(TimelineTrackSchema).default([]),
  updatedAt: z.string().optional(),
}).refine((comp) => {
  const videoTracks = comp.tracks.filter((t) => t.type === 'VIDEO');
  for (const track of videoTracks) {
    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current.startTime + current.duration > next.startTime + 0.001) {
        return false;
      }
    }
  }
  return true;
}, {
  message: 'Clips on the primary VIDEO track cannot overlap',
});

export type TimelineComposition = z.infer<typeof TimelineCompositionSchema>;
