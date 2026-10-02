import { ImageProvider, ModelDefinition } from '../base-provider';
import fs from 'fs';
import path from 'path';

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
        id: 'gpt-image-1',
        provider: 'OPENAI',
        displayName: 'OpenAI GPT Image 1',
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
        return '1536x1024';
      case '9:16':
        return '1024x1536';
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
    referencePaths?: string[]
  ): Promise<{ providerJobId?: string; buffer?: Buffer; url?: string }> {
    if (this.apiKey === 'mock' || (!this.apiKey && process.env.OPENSTORY_DEMO_MODE === 'true')) {
      const buffer = this.createMockImageBuffer('OPENAI', modelId, prompt, settings);
      return { buffer };
    }
    if (!this.apiKey || this.apiKey === 'placeholder') {
      throw new Error('OPENAI_API_KEY is not configured. Use Free Web upload mode or explicitly enable a test provider.');
    }

    const activeModel = modelId === 'dall-e-3' ? 'gpt-image-1' : (modelId || 'gpt-image-1');
    const fullPrompt = negativePrompt ? `${prompt}\nAvoid: ${negativePrompt}` : prompt;
    let response: Response;
    const usableReferences = (referencePaths || []).filter((referencePath) => fs.existsSync(referencePath));
    if (usableReferences.length > 0) {
      const form = new FormData();
      form.append('model', activeModel);
      form.append('prompt', fullPrompt);
      form.append('size', this.mapSize(settings.aspectRatio));
      form.append('quality', settings.quality === 'hd' ? 'high' : (settings.quality || 'auto'));
      usableReferences.slice(0, 4).forEach((referencePath, index) => {
        const extension = path.extname(referencePath).toLowerCase();
        const mimeType = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'image/png';
        form.append('image[]', new Blob([fs.readFileSync(referencePath)], { type: mimeType }), `reference_${index}${extension || '.png'}`);
      });
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } else {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: activeModel,
          prompt: fullPrompt,
          n: 1,
          size: this.mapSize(settings.aspectRatio),
          quality: settings.quality === 'hd' ? 'high' : (settings.quality || 'auto'),
          output_format: 'png',
        }),
      });
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Image API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const b64Json = data.data?.[0]?.b64_json;

    if (!b64Json) {
      throw new Error('OpenAI Image API returned no image data');
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
        <text x="50" y="110" font-family="system-ui, sans-serif" font-size="14" fill="#e9d5ff">GPT Image | Aspect: ${settings.aspectRatio || '16:9'}</text>
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
