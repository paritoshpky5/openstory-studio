import fs from 'fs';
import path from 'path';
import { VideoProvider, ModelDefinition } from '../base-provider';

export class SeedanceVideoProvider extends VideoProvider {
  readonly providerName = 'SEEDANCE';

  getSupportedModels(): ModelDefinition[] {
    return [
      {
        id: 'seedance-v1',
        provider: 'SEEDANCE',
        displayName: 'Seedance 1.0 (Narrative Acting)',
        type: 'VIDEO',
        channel: 'DIRECT_API',
        capabilities: { supportsImageToVideo: true, maxDurationSeconds: 8 },
        pricing: { perSecond: 0.06, currency: 'USD' },
      },
      {
        id: 'seedance-pro',
        provider: 'SEEDANCE',
        displayName: 'Seedance Pro (Multi-Character)',
        type: 'VIDEO',
        channel: 'DIRECT_API',
        capabilities: { supportsImageToVideo: true, maxDurationSeconds: 8 },
        pricing: { perSecond: 0.12, currency: 'USD' },
      },
    ];
  }

  estimateCost(modelId: string, settings: any): number {
    const duration = settings?.duration || 5;
    const rate = modelId === 'seedance-pro' ? 0.12 : 0.06;
    return duration * rate;
  }

  private resolveImagePath(imagePath: string): string {
    if (path.isAbsolute(imagePath)) return imagePath;
    if (imagePath.startsWith('projects/') || imagePath.startsWith('projects\\')) {
      return path.join(process.cwd(), 'data', imagePath);
    }
    return path.join(process.cwd(), 'data', 'projects', imagePath);
  }

  async generateVideo(
    modelId: string,
    prompt: string,
    imageReferencePath: string,
    settings: any = {}
  ): Promise<{ providerJobId: string }> {
    const apiKey = process.env.SEEDANCE_API_KEY || process.env.ARK_API_KEY;

    if (!apiKey) {
      console.warn('[SeedanceVideoProvider] SEEDANCE_API_KEY not found. Simulating async Seedance generation.');
      const startTime = Date.now();
      const providerJobId = `seedance_mock_${startTime}_${Math.random().toString(36).substring(2, 7)}`;
      return { providerJobId };
    }

    try {
      const fullImagePath = this.resolveImagePath(imageReferencePath);
      let base64Image = '';
      if (fs.existsSync(fullImagePath)) {
        const imageBuffer = fs.readFileSync(fullImagePath);
        base64Image = imageBuffer.toString('base64');
      } else {
        throw new Error(`Reference image not found for Seedance image-to-video: ${fullImagePath}`);
      }

      const response = await fetch('https://api.seedance.ai/v1/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId || 'seedance-v1',
          image_base64: base64Image,
          prompt: prompt,
          negative_prompt: settings.negativePrompt || 'blurry, bad geometry, unnatural movements',
          duration: settings.duration || 5,
          camera_movement: settings.cameraMovement || 'NATURAL',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Seedance API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (!data.task_id) {
        throw new Error(`Seedance submission failed: ${JSON.stringify(data)}`);
      }

      return { providerJobId: data.task_id };
    } catch (error: any) {
      console.error('[SeedanceVideoProvider] generateVideo error:', error);
      throw error;
    }
  }

  async checkStatus(
    providerJobId: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress?: number; buffer?: Buffer; url?: string; error?: string }> {
    if (providerJobId.startsWith('seedance_mock_')) {
      const parts = providerJobId.split('_');
      const startTime = parseInt(parts[2], 10);
      const elapsed = Date.now() - startTime;
      const targetDurationMs = 12000;

      if (elapsed < targetDurationMs) {
        return {
          status: 'PROCESSING',
          progress: Math.min(0.95, elapsed / targetDurationMs),
        };
      }

      const mockBuffer = Buffer.from('mock seedance animated mp4 video content');
      return {
        status: 'COMPLETED',
        progress: 1.0,
        buffer: mockBuffer,
      };
    }

    const apiKey = process.env.SEEDANCE_API_KEY || process.env.ARK_API_KEY;
    if (!apiKey) {
      throw new Error('SEEDANCE_API_KEY missing while checking non-mock job status');
    }

    try {
      const response = await fetch(`https://api.seedance.ai/v1/video/tasks/${providerJobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Seedance status check error (${response.status}): ${errText}`);
      }

      const data = await response.json();

      if (data.status === 'PENDING' || data.status === 'RUNNING') {
        return {
          status: 'PROCESSING',
          progress: data.progress ?? 0.5,
        };
      }

      if (data.status === 'SUCCESS') {
        return {
          status: 'COMPLETED',
          progress: 1.0,
          url: data.video_url,
        };
      }

      if (data.status === 'FAILED') {
        return {
          status: 'FAILED',
          error: data.error_message || 'Seedance generation failed on provider',
        };
      }

      return { status: 'PROCESSING', progress: 0.5 };
    } catch (error: any) {
      console.error('[SeedanceVideoProvider] checkStatus error:', error);
      throw error;
    }
  }
}
