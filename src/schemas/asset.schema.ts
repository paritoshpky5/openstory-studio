import { z } from 'zod';

export const AssetTypeEnum = z.enum([
  'STORYBOARD',
  'PRODUCTION_IMAGE',
  'VIDEO',
  'NARRATION',
  'DIALOGUE',
  'LIPSYNC',
  'AMBIENCE',
  'SFX',
  'MUSIC',
  'RENDER',
]);
export type AssetType = z.infer<typeof AssetTypeEnum>;

export const ProviderChannelEnum = z.enum([
  'DIRECT_API',
  'AGGREGATOR_API',
  'WEBSITE_SUBSCRIPTION',
  'LOCAL',
  'MANUAL_IMPORT',
]);
export type ProviderChannel = z.infer<typeof ProviderChannelEnum>;

export const ApprovalStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const QualityMetricsSchema = z.object({
  characterConsistency: z.number().min(1).max(5).optional(),
  faceConsistency: z.number().min(1).max(5).optional(),
  clothingConsistency: z.number().min(1).max(5).optional(),
  styleConsistency: z.number().min(1).max(5).optional(),
  promptAdherence: z.number().min(1).max(5).optional(),
  composition: z.number().min(1).max(5).optional(),
  anatomy: z.number().min(1).max(5).optional(),
  visualQuality: z.number().min(1).max(5).optional(),
  animationReadiness: z.number().min(1).max(5).optional(),
  // Video-specific metrics
  motionNaturalness: z.number().min(1).max(5).optional(),
  anatomyStability: z.number().min(1).max(5).optional(),
  backgroundStability: z.number().min(1).max(5).optional(),
  cameraQuality: z.number().min(1).max(5).optional(),
  artifactLevel: z.number().min(1).max(5).optional(), // 1 = heavy artifacts, 5 = pristine/no artifacts
});
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>;

export const AssetVersionSchema = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  sceneId: z.string().optional().nullable(),
  shotId: z.string().optional().nullable(),
  characterId: z.string().optional().nullable(),
  assetType: AssetTypeEnum,
  provider: z.string(),
  modelId: z.string(),
  channel: ProviderChannelEnum,
  filePath: z.string(),
  mimeType: z.string(),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
  duration: z.number().optional().nullable(),
  prompt: z.string(),
  negativePrompt: z.string().optional().nullable(),
  motionPrompt: z.string().optional().nullable(),
  settings: z.record(z.any()).default({}),
  referencePaths: z.array(z.string()).default([]),
  estimatedCost: z.number().optional().nullable(),
  actualCost: z.number().optional().nullable(),
  approvalStatus: ApprovalStatusEnum.default('PENDING'),
  isActive: z.boolean().default(false),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  rejectionReasons: z.array(z.string()).default([]),
  qualityMetrics: QualityMetricsSchema.optional().nullable(),
});
export type AssetVersionInput = z.infer<typeof AssetVersionSchema>;
