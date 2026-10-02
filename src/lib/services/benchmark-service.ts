import prisma from '@/lib/db/prisma';
import { JobType } from '@/schemas/job.schema';
import { ImageWorkflowService } from './image-workflow-service';
import { ModelRouter } from './model-router';

export interface BenchmarkCandidate {
  assetId: string;
  modelId: string; // Hidden from user during blind test
  filePath: string;
}

export interface BlindBenchmarkSession {
  id: string;
  projectId: string;
  prompt: string;
  jobType: JobType;
  candidates: BenchmarkCandidate[]; // Array of generated assets
}

export class BenchmarkService {
  /**
   * Triggers a Golden Benchmark run.
   * Takes a prompt and fires it against ALL enabled models for that job type.
   */
  static async startBlindBenchmark(
    projectId: string,
    jobType: JobType,
    prompt: string,
    settings: any = { aspectRatio: '16:9' }
  ): Promise<BlindBenchmarkSession> {
    const models = await prisma.modelRegistryItem.findMany({
      where: { type: jobType, enabled: true },
    });

    if (models.length === 0) {
      throw new Error(`No enabled models found for job type: ${jobType}`);
    }

    const candidates: BenchmarkCandidate[] = [];
    const sessionId = `bench_${Date.now()}`;

    // Note: In production with many models, we might want to do this concurrently via Promise.all.
    // For local SQLite, sequential or small batches is safer to avoid DB locks.
    for (const model of models) {
      if (jobType === 'IMAGE') {
        const result = await ImageWorkflowService.generateImage({
          projectId,
          assetType: 'PRODUCTION_IMAGE',
          provider: model.provider,
          modelId: model.id,
          prompt,
          settings,
          forceRegeneration: true, // Always force fresh generation for benchmark
        });

        candidates.push({
          assetId: result.assetVersion.id,
          modelId: model.id,
          filePath: result.assetVersion.filePath,
        });
      }
      // Future: Implement Video and Audio benchmark pipelines here
    }

    // Shuffle candidates to ensure it's truly blind (A/B/C order is randomized)
    const shuffled = candidates.sort(() => Math.random() - 0.5);

    return {
      id: sessionId,
      projectId,
      prompt,
      jobType,
      candidates: shuffled,
    };
  }

  /**
   * Submits ratings for a benchmark session.
   * Updates AssetVersion ratings and recalculates Model stats.
   */
  static async submitBlindRatings(
    ratings: Array<{ assetId: string; rating: number; approved: boolean; rejectionReasons?: string[] }>
  ) {
    const affectedModelIds = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const r of ratings) {
        const asset = await tx.assetVersion.update({
          where: { id: r.assetId },
          data: {
            rating: r.rating,
            approvalStatus: r.approved ? 'APPROVED' : 'REJECTED',
            rejectionReasons: r.rejectionReasons ? JSON.stringify(r.rejectionReasons) : null,
          },
        });
        affectedModelIds.add(asset.modelId);
      }
    });

    // Recalculate stats for all affected models asynchronously outside the transaction
    for (const modelId of affectedModelIds) {
      await ModelRouter.updateModelStats(modelId);
    }

    return { success: true, updatedModels: Array.from(affectedModelIds) };
  }
}
