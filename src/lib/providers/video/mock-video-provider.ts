import { VideoProvider, ModelDefinition } from '../base-provider';
import { generateMockWavBuffer } from '@/lib/audio/wav-generator';

export class MockVideoProvider extends VideoProvider {
  readonly providerName = 'MOCK_VIDEO';

  getSupportedModels(): ModelDefinition[] {
    return [
      {
        id: 'mock-video-1',
        provider: 'MOCK_VIDEO',
        displayName: 'Mock Video Model',
        type: 'VIDEO',
        channel: 'DIRECT_API',
        capabilities: { supportsImageToVideo: true, maxDurationSeconds: 5 },
        pricing: { perSecond: 0.1, currency: 'USD' },
      },
    ];
  }

  estimateCost(modelId: string, settings: any): number {
    return 0.5;
  }

  async generateVideo(
    modelId: string,
    prompt: string,
    imageReferencePath: string,
    settings: any
  ): Promise<{ providerJobId: string }> {
    // Generate a mock job ID encoding the start time so we can fake async processing
    const startTime = Date.now();
    const shouldFail = settings?.failOnPurpose === true;
    const providerJobId = `mock_vid_${startTime}_${shouldFail ? 'fail' : 'success'}`;
    return { providerJobId };
  }

  async checkStatus(
    providerJobId: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress?: number; buffer?: Buffer; url?: string; error?: string }> {
    // Parse the start time from the job ID
    const parts = providerJobId.split('_');
    const startTime = parseInt(parts[2], 10);
    const shouldFail = parts[3] === 'fail';

    const elapsed = Date.now() - startTime;
    const targetDurationMs = 15000; // Fake 15-second generation time

    if (elapsed < targetDurationMs) {
      return {
        status: 'PROCESSING',
        progress: elapsed / targetDurationMs,
      };
    }

    if (shouldFail) {
      return {
        status: 'FAILED',
        error: 'Mock provider simulated failure for testing.',
      };
    }

    // Success: Return a tiny mock buffer (using the WAV generator for a non-empty file, though normally it'd be MP4)
    // For tests, just a dummy buffer is fine.
    const buffer = Buffer.from('mock video data');
    return {
      status: 'COMPLETED',
      progress: 1.0,
      buffer,
    };
  }
}
