import { ImageProvider, ModelDefinition } from '../base-provider';

export class OpenAIImageProvider extends ImageProvider {
  readonly providerName = 'OPENAI';

  private apiKey: string;
  private endpoint = 'https://api.openai.com/v1/images/generations';

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
  }

  getSupportedModels(): ModelDefinition[] {
    return [
      {
        id: 'dall-e-3',
        provider: 'OPENAI',
        displayName: 'OpenAI DALL·E 3',
        type: 'IMAGE',
        channel: 'DIRECT_API',
        capabilities: {
          maxResolution: '1792x1024',
        },
        pricing: {
          perImage: 0.04,
          currency: 'USD',
        },
      },
    ];
  }

  estimateCost(_modelId: string, settings: any): number {
    if (settings?.quality === 'hd') {
      return 0.08;
    }
    return 0.04;
  }

  private mapSize(aspectRatio?: string): string {
    switch (aspectRatio) {
      case '16:9':
        return '1792x1024';
      case '9:16':
        return '1024x1792';
      case '1:1':
      default:
        return '1024x1024';
    }
  }

  async generateImage(
    modelId: string,
    prompt: string,
    negativePrompt?: string,
    settings: any = {},
    _referencePaths?: string[]
  ): Promise<{ providerJobId?: string; buffer?: Buffer; url?: string }> {
    if (!this.apiKey || this.apiKey === 'mock' || this.apiKey === 'placeholder') {
      const buffer = this.createMockImageBuffer('OPENAI', modelId, prompt, settings);
      return { buffer };
    }

    const payload = {
      model: modelId || 'dall-e-3',
      prompt,
      n: 1,
      size: this.mapSize(settings.aspectRatio),
      quality: settings.quality === 'hd' ? 'hd' : 'standard',
      response_format: 'b64_json',
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI DALL·E API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const b64Json = data.data?.[0]?.b64_json;

    if (!b64Json) {
      throw new Error('OpenAI DALL·E returned no image data');
    }

    const buffer = Buffer.from(b64Json, 'base64');
    return { buffer };
  }

  private createMockImageBuffer(provider: string, modelId: string, prompt: string, settings: any): Buffer {
    const width = settings.aspectRatio === '16:9' ? 1024 : 1024;
    const height = settings.aspectRatio === '16:9' ? 576 : 1024;
    const escapedPrompt = prompt.slice(0, 150).replace(/[<>&"]/g, '');
    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#18181b" />
            <stop offset="100%" stop-color="#27272a" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" />
        <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="12" fill="none" stroke="#a855f7" stroke-width="2" stroke-dasharray="8 4" opacity="0.4" />
        <text x="50" y="70" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#c084fc">[MOCK / PREVIEW] ${provider} — ${modelId}</text>
        <text x="50" y="110" font-family="system-ui, sans-serif" font-size="14" fill="#e9d5ff">DALL·E 3 | Aspect: ${settings.aspectRatio || '16:9'}</text>
        <foreignObject x="50" y="140" width="${width - 100}" height="${height - 200}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color: #f3e8ff; font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5; word-wrap: break-word;">
            <p><strong>Compiled Prompt:</strong></p>
            <p style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; border-left: 3px solid #a855f7;">${escapedPrompt}...</p>
          </div>
        </foreignObject>
        <text x="50" y="${height - 40}" font-family="system-ui, sans-serif" font-size="12" fill="#71717a">OpenStory Studio — Production Frame Candidate</text>
      </svg>
    `;
    return Buffer.from(svg.trim(), 'utf-8');
  }
}
