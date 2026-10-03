import prisma from '@/lib/db/prisma';
import { resolveStoredMediaPath, saveProjectMediaFile, ProjectSubdirectory } from '@/lib/storage/project-storage';
import { getImageProvider } from '@/lib/providers/image';
import { JobManager, GenerationRequest } from './job-manager';
import { PricingCalculator } from './pricing-calculator';
import { JobType } from '@/schemas/job.schema';
import { detectMedia } from '@/lib/security/media-upload';

export interface GenerateImageWorkflowInput {
  projectId: string;
  sceneId?: string | null;
  shotId?: string | null;
  characterId?: string | null;
  assetType: 'STORYBOARD' | 'PRODUCTION_IMAGE' | 'CHARACTER_REFERENCE';
  provider: 'FLUX' | 'GEMINI' | 'OPENAI' | string;
  modelId: string;
  channel?: string;
  prompt: string;
  negativePrompt?: string | null;
  settings?: Record<string, any>;
  referencePaths?: string[];
  forceRegeneration?: boolean;
}

export class ImageWorkflowService {
  /**
   * Orchestrates the complete image generation workflow with idempotency and disk persistence.
   */
  static async generateImage(input: GenerateImageWorkflowInput) {
    const {
      projectId,
      sceneId,
      shotId,
      characterId,
      assetType,
      provider: providerName,
      modelId,
      channel = 'DIRECT_API',
      prompt,
      negativePrompt,
      settings = { aspectRatio: '16:9' },
      referencePaths = [],
      forceRegeneration = false,
    } = input;

    // 1. Prepare generation request for JobManager
    const genReq: GenerationRequest = {
      projectId,
      sceneId: sceneId || null,
      shotId: shotId || null,
      characterId: characterId || null,
      jobType: 'IMAGE',
      provider: providerName,
      modelId,
      channel,
      prompt,
      negativePrompt: negativePrompt || null,
      settings,
      referencePaths,
      isPaidGeneration: true,
      forceRegeneration,
    };

    // 2. Check or create job (Idempotency guarantee)
    const { job, isNew } = await JobManager.getOrCreateJob(genReq);

    // If existing completed job, return its asset
    if (!isNew && job.status === 'COMPLETED' && job.resultAssetId) {
      const existingAsset = await prisma.assetVersion.findUnique({
        where: { id: job.resultAssetId },
      });
      if (existingAsset) {
        return {
          job,
          assetVersion: existingAsset,
          isReused: true,
        };
      }
    }

    // 3. Mark job as SUBMITTED & PROCESSING
    await JobManager.updateJobStatus(job.id, 'SUBMITTED', undefined, undefined, undefined, 10);
    await JobManager.updateJobStatus(job.id, 'PROCESSING', undefined, undefined, undefined, 30);

    try {
      // 4. Dispatch to provider adapter
      const imageProvider = getImageProvider(providerName);
      const providerReferencePaths = referencePaths.map((referencePath) =>
        resolveStoredMediaPath(projectId, referencePath)
      );
      const result = await imageProvider.generateImage(
        modelId,
        prompt,
        negativePrompt || undefined,
        settings,
        providerReferencePaths
      );

      if (!result.buffer) {
        throw new Error('Image provider finished without returning image buffer');
      }

      await JobManager.updateJobStatus(job.id, 'PROCESSING', result.providerJobId, undefined, undefined, 75);

      // 5. Determine target subdirectory
      let subdir: ProjectSubdirectory = 'images';
      if (assetType === 'STORYBOARD') subdir = 'storyboards';
      if (assetType === 'CHARACTER_REFERENCE') subdir = 'character-references';

      // 6. Determine extension and mime type
      const isSvg = result.buffer.toString('utf-8', 0, 100).includes('<svg');
      const detected = isSvg ? null : detectMedia(result.buffer);
      if (!isSvg && detected?.category !== 'image') {
        throw new Error('Image provider returned an unsupported or invalid image payload');
      }
      const ext = isSvg ? 'svg' : detected!.extension;
      const mimeType = isSvg ? 'image/svg+xml' : detected!.mimeType;

      // 7. Save file non-destructively to disk
      const baseFilename = sceneId ? `scene_${sceneId}_${assetType.toLowerCase()}` : `char_${characterId || 'asset'}`;
      const savedFile = await saveProjectMediaFile(
        projectId,
        subdir,
        baseFilename,
        ext,
        result.buffer
      );

      // 8. Calculate effective cost
      const cost = await PricingCalculator.getEffectiveCost(
        projectId,
        providerName,
        modelId,
        'IMAGE',
        1
      );

      // 9. Create AssetVersion record
      const assetVersion = await prisma.assetVersion.create({
        data: {
          projectId,
          sceneId: sceneId || null,
          shotId: shotId || null,
          characterId: characterId || null,
          assetType,
          provider: providerName,
          modelId,
          channel,
          filePath: savedFile.relativePath,
          mimeType,
          prompt,
          negativePrompt: negativePrompt || null,
          settings: JSON.stringify(settings),
          referencePaths: referencePaths.length > 0 ? JSON.stringify(referencePaths) : null,
          estimatedCost: cost,
          actualCost: cost,
          approvalStatus: 'PENDING',
          isActive: false,
        },
      });

      // 10. Mark Job Completed
      await JobManager.markJobCompleted(job.id, assetVersion.id, {
        filePath: savedFile.relativePath,
        providerJobId: result.providerJobId,
      });

      // 11. Update Scene Status if applicable
      if (sceneId) {
        const scene = await prisma.scene.findUnique({ where: { id: sceneId } });
        if (scene) {
          if (assetType === 'STORYBOARD' && scene.status === 'NOT_STARTED') {
            await prisma.scene.update({
              where: { id: sceneId },
              data: { status: 'STORYBOARD' },
            });
          } else if (assetType === 'PRODUCTION_IMAGE' && ['STORYBOARD', 'STORYBOARD_APPROVED'].includes(scene.status)) {
            await prisma.scene.update({
              where: { id: sceneId },
              data: { status: 'PRODUCTION_IMAGE' },
            });
          }
        }
      }

      return {
        job: await prisma.generationJob.findUnique({ where: { id: job.id } }),
        assetVersion,
        isReused: false,
      };
    } catch (error: any) {
      console.error('Image generation workflow failed:', error);
      await JobManager.updateJobStatus(job.id, 'FAILED', undefined, undefined, error.message, 0);
      throw error;
    }
  }

