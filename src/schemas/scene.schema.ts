import { z } from 'zod';

export const SceneImportanceEnum = z.enum([
  'BACKGROUND',
  'NORMAL',
  'IMPORTANT',
  'HERO',
]);
export type SceneImportance = z.infer<typeof SceneImportanceEnum>;

export const SceneStatusEnum = z.enum([
  'NOT_STARTED',
  'STORYBOARD',
  'STORYBOARD_APPROVED',
  'PRODUCTION_IMAGE',
  'IMAGE_APPROVED',
  'VIDEO_GENERATED',
  'VIDEO_APPROVED',
  'FINAL',
]);
export type SceneStatus = z.infer<typeof SceneStatusEnum>;

export const CameraMovementEnum = z.enum([
  'Locked Camera',
  'Slow Dolly In',
  'Slow Dolly Out',
  'Pan Left',
  'Pan Right',
  'Tilt Up',
  'Tilt Down',
  'Arc Left',
  'Arc Right',
  'Tracking Forward',
  'Tracking Backward',
  'Rack Focus',
  'Subtle Handheld',
]);
export type CameraMovement = z.infer<typeof CameraMovementEnum>;

export const MotionPresetEnum = z.enum([
  'STATIC_PLUS',
  'VERY_SUBTLE',
  'NATURAL',
  'MODERATE',
  'DYNAMIC',
]);
export type MotionPreset = z.infer<typeof MotionPresetEnum>;

export const ShotTypeEnum = z.enum([
  'WIDE',
  'MEDIUM',
  'CLOSE_UP',
  'EXTREME_CLOSE_UP',
  'OVER_THE_SHOULDER',
  'ESTABLISHING',
]);
export type ShotType = z.infer<typeof ShotTypeEnum>;

export const CameraAngleEnum = z.enum([
  'EYE_LEVEL',
  'LOW_ANGLE',
  'HIGH_ANGLE',
  'DUTCH_ANGLE',
]);
export type CameraAngle = z.infer<typeof CameraAngleEnum>;

export const ShotSchema = z.object({
  id: z.string().optional(),
  shotNumber: z.number().int().min(1),
  description: z.string().min(5, 'Shot description required'),
  duration: z.number().min(1).max(30).default(4.0),
  activeImageVersionId: z.string().optional().nullable(),
  activeVideoVersionId: z.string().optional().nullable(),
  activeAudioVersionId: z.string().optional().nullable(),
});
export type ShotInput = z.infer<typeof ShotSchema>;

export const SceneSchema = z.object({
  id: z.string().optional(),
  sceneNumber: z.number().int().min(1),
  title: z.string().min(2, 'Scene title required'),
  importance: SceneImportanceEnum.default('NORMAL'),
  status: SceneStatusEnum.default('NOT_STARTED'),

  location: z.string().min(2, 'Location required (e.g. "Courtyard of rural mud-brick house")'),
  timeOfDay: z.string().min(2, 'Time of day required (e.g. "Late Golden Hour")'),
  environment: z.string().min(5, 'Environment details required'),
  lighting: z.string().min(3, 'Lighting description required'),
  mood: z.string().min(3, 'Emotional mood required'),
  summary: z.string().min(5, 'Scene visual narrative summary required'),

  characterIds: z.array(z.string()).default([]),

  // Hindi Audio & Voice (in Devanagari)
  narrationHindi: z.string().optional().nullable(),
  dialogueHindi: z.string().optional().nullable(),
  speakingCharacterId: z.string().optional().nullable(),

  // Cinematography
  shotType: ShotTypeEnum.default('MEDIUM'),
  cameraAngle: CameraAngleEnum.default('EYE_LEVEL'),
  cameraMovement: CameraMovementEnum.default('Slow Dolly In'),
  motionPreset: MotionPresetEnum.default('NATURAL'),
  durationSeconds: z.number().min(1).max(60).default(4.0),

  // Sound Design
  ambiencePrompt: z.string().optional().nullable(),
  sfxPrompt: z.string().optional().nullable(),
  musicMood: z.string().optional().nullable(),

  orderIndex: z.number().int().default(0),
  shots: z.array(ShotSchema).default([]),
});

export type SceneInput = z.infer<typeof SceneSchema>;
