import prisma from '@/lib/db/prisma';
import { ModelDefinition } from '@/lib/providers/base-provider';
import { JobType } from '@/schemas/job.schema';

export class ModelRegistryService {
  private static readonly DEFAULT_MODELS: ModelDefinition[] = [
    // --- FLUX Models ---
    {
      id: 'flux-1-schnell',
      provider: 'FLUX',
      displayName: 'FLUX.1 [schnell]',
      type: 'IMAGE',
      channel: 'DIRECT_API',
      capabilities: { maxResolution: '1024x1024' },
      pricing: { perImage: 0.003, currency: 'USD' },
    },
    {
      id: 'flux-1-dev',
      provider: 'FLUX',
      displayName: 'FLUX.1 [dev]',
      type: 'IMAGE',
      channel: 'DIRECT_API',
      capabilities: { maxResolution: '1024x1024' },
      pricing: { perImage: 0.03, currency: 'USD' },
    },
    {
      id: 'flux-1-pro',
      provider: 'FLUX',
      displayName: 'FLUX.1 [pro]',
      type: 'IMAGE',
      channel: 'DIRECT_API',
      capabilities: { maxResolution: '1024x1024' },
      pricing: { perImage: 0.05, currency: 'USD' },
    },
    // --- Google Gemini Models ---
    {
      id: 'gemini-3.1-flash-image',
      provider: 'GEMINI',
      displayName: 'Gemini 3.1 Flash Image',
      type: 'IMAGE',
      channel: 'DIRECT_API',
      capabilities: { maxResolution: '1024x1024' },
      pricing: { perImage: 0.03, currency: 'USD' }, // Approximate GCP cost
    },
    // --- OpenAI Models ---
    {
      id: 'gpt-image-1',
      provider: 'OPENAI',
      displayName: 'GPT Image 1',
      type: 'IMAGE',
      channel: 'DIRECT_API',
      capabilities: { maxResolution: '1024x1024' },
      pricing: { perImage: 0.04, currency: 'USD' },
    },
    // --- Kling Models ---
    {
      id: 'kling-1.5-pro',
      provider: 'KLING',
      displayName: 'Kling 1.5 Pro',
      type: 'VIDEO',
      channel: 'DIRECT_API',
      capabilities: { supportsImageToVideo: true, maxDurationSeconds: 10, maxResolution: '1080p' },
      pricing: { perSecond: 0.08, currency: 'USD' }, // Approximate effective cost
    },
    // --- Seedance Models ---
    {
      id: 'seedance-v1',
      provider: 'SEEDANCE',
      displayName: 'Seedance v1',
      type: 'VIDEO',
      channel: 'DIRECT_API',
      capabilities: { supportsImageToVideo: true, maxDurationSeconds: 8 },
      pricing: { perSecond: 0.05, currency: 'USD' },
    },
    // --- Audio Models ---
    {
      id: 'sarvam-bulbul-v3',
      provider: 'SARVAM',
      displayName: 'Sarvam Bulbul v3 TTS',
      type: 'AUDIO',
      channel: 'DIRECT_API',
      capabilities: { supportsLipSync: false },
      pricing: { perMillionTokens: 2.0, currency: 'USD' },
    },
    {
      id: 'eleven_multilingual_v2',
      provider: 'ELEVENLABS',
      displayName: 'ElevenLabs Multilingual v2',
      type: 'AUDIO',
      channel: 'DIRECT_API',
      capabilities: { supportsLipSync: false },
      pricing: { perMillionTokens: 30.0, currency: 'USD' }, // roughly based on character usage
    },
  ];

  /**
   * Seeds the database with default models if they don't exist.
   */
  static async seedDefaults() {
    for (const model of this.DEFAULT_MODELS) {
      await prisma.modelRegistryItem.upsert({
        where: { id: model.id },
        update: {
          displayName: model.displayName,
          capabilities: JSON.stringify(model.capabilities),
          pricing: JSON.stringify(model.pricing),
        },
        create: {
          id: model.id,
          provider: model.provider,
          modelId: model.id,
          displayName: model.displayName,
          type: model.type,
          channel: model.channel,
          capabilities: JSON.stringify(model.capabilities),
          pricing: JSON.stringify(model.pricing),
          enabled: true,
        },
      });
    }
  }

  /**
   * Retrieves all enabled models for a specific type (e.g., 'IMAGE').
   */
  static async getModelsByType(type: JobType) {
    return prisma.modelRegistryItem.findMany({
      where: { type, enabled: true },
    });
  }

  /**
   * Calculates the theoretical cost based on base pricing configuration.
   * Can be overridden by manual ProviderChannelConfig (e.g., if on a fixed subscription).
   */
  static estimateCost(modelId: string, units: number): number {
    const model = this.DEFAULT_MODELS.find(m => m.id === modelId);
    if (!model) return 0;

    if (model.type === 'IMAGE' && model.pricing.perImage) {
      return model.pricing.perImage * units; // units = number of images
    }
    if (model.type === 'VIDEO' && model.pricing.perSecond) {
      return model.pricing.perSecond * units; // units = seconds
    }
    if (model.type === 'AUDIO' && model.pricing.perMillionTokens) {
      return (model.pricing.perMillionTokens / 1_000_000) * units; // units = tokens/characters
    }
    return 0;
  }
}
