import { ImageProvider, ModelDefinition } from '../base-provider';

export class FluxProvider extends ImageProvider {
  readonly providerName = 'FLUX';

  private apiKey: string;
  private baseUrl = 'https://api.bfl.ml/v1';

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.BFL_API_KEY || '';
  }

  getSupportedModels(): ModelDefinition[] {
    return [
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
      {
        id: 'flux-pro-1.1',
        provider: 'FLUX',
        displayName: 'FLUX 1.1 [pro]',
        type: 'IMAGE',
        channel: 'DIRECT_API',
        capabilities: { maxResolution: '1440x1440' },
        pricing: { perImage: 0.05, currency: 'USD' },
      },
    ];
  }

  estimateCost(modelId: string, _settings: any): number {
    switch (modelId) {
      case 'flux-1-schnell':
        return 0.003;
      case 'flux-1-dev':
        return 0.03;
      case 'flux-1-pro':
      case 'flux-pro-1.1':
      default:
        return 0.05;
    }
  }

  private mapEndpoint(modelId: string): string {
    switch (modelId) {
      case 'flux-1-schnell':
        return 'flux-dev'; // or flux-schnell if enabled on account
      case 'flux-1-dev':
        return 'flux-dev';
      case 'flux-pro-1.1':
        return 'flux-pro-1.1';
      case 'flux-1-pro':
      default:
        return 'flux-pro';
    }
  }

  private parseDimensions(aspectRatio?: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '16:9':
        return { width: 1024, height: 576 };
      case '9:16':
        return { width: 576, height: 1024 };
      case '4:3':
        return { width: 1024, height: 768 };
      case '3:4':
        return { width: 768, height: 1024 };
      case '1:1':
      default:
        return { width: 1024, height: 1024 };
    }
  }

  async generateImage(
    modelId: string,
    prompt: string,
    negativePrompt?: string,
    settings: any = {},
    referencePaths?: string[]
  ): Promise<{ providerJobId?: string; buffer?: Buffer; url?: string }> {
    // Check for mock / simulated mode if API key is not configured
    if (!this.apiKey || this.apiKey === 'mock' || this.apiKey === 'placeholder') {
      const buffer = this.createMockImageBuffer('FLUX', modelId, prompt, settings);
      return { buffer };
    }

    const endpointName = this.mapEndpoint(modelId);
    const { width, height } = this.parseDimensions(settings.aspectRatio);

    const payload: any = {
      prompt,
      width,
      height,
      prompt_upsampling: false,
      safety_tolerance: 2,
    };

    if (settings.seed) {
      payload.seed = settings.seed;
    }

    // Reference image / image-to-image support if provided
    if (referencePaths && referencePaths.length > 0) {
      // In BFL API, image-to-image uses input_image or image_prompt depending on endpoint
      payload.image_prompt = referencePaths[0];
    }

    const response = await fetch(`${this.baseUrl}/${endpointName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FLUX API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const providerJobId = data.id;

    if (!providerJobId) {
      throw new Error('FLUX API did not return a job ID');
    }

    // BFL is asynchronous. Poll until ready or timeout (max 60 seconds)
    const result = await this.pollForResult(providerJobId, 60000, 2000);
    return result;
  }

  async pollForResult(
    providerJobId: string,
    timeoutMs: number = 60000,
    intervalMs: number = 2000
  ): Promise<{ providerJobId: string; buffer?: Buffer; url?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const statusRes = await this.checkStatus(providerJobId);

      if (statusRes.status === 'COMPLETED' && statusRes.buffer) {
        return {
          providerJobId,
          buffer: statusRes.buffer,
        };
      }

      if (statusRes.status === 'FAILED') {
        throw new Error(`FLUX generation failed: ${statusRes.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`FLUX generation timed out after ${timeoutMs / 1000}s`);
  }

  async checkStatus(
    providerJobId: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; buffer?: Buffer; error?: string }> {
    if (!this.apiKey) {
      return { status: 'FAILED', error: 'Missing FLUX API key' };
    }

    const res = await fetch(`https://api.bfl.ml/v1/get_result?id=${providerJobId}`, {
      headers: { 'x-key': this.apiKey },
    });

    if (!res.ok) {
      const err = await res.text();
      return { status: 'FAILED', error: `Polling error: ${err}` };
    }

    const result = await res.json();

    if (result.status === 'Ready') {
      const sampleUrl = result.result?.sample;
      if (!sampleUrl) {
        return { status: 'FAILED', error: 'No sample URL in ready result' };
      }
      // Download image sample to Buffer
      const imgRes = await fetch(sampleUrl);
      const arrayBuffer = await imgRes.arrayBuffer();
      return {
        status: 'COMPLETED',
        buffer: Buffer.from(arrayBuffer),
      };
    } else if (result.status === 'Pending') {
      return { status: 'PROCESSING' };
    } else {
      return {
        status: 'FAILED',
        error: result.error || `Generation status: ${result.status}`,
      };
    }
  }

  private createMockImageBuffer(provider: string, modelId: string, prompt: string, settings: any): Buffer {
    const { width, height } = this.parseDimensions(settings.aspectRatio);
    const escapedPrompt = prompt.slice(0, 150).replace(/[<>&"]/g, '');
    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#1e1b4b" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" />
        <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="12" fill="none" stroke="#6366f1" stroke-width="2" stroke-dasharray="8 4" opacity="0.4" />
        <text x="50" y="70" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#38bdf8">[MOCK / PREVIEW] ${provider} — ${modelId}</text>
        <text x="50" y="110" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8">Dimensions: ${width}x${height} | Aspect: ${settings.aspectRatio || '16:9'}</text>
        <foreignObject x="50" y="140" width="${width - 100}" height="${height - 200}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color: #cbd5e1; font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5; word-wrap: break-word;">
            <p><strong>Compiled Prompt:</strong></p>
            <p style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; border-left: 3px solid #38bdf8;">${escapedPrompt}...</p>
          </div>
        </foreignObject>
        <text x="50" y="${height - 40}" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">OpenStory Studio — Production Frame Candidate</text>
      </svg>
    `;
    return Buffer.from(svg.trim(), 'utf-8');
  }
}
