import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { VideoProvider, ModelDefinition } from '../base-provider';

export class KlingVideoProvider extends VideoProvider {
  readonly providerName = 'KLING';
  private readonly baseUrl = 'https://api-singapore.klingai.com';

  private createJwt(accessKey: string, secretKey: string): string {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: accessKey, exp: now + 1800, nbf: now - 5 })}`;
    const signature = crypto.createHmac('sha256', secretKey).update(unsigned).digest('base64url');
    return `${unsigned}.${signature}`;
  }

  getSupportedModels(): ModelDefinition[] {
    return [
      {
        id: 'kling-v1',
        provider: 'KLING',
        displayName: 'Kling 1.0 (Standard)',
        type: 'VIDEO',
        channel: 'DIRECT_API',
        capabilities: { supportsImageToVideo: true, maxDurationSeconds: 10 },
        pricing: { perSecond: 0.05, currency: 'USD' },
      },
      {
        id: 'kling-v1-5',
        provider: 'KLING',
        displayName: 'Kling 1.5 (Pro)',
        type: 'VIDEO',
        channel: 'DIRECT_API',
        capabilities: { supportsImageToVideo: true, maxDurationSeconds: 10 },
        pricing: { perSecond: 0.1, currency: 'USD' },
      },
    ];
  }

  estimateCost(modelId: string, settings: any): number {
    const duration = settings?.duration || 5;
    const rate = modelId === 'kling-v1-5' ? 0.1 : 0.05;
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
    const apiKey = process.env.KLING_API_KEY;
    const apiSecret = process.env.KLING_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Kling direct API requires both KLING_API_KEY and KLING_API_SECRET. Use Free Web upload mode until both are configured.');
    }

    try {
      const fullImagePath = this.resolveImagePath(imageReferencePath);
      let base64Image = '';
      if (fs.existsSync(fullImagePath)) {
        const imageBuffer = fs.readFileSync(fullImagePath);
        base64Image = imageBuffer.toString('base64');
      } else {
        throw new Error(`Reference image not found for Kling image-to-video: ${fullImagePath}`);
      }

      const durationStr = settings.duration ? String(settings.duration) : '5';
      const mode = settings.mode || (modelId === 'kling-v1-5' ? 'pro' : 'std');

      const response = await fetch(`${this.baseUrl}/v1/videos/image2video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.createJwt(apiKey, apiSecret)}`,
        },
        body: JSON.stringify({
          model_name: modelId || 'kling-v1',
          image: `data:image/${path.extname(fullImagePath).slice(1).toLowerCase() || 'png'};base64,${base64Image}`,
          prompt: prompt,
          negative_prompt: settings.negativePrompt || 'distorted faces, jerky motion, bad anatomy, blur',
          cfg_scale: settings.cfgScale ?? 0.5,
          mode: mode,
          duration: durationStr,
          camera_control: settings.cameraControl ? {
            type: 'simple',
            config: settings.cameraControl,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Kling API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.code !== 0 || !data.data?.task_id) {
        throw new Error(`Kling API submission failed: ${data.message || JSON.stringify(data)}`);
      }

      return { providerJobId: data.data.task_id };
    } catch (error: any) {
      console.error('[KlingVideoProvider] generateVideo error:', error);
      throw error;
    }
  }

  async checkStatus(
    providerJobId: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress?: number; buffer?: Buffer; url?: string; error?: string }> {
    const apiKey = process.env.KLING_API_KEY;
    const apiSecret = process.env.KLING_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error('Kling API credentials are missing while checking job status');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/videos/image2video/${providerJobId}`, {
        headers: {
          'Authorization': `Bearer ${this.createJwt(apiKey, apiSecret)}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Kling status check error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const task = data.data;

      if (task.task_status === 'submitted' || task.task_status === 'processing') {
        return {
          status: 'PROCESSING',
          progress: task.task_status === 'submitted' ? 0.2 : 0.6,
        };
      }

      if (task.task_status === 'succeed') {
        const videoUrl = task.task_result?.videos?.[0]?.url;
        if (!videoUrl) {
          throw new Error('Kling task succeeded but returned no video URL');
        }
        return {
          status: 'COMPLETED',
          progress: 1.0,
          url: videoUrl,
        };
      }

      if (task.task_status === 'failed') {
        return {
          status: 'FAILED',
          error: task.task_status_msg || 'Kling video generation failed on provider',
        };
      }

      return { status: 'PROCESSING', progress: 0.5 };
    } catch (error: any) {
      console.error('[KlingVideoProvider] checkStatus error:', error);
      throw error;
    }
  }
}
