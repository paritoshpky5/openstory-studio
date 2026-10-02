import { ImageProvider, ModelDefinition } from '../base-provider';
import fs from 'fs';
import path from 'path';

export class GeminiImageProvider extends ImageProvider {
  readonly providerName = 'GEMINI';

  private apiKey: string;
  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  getSupportedModels(): ModelDefinition[] {
    return [
      {
        id: 'gemini-3.1-flash-image',
        provider: 'GEMINI',
        displayName: 'Gemini 3.1 Flash Image',
        type: 'IMAGE',
        channel: 'DIRECT_API',
        capabilities: {
          maxResolution: '1792x1024',
        },
        pricing: {
          perImage: 0.03,
          currency: 'USD',
        },
      },
    ];
  }

  estimateCost(_modelId: string, _settings: any): number {
    return 0.03;
  }

  private mapAspectRatio(aspectRatio?: string): string {
    switch (aspectRatio) {
      case '16:9':
        return '16:9';
      case '9:16':
        return '9:16';
      case '4:3':
        return '4:3';
      case '3:4':
        return '3:4';
      case '1:1':
      default:
        return '1:1';
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
      const buffer = this.createMockImageBuffer('GEMINI', modelId, prompt, settings);
      return { buffer };
    }
    if (!this.apiKey || this.apiKey === 'placeholder') {
      throw new Error('GEMINI_API_KEY is not configured. Use Free Web upload mode or explicitly enable a test provider.');
    }

    const parts: any[] = [];
    for (const referencePath of referencePaths || []) {
      if (!fs.existsSync(referencePath)) continue;
      const extension = path.extname(referencePath).toLowerCase();
      const mimeType = extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.webp' ? 'image/webp' : 'image/png';
      parts.push({ inlineData: { mimeType, data: fs.readFileSync(referencePath).toString('base64') } });
    }
    const fullPrompt = negativePrompt ? `${prompt}\nAvoid: ${negativePrompt}` : prompt;
    parts.push({ text: fullPrompt });

    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: this.mapAspectRatio(settings.aspectRatio) },
      },
    };

    const activeModel = modelId || 'gemini-3.1-flash-image';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${activeModel}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Image API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData?.data);
    if (!imagePart?.inlineData?.data) throw new Error('Gemini Image API returned no image data');
    const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
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
            <stop offset="0%" stop-color="#022c22" />
            <stop offset="100%" stop-color="#064e3b" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" />
        <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="12" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="8 4" opacity="0.4" />
        <text x="50" y="70" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#34d399">[MOCK / PREVIEW] ${provider} — ${modelId}</text>
        <text x="50" y="110" font-family="system-ui, sans-serif" font-size="14" fill="#6ee7b7">Gemini Image | Aspect: ${settings.aspectRatio || '16:9'}</text>
        <foreignObject x="50" y="140" width="${width - 100}" height="${height - 200}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color: #d1fae5; font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5; word-wrap: break-word;">
            <p><strong>Compiled Prompt:</strong></p>
            <p style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; border-left: 3px solid #10b981;">${escapedPrompt}...</p>
          </div>
        </foreignObject>
        <text x="50" y="${height - 40}" font-family="system-ui, sans-serif" font-size="12" fill="#047857">OpenStory Studio — Production Frame Candidate</text>
      </svg>
    `;
    return Buffer.from(svg.trim(), 'utf-8');
  }
}