  /**
   * Approves an asset version and optionally marks it as the active version.
   */
  static async approveAssetVersion(assetVersionId: string, makeActive: boolean = true) {
    const asset = await prisma.assetVersion.findUnique({
      where: { id: assetVersionId },
    });

    if (!asset) {
      throw new Error(`Asset version ${assetVersionId} not found`);
    }

    return prisma.$transaction(async (tx) => {
      // 1. If making active, deactivate siblings of the same assetType
      if (makeActive) {
        await tx.assetVersion.updateMany({
          where: {
            projectId: asset.projectId,
            sceneId: asset.sceneId,
            shotId: asset.shotId,
            characterId: asset.characterId,
            assetType: asset.assetType,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      // 2. Approve and set active
      const updatedAsset = await tx.assetVersion.update({
        where: { id: assetVersionId },
        data: {
          approvalStatus: 'APPROVED',
          isActive: makeActive ? true : asset.isActive,
        },
      });

      // 3. Update Scene or Shot status
      if (asset.sceneId) {
        if (asset.assetType === 'STORYBOARD') {
          await tx.scene.update({
            where: { id: asset.sceneId },
            data: { status: 'STORYBOARD_APPROVED' },
          });
        } else if (asset.assetType === 'PRODUCTION_IMAGE') {
          await tx.scene.update({
            where: { id: asset.sceneId },
            data: { status: 'IMAGE_APPROVED' },
          });

          // Link to shot activeImageVersionId
          if (asset.shotId) {
            await tx.shot.update({
              where: { id: asset.shotId },
              data: { activeImageVersionId: updatedAsset.id },
            });
          }
        } else if (asset.assetType === 'VIDEO' && asset.shotId) {
          await tx.shot.update({
            where: { id: asset.shotId },
            data: { activeVideoVersionId: updatedAsset.id },
          });
        }
      }

      // 4. Update Character reference if it's a character reference
      if (asset.characterId && asset.assetType === 'CHARACTER_REFERENCE') {
        const refType = JSON.parse(asset.settings || '{}').referenceType || 'PRIMARY_FACE';
        if (makeActive) {
          await tx.characterReference.updateMany({
            where: {
              characterId: asset.characterId,
              referenceType: refType,
              isActive: true,
            },
            data: { isActive: false },
          });
        }

        const existingReference = await tx.characterReference.findFirst({
          where: {
            characterId: asset.characterId,
            referenceType: refType,
            filePath: asset.filePath,
          },
        });

        if (existingReference) {
          await tx.characterReference.update({
            where: { id: existingReference.id },
            data: {
              promptUsed: asset.prompt,
              isApproved: true,
              isActive: makeActive ? true : existingReference.isActive,
            },
          });
        } else {
          await tx.characterReference.create({
            data: {
              characterId: asset.characterId,
              referenceType: refType,
              filePath: asset.filePath,
              promptUsed: asset.prompt,
              isApproved: true,
              isActive: makeActive,
            },
          });
        }
      }

      return updatedAsset;
    });
  }

  /**
   * Rejects an asset version and records reasons.
   */
  static async rejectAssetVersion(assetVersionId: string, reasons: string[] = [], notes?: string) {
    return prisma.assetVersion.update({
      where: { id: assetVersionId },
      data: {
        approvalStatus: 'REJECTED',
        isActive: false,
        rejectionReasons: JSON.stringify(reasons),
        qualityMetrics: notes ? JSON.stringify({ notes }) : undefined,
      },
    });
  }

  /**
   * Sets a specific asset version as active without re-approving.
   */
  static async setActiveAssetVersion(assetVersionId: string) {
    const asset = await prisma.assetVersion.findUnique({
      where: { id: assetVersionId },
    });

    if (!asset) {
      throw new Error(`Asset version ${assetVersionId} not found`);
    }

    return prisma.$transaction(async (tx) => {
      // Deactivate siblings
      await tx.assetVersion.updateMany({
        where: {
          projectId: asset.projectId,
          sceneId: asset.sceneId,
          shotId: asset.shotId,
          characterId: asset.characterId,
          assetType: asset.assetType,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Activate target
      const updatedAsset = await tx.assetVersion.update({
        where: { id: assetVersionId },
        data: { isActive: true },
      });

      // Update shot pointer if production image
      if (asset.shotId && asset.assetType === 'PRODUCTION_IMAGE') {
        await tx.shot.update({
          where: { id: asset.shotId },
          data: { activeImageVersionId: updatedAsset.id },
        });
      } else if (asset.shotId && asset.assetType === 'VIDEO') {
        await tx.shot.update({
          where: { id: asset.shotId },
          data: { activeVideoVersionId: updatedAsset.id },
        });
      }

      return updatedAsset;
    });
  }

  /**
   * Lists asset versions for a scene or shot.
   */
  static async getSceneAssets(sceneId: string) {
    return prisma.assetVersion.findMany({
      where: { sceneId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
