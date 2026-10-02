import fs from 'fs';
import path from 'path';
import { VideoProvider, ModelDefinition } from '../base-provider';

export class SeedanceVideoProvider extends VideoProvider {
  readonly providerName = 'SEEDANCE';
  private readonly baseUrl = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';

  private mapModel(modelId: string): string {
    if (modelId === 'seedance-v1') return 'seedance-1-0-pro-fast-251015';
    if (modelId === 'seedance-pro') return 'seedance-1-5-pro-251215';
    return modelId;
  }

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

    if (!apiKey) throw new Error('Seedance direct API requires SEEDANCE_API_KEY. Use Free Web upload mode until it is configured.');

    try {
      const fullImagePath = this.resolveImagePath(imageReferencePath);
      let base64Image = '';
      if (fs.existsSync(fullImagePath)) {
        const imageBuffer = fs.readFileSync(fullImagePath);
        base64Image = imageBuffer.toString('base64');
      } else {
        throw new Error(`Reference image not found for Seedance image-to-video: ${fullImagePath}`);
      }

      const extension = path.extname(fullImagePath).slice(1).toLowerCase() || 'png';
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.mapModel(modelId || 'seedance-v1'),
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              role: 'first_frame',
              image_url: { url: `data:image/${extension};base64,${base64Image}` },
            },
          ],
          duration: settings.duration || 5,
          resolution: settings.resolution || '720p',
          ratio: settings.aspectRatio || 'adaptive',
          watermark: false,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Seedance API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (!data.id) {
        throw new Error(`Seedance submission failed: ${JSON.stringify(data)}`);
      }

      return { providerJobId: data.id };
    } catch (error: any) {
      console.error('[SeedanceVideoProvider] generateVideo error:', error);
      throw error;
    }
  }

  async checkStatus(
    providerJobId: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress?: number; buffer?: Buffer; url?: string; error?: string }> {
    const apiKey = process.env.SEEDANCE_API_KEY || process.env.ARK_API_KEY;
    if (!apiKey) {
      throw new Error('SEEDANCE_API_KEY missing while checking non-mock job status');
    }

    try {
      const response = await fetch(`${this.baseUrl}/${providerJobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Seedance status check error (${response.status}): ${errText}`);
      }

      const data = await response.json();

      if (data.status === 'queued' || data.status === 'running') {
        return {
          status: 'PROCESSING',
          progress: data.progress ?? 0.5,
        };
      }

      if (data.status === 'succeeded') {
        return {
          status: 'COMPLETED',
          progress: 1.0,
          url: data.content?.video_url,
        };
      }

      if (data.status === 'failed' || data.status === 'cancelled') {
        return {
          status: 'FAILED',
          error: data.error?.message || 'Seedance generation failed on provider',
        };
      }

      return { status: 'PROCESSING', progress: 0.5 };
    } catch (error: any) {
      console.error('[SeedanceVideoProvider] checkStatus error:', error);
      throw error;
    }
  }
}
