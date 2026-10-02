import prisma from '@/lib/db/prisma';
import { JobType } from '@/schemas/job.schema';

export interface RouteRequirements {
  jobType: JobType;
  importance: 'BACKGROUND' | 'NORMAL' | 'IMPORTANT' | 'HERO';
  requiresImageToVideo?: boolean;
  requiresLipSync?: boolean;
  minApprovalRate?: number;
}

export interface RoutingResult {
  selectedModelId: string;
  provider: string;
  expectedCostPerSuccess: number;
  historicalApprovalRate: number;
  reasoning: string;
  alternatives: Array<{ modelId: string; expectedCostPerSuccess: number; approvalRate: number }>;
}

export class ModelRouter {
  /**
   * Determines the most economically efficient model that meets the quality and capability gates.
   * Optimizes for: Cost Per Approved Shot = (Cost per Attempt) / (Approval Rate).
   */
  static async route(req: RouteRequirements): Promise<RoutingResult> {
    const models = await prisma.modelRegistryItem.findMany({
      where: {
        type: req.jobType,
        enabled: true,
      },
    });

    if (models.length === 0) {
      throw new Error(`No enabled models found for job type: ${req.jobType}`);
    }

    // 1. CAPABILITY GATE
    const capableModels = models.filter((m) => {
      const caps = JSON.parse(m.capabilities || '{}');
      if (req.requiresImageToVideo && !caps.supportsImageToVideo) return false;
      if (req.requiresLipSync && !caps.supportsLipSync) return false;
      return true;
    });

    if (capableModels.length === 0) {
      throw new Error(`No models meet the capability requirements for ${req.jobType}`);
    }

    // 2. QUALITY GATE
    // Default quality thresholds based on scene importance if not explicitly provided
    let minQuality = req.minApprovalRate ?? 0.0;
    if (req.minApprovalRate === undefined) {
      switch (req.importance) {
        case 'HERO':
          minQuality = 0.70; // High bar for hero shots
          break;
        case 'IMPORTANT':
          minQuality = 0.50;
          break;
        case 'NORMAL':
          minQuality = 0.20;
          break;
        case 'BACKGROUND':
          minQuality = 0.05; // Willing to retry a cheap model many times
          break;
      }
    }

    // We assume a baseline approval rate for models with no data to allow exploration (e.g., 50%)
    const BASELINE_NEW_MODEL_APPROVAL_RATE = 0.5;

    const scoredModels = capableModels.map((m) => {
      const pricing = JSON.parse(m.pricing || '{}');
      
      // Extract base cost based on type
      let costPerAttempt = 0;
      if (req.jobType === 'IMAGE') costPerAttempt = pricing.perImage || 0.05;
      if (req.jobType === 'VIDEO') costPerAttempt = (pricing.perSecond || 0.05) * 5; // Assumed 5s average
      if (req.jobType === 'AUDIO') costPerAttempt = pricing.perMillionTokens ? (pricing.perMillionTokens / 1000000) * 200 : 0.01; // Assumed 200 chars

      // Override with actual effective cost if tracked
      if (m.effectiveCost > 0) {
        costPerAttempt = m.effectiveCost;
      }

      // Determine reliable approval rate
      // If totalGenerations is low (< 5), we blend it with the baseline
      let effectiveApprovalRate = m.approvalRate;
      if (m.totalGenerations < 5) {
        effectiveApprovalRate = BASELINE_NEW_MODEL_APPROVAL_RATE;
      }

      // Safe division (prevent Infinity if approval rate is 0)
      const safeApprovalRate = Math.max(effectiveApprovalRate, 0.01);
      const expectedCostPerSuccess = costPerAttempt / safeApprovalRate;

      return {
        modelId: m.id,
        provider: m.provider,
        costPerAttempt,
        approvalRate: effectiveApprovalRate,
        expectedCostPerSuccess,
        passesQualityGate: effectiveApprovalRate >= minQuality,
      };
    });

    // 3. ECONOMIC ROUTING
    // Filter to those that pass the quality gate
    const qualifiedModels = scoredModels.filter((sm) => sm.passesQualityGate);

    // If NO models pass the strict quality gate (e.g., all models are struggling with HERO shots),
    // fallback to the highest absolute quality model available, regardless of cost.
    if (qualifiedModels.length === 0) {
      const bestQualityModel = [...scoredModels].sort((a, b) => b.approvalRate - a.approvalRate)[0];
      return {
        selectedModelId: bestQualityModel.modelId,
        provider: bestQualityModel.provider,
        historicalApprovalRate: bestQualityModel.approvalRate,
        expectedCostPerSuccess: bestQualityModel.expectedCostPerSuccess,
        reasoning: `No models met the ${minQuality * 100}% quality gate for ${req.importance} shot. Falling back to highest quality available model.`,
        alternatives: scoredModels.filter(m => m.modelId !== bestQualityModel.modelId),
      };
    }

    // Sort qualified models by lowest Expected Cost Per Success
    qualifiedModels.sort((a, b) => a.expectedCostPerSuccess - b.expectedCostPerSuccess);

    const winner = qualifiedModels[0];

    return {
      selectedModelId: winner.modelId,
      provider: winner.provider,
      historicalApprovalRate: winner.approvalRate,
      expectedCostPerSuccess: winner.expectedCostPerSuccess,
      reasoning: `Selected based on lowest expected cost per success ($${winner.expectedCostPerSuccess.toFixed(3)}) while passing the ${minQuality * 100}% quality gate.`,
      alternatives: scoredModels.filter(m => m.modelId !== winner.modelId),
    };
  }

  /**
   * Recalculates and updates the global approval stats for a model based on all AssetVersions.
   * Called via background job or after benchmark/approval completion.
   */
  static async updateModelStats(modelId: string) {
    const assets = await prisma.assetVersion.findMany({
      where: { modelId },
      select: { approvalStatus: true, actualCost: true }
    });

    if (assets.length === 0) return;

    const total = assets.length;
    const approved = assets.filter(a => a.approvalStatus === 'APPROVED').length;
    const approvalRate = approved / total;
    
    const averageCost = assets.reduce((sum, a) => sum + (a.actualCost || 0), 0) / total;

    await prisma.modelRegistryItem.update({
      where: { id: modelId },
      data: {
        totalGenerations: total,
        approvedGenerations: approved,
        approvalRate,
        effectiveCost: averageCost,
      }
    });
  }
}
