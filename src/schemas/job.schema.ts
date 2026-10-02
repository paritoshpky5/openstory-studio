import { z } from 'zod';
import { ProviderChannelEnum } from './asset.schema';

export const JobTypeEnum = z.enum([
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'LIPSYNC',
  'RENDER',
]);
export type JobType = z.infer<typeof JobTypeEnum>;

export const JobStatusEnum = z.enum([
  'PENDING',
  'SUBMITTED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

export const GenerationJobSchema = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  sceneId: z.string().optional().nullable(),
  jobType: JobTypeEnum,
  status: JobStatusEnum.default('PENDING'),
  provider: z.string(),
  modelId: z.string(),
  channel: ProviderChannelEnum,
  providerJobId: z.string().optional().nullable(),
  idempotencyKey: z.string().min(8, 'Unique idempotency key required'),
  requestPayload: z.record(z.any()),
  responsePayload: z.record(z.any()).optional().nullable(),
  retryCount: z.number().int().default(0),
  maxRetries: z.number().int().default(3),
  isPaidGeneration: z.boolean().default(true),
  errorMessage: z.string().optional().nullable(),
  progress: z.number().min(0).max(100).default(0),
  resultAssetId: z.string().optional().nullable(),
});
export type GenerationJobInput = z.infer<typeof GenerationJobSchema>;
