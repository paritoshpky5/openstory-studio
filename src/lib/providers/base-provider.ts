import { JobType } from '@/schemas/job.schema';

export interface ModelPricing {
  perImage?: number;
  perSecond?: number;
  perMillionTokens?: number;
  currency: string;
}

export interface ProviderCapability {
  supportsImageToVideo?: boolean;
  supportsLipSync?: boolean;
  maxResolution?: string;
  maxDurationSeconds?: number;
}

export interface ModelDefinition {
  id: string; // The canonical ID (e.g., 'flux-1-schnell')
  provider: string; // e.g., 'FLUX'
  displayName: string;
  type: JobType;
  channel: string;
  capabilities: ProviderCapability;
  pricing: ModelPricing;
}

export abstract class BaseProvider {
  abstract readonly providerName: string;
  
  /**
   * Returns a list of models supported by this provider.
   */
  abstract getSupportedModels(): ModelDefinition[];

  /**
   * Estimates the cost of a request before execution.
   */
  abstract estimateCost(modelId: string, settings: any): number;
}

export abstract class ImageProvider extends BaseProvider {
  /**
   * Initiates an image generation request.
   * Expected to return the provider-specific Job ID or the final Image buffer depending on if it's sync/async.
   */
  abstract generateImage(
    modelId: string,
    prompt: string,
    negativePrompt: string | undefined,
    settings: any,
    referencePaths?: string[]
  ): Promise<{ providerJobId?: string; buffer?: Buffer; url?: string }>;
  
  checkStatus?(
    providerJobId: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; buffer?: Buffer; error?: string }>;
}

export abstract class VideoProvider extends BaseProvider {
  abstract generateVideo(
    modelId: string,
    prompt: string,
    imageReferencePath: string, // For image-to-video
    settings: any
  ): Promise<{ providerJobId: string }>;

  abstract checkStatus(providerJobId: string): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED', progress?: number, buffer?: Buffer, url?: string, error?: string }>;
}

export abstract class AudioProvider extends BaseProvider {
  abstract generateAudio(
    modelId: string,
    text: string,
    voiceId: string,
    settings: any
  ): Promise<{ buffer: Buffer }>;
}

export abstract class LipSyncProvider extends BaseProvider {
  abstract syncLips(
    modelId: string,
    videoPath: string,
    audioPath: string,
    settings?: any
  ): Promise<{ providerJobId?: string; buffer?: Buffer; url?: string }>;

  checkStatus?(
    providerJobId: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress?: number; buffer?: Buffer; url?: string; error?: string }>;
}
