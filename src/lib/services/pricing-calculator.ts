import prisma from '@/lib/db/prisma';
import { ModelRegistryService } from './model-registry';
import { JobType } from '@/schemas/job.schema';

export class PricingCalculator {
  /**
   * Evaluates the effective cost of a generation. 
   * If the user configured a WEBSITE_SUBSCRIPTION channel in ProviderChannelConfig, 
   * we use the costPerCredit. Otherwise, we fall back to the ModelRegistry direct API cost.
   */
  static async getEffectiveCost(
    projectId: string, 
    provider: string, 
    modelId: string, 
    type: JobType,
    units: number // images, seconds, or chars
  ): Promise<number> {
    
    // Check if there is an active custom channel config for this provider
    const channelConfig = await prisma.providerChannelConfig.findFirst({
      where: {
        provider,
        isActive: true,
      }
    });

    if (channelConfig && channelConfig.costPerCredit !== null) {
      // Typically, for subscriptions, 1 image or 1 second of video costs X credits.
      // We will assume 1 unit = 1 credit for simplification in the abstract layer, 
      // though video models might cost e.g. 5 credits per second.
      // This can be expanded.
      return channelConfig.costPerCredit * units;
    }

    // Fall back to direct API estimated pricing from Model Registry
    return ModelRegistryService.estimateCost(modelId, units);
  }

  /**
   * Project-level tracker. Aggregates all actual costs from AssetVersions.
   */
  static async getProjectTotalSpend(projectId: string): Promise<number> {
    const assets = await prisma.assetVersion.aggregate({
      where: { projectId },
      _sum: {
        actualCost: true,
      }
    });

    return assets._sum.actualCost || 0;
  }
}
