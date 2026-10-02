import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db/prisma';
import { JobManager } from './job-manager';
import { getVideoProvider } from '@/lib/providers/video';
import { PricingCalculator } from './pricing-calculator';

export interface SubmitVideoRequest {
  projectId: string;
  sceneId: string;
  characterId?: string;
  prompt: string;
  imageReferencePath: string; // The production image to animate
  provider: string; // 'KLING' | 'SEEDANCE' | 'MOCK_VIDEO'
  modelId: string;
  settings?: any;
  forceRegeneration?: boolean;
}

export class VideoJobOrchestrator {
  private static readonly MIN_POLL_INTERVAL_MS = 10000; // 10 seconds between provider API checks

  /**
   * Submits a video generation job. Ensures idempotency.
   */
  static async submitVideoJob(req: SubmitVideoRequest) {
    const { job, isNew } = await JobManager.getOrCreateJob({
      projectId: req.projectId,
      sceneId: req.sceneId,
      jobType: 'VIDEO',
      provider: req.provider,
      modelId: req.modelId,
      channel: 'DIRECT_API',
      prompt: req.prompt,
      settings: { ...req.settings, imageReferencePath: req.imageReferencePath },
      isPaidGeneration: true,
      forceRegeneration: req.forceRegeneration,
    });

    // If it's already running or completed, just return it
    if (!isNew && job.providerJobId) {
      return job;
    }

    // Submit to provider
    try {
      const provider = getVideoProvider(req.provider);
      const res = await provider.generateVideo(
        req.modelId,
        req.prompt,
        req.imageReferencePath,
        req.settings
      );

      // Save providerJobId and mark PROCESSING
      const updatedJob = await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          providerJobId: res.providerJobId,
          status: 'PROCESSING',
          progress: 0.05, // 5% started
        },
      });

      return updatedJob;
    } catch (error: any) {
      await JobManager.failJob(job.id, `Failed to submit video: ${error.message}`);
      throw error;
    }
  }

  /**
   * Called by the client polling endpoint to check status.
   * Internally throttles calls to the provider API.
   */
  static async checkJobStatus(jobId: string) {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) throw new Error('Job not found');

    // Terminal states - no need to ping provider
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return job;
    }

    if (!job.providerJobId) {
      // Stuck in PENDING/SUBMITTED without a provider ID?
      // Might need submission retry, but for now just return
      return job;
    }

    // Throttle provider checks to avoid rate limits
    const timeSinceLastUpdate = Date.now() - new Date(job.updatedAt).getTime();
    if (timeSinceLastUpdate < this.MIN_POLL_INTERVAL_MS) {
      return job; // Too soon to check again, return current DB state
    }

    const provider = getVideoProvider(job.provider);
    
    try {
      const statusRes = await provider.checkStatus(job.providerJobId);

      if (statusRes.status === 'PROCESSING') {
        const updated = await prisma.generationJob.update({
          where: { id: job.id },
          data: { progress: statusRes.progress ?? job.progress },
        });
        return updated;
      }

      if (statusRes.status === 'FAILED') {
        return await this.handleJobFailure(job, statusRes.error || 'Provider returned FAILED status');
      }

      if (statusRes.status === 'COMPLETED') {
        return await this.handleJobCompletion(job, statusRes);
      }

    } catch (error: any) {
      console.error(`[VideoJobOrchestrator] checkStatus error for job ${job.id}:`, error);
      // Don't fail the job on network error during status check, just return current state
      return job; 
    }

    return job;
  }

  /**
   * Strict Paid-Generation Retry Protection.
   * If a video job fails at the provider level, we assume we were NOT charged (or refunded).
   * We can safely retry up to maxRetries.
   */
  private static async handleJobFailure(job: any, errorMessage: string) {
    if (job.retryCount < job.maxRetries) {
      console.warn(`[VideoJobOrchestrator] Job ${job.id} failed at provider. Retrying (${job.retryCount + 1}/${job.maxRetries})...`);
      
      try {
        const provider = getVideoProvider(job.provider);
        // Resubmit
        const settings = job.requestPayload ? JSON.parse(job.requestPayload).settings : {};
        const prompt = job.requestPayload ? JSON.parse(job.requestPayload).prompt : '';
        
        const res = await provider.generateVideo(
          job.modelId,
          prompt,
          settings.imageReferencePath,
          settings
        );

        return await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            providerJobId: res.providerJobId,
            status: 'PROCESSING',
            progress: 0.05,
            retryCount: { increment: 1 },
            errorMessage: null,
          },
        });
      } catch (retryErr: any) {
        // If the resubmission itself fails, mark it failed definitively
        await JobManager.failJob(job.id, `Retry submission failed: ${retryErr.message}`);
        return prisma.generationJob.findUnique({ where: { id: job.id } });
      }
    } else {
      // Exhausted retries
      console.error(`[VideoJobOrchestrator] Job ${job.id} exhausted max retries. Marking FAILED.`);
      await JobManager.failJob(job.id, `Max retries exhausted. Final error: ${errorMessage}`);
      return prisma.generationJob.findUnique({ where: { id: job.id } });
    }
  }

  /**
   * Handles successful video generation, downloads asset, calculates cost, and updates DB.
   */
  private static async handleJobCompletion(job: any, statusRes: any) {
    const assetId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const projectDir = path.join(process.cwd(), 'data', 'projects', job.projectId, 'videos');
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const fileName = `${assetId}.mp4`;
    const filePath = path.join(projectDir, fileName);

    // 1. Download or write buffer to disk
    if (statusRes.buffer) {
      fs.writeFileSync(filePath, statusRes.buffer);
    } else if (statusRes.url) {
      const response = await fetch(statusRes.url);
      if (!response.ok) throw new Error('Failed to download video from provider URL');
      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    } else {
      throw new Error('No buffer or URL provided by completed video job');
    }

    const relativePath = path.join('projects', job.projectId, 'videos', fileName).replace(/\\/g, '/');

    // 2. Calculate Pricing (assuming 5 seconds default, or fetch actual duration)
    // For now we'll assume a standard 5s generation unit for estimation
    const estimatedCost = await PricingCalculator.getEffectiveCost(
      job.projectId,
      job.provider,
      job.modelId,
      'VIDEO',
      5 // seconds
    );

    // 3. Create AssetVersion
    const settings = job.requestPayload ? JSON.parse(job.requestPayload).settings : {};
    const prompt = job.requestPayload ? JSON.parse(job.requestPayload).prompt : '';

    const assetVersion = await prisma.assetVersion.create({
      data: {
        id: assetId,
        projectId: job.projectId,
        sceneId: job.sceneId,
        assetType: 'VIDEO',
        provider: job.provider,
        modelId: job.modelId,
        channel: job.channel,
        filePath: relativePath,
        mimeType: 'video/mp4',
        duration: 5.0, // Will be updated by ffprobe later if needed
        prompt: prompt,
        settings: JSON.stringify(settings),
        referencePaths: JSON.stringify([settings.imageReferencePath]),
        estimatedCost: estimatedCost,
        actualCost: estimatedCost,
        approvalStatus: 'PENDING',
        isActive: false, // Videos are normally reviewed before becoming active
      },
    });

    // 4. Mark Job Completed
    await JobManager.markJobCompleted(job.id, assetVersion.id, {
      assetId: assetVersion.id,
      filePath: relativePath,
    });

    // 5. Advance Scene Status if necessary
    if (job.sceneId) {
      await prisma.scene.update({
        where: { id: job.sceneId },
        data: { status: 'VIDEO_GENERATED' },
      });
    }

    return prisma.generationJob.findUnique({ where: { id: job.id } });
  }
}
