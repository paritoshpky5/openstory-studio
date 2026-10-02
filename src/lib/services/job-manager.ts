import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { JobType, JobStatus, GenerationJobInput } from '@/schemas/job.schema';

export interface GenerationRequest {
  projectId: string;
  sceneId?: string | null;
  shotId?: string | null;
  characterId?: string | null;
  jobType: JobType;
  provider: string;
  modelId: string;
  channel: string;
  prompt: string;
  negativePrompt?: string | null;
  motionPrompt?: string | null;
  settings: Record<string, any>;
  referencePaths?: string[];
  isPaidGeneration?: boolean;
  forceRegeneration?: boolean; // If true, bypasses idempotency
}

export class JobManager {
  /**
   * Generates a deterministic SHA-256 hash based on the generation parameters.
   * This guarantees that identical requests yield the same key.
   */
  static generateIdempotencyKey(req: GenerationRequest, salt?: string): string {
    const payload = {
      projectId: req.projectId,
      sceneId: req.sceneId,
      shotId: req.shotId,
      characterId: req.characterId,
      jobType: req.jobType,
      provider: req.provider,
      modelId: req.modelId,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      motionPrompt: req.motionPrompt,
      settings: req.settings,
      referencePaths: req.referencePaths,
      salt: salt || '', // Use salt to force a new key if regeneration is requested
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Creates or retrieves an existing job. 
   * Protects against duplicate paid generations.
   */
  static async getOrCreateJob(req: GenerationRequest): Promise<{ job: any; isNew: boolean }> {
    const salt = req.forceRegeneration ? Date.now().toString() : '';
    const idempotencyKey = this.generateIdempotencyKey(req, salt);

    // Check if an existing job matches this exact signature
    if (!req.forceRegeneration) {
      const existingJob = await prisma.generationJob.findUnique({
        where: { idempotencyKey },
      });

      if (existingJob) {
        // If it's already completed, processing, or submitted, return it to prevent duplicate spend.
        if (['COMPLETED', 'PROCESSING', 'SUBMITTED', 'PENDING'].includes(existingJob.status)) {
          return { job: existingJob, isNew: false };
        }
        // If FAILED or CANCELLED, we could potentially retry it, but creating a new one is cleaner 
        // if we just use a salt, OR we update the existing one. We will update the existing one's status to PENDING.
        const resetJob = await prisma.generationJob.update({
          where: { id: existingJob.id },
          data: { status: 'PENDING', errorMessage: null, retryCount: existingJob.retryCount + 1 },
        });
        return { job: resetJob, isNew: false };
      }
    }

    // Create a new job
    const newJob = await prisma.generationJob.create({
      data: {
        projectId: req.projectId,
        sceneId: req.sceneId,
        jobType: req.jobType,
        status: 'PENDING',
        provider: req.provider,
        modelId: req.modelId,
        channel: req.channel || 'DIRECT_API',
        idempotencyKey,
        requestPayload: JSON.stringify(req),
        isPaidGeneration: req.isPaidGeneration !== false,
      },
    });

    return { job: newJob, isNew: true };
  }

  /**
   * Updates the job status and response payload.
   */
  static async updateJobStatus(
    jobId: string, 
    status: JobStatus, 
    providerJobId?: string, 
    responsePayload?: any, 
    errorMessage?: string,
    progress?: number
  ) {
    const data: any = { status };
    if (providerJobId) data.providerJobId = providerJobId;
    if (responsePayload) data.responsePayload = JSON.stringify(responsePayload);
    if (errorMessage !== undefined) data.errorMessage = errorMessage;
    if (progress !== undefined) data.progress = progress;

    return prisma.generationJob.update({
      where: { id: jobId },
      data,
    });
  }

  /**
   * Marks a job as completed and links the resulting asset version.
   */
  static async markJobCompleted(jobId: string, resultAssetId: string, responsePayload?: any) {
    return prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        resultAssetId,
        responsePayload: responsePayload ? JSON.stringify(responsePayload) : undefined,
      },
    });
  }

  /**
   * Marks a job as failed with an error message.
   */
  static async failJob(jobId: string, errorMessage: string) {
    return prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
  }

  /**
   * Recovers jobs that were interrupted (e.g. app crash) and stuck in SUBMITTED or PROCESSING.
   * This would be called on application startup.
   */
  static async recoverInterruptedJobs() {
    const stuckJobs = await prisma.generationJob.findMany({
      where: {
        status: { in: ['SUBMITTED', 'PROCESSING'] },
      },
    });

    return stuckJobs;
  }
}
