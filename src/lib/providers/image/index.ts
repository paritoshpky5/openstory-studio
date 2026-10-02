import { ImageProvider } from '../base-provider';
import { FluxProvider } from './flux-provider';
import { GeminiImageProvider } from './gemini-provider';
import { OpenAIImageProvider } from './openai-provider';

export function getImageProvider(providerName: string): ImageProvider {
  switch (providerName.toUpperCase()) {
    case 'FLUX':
    case 'BLACK_FOREST_LABS':
      return new FluxProvider();
    case 'GEMINI':
    case 'GOOGLE':
    case 'IMAGEN':
      return new GeminiImageProvider();
    case 'OPENAI':
    case 'DALLE':
      return new OpenAIImageProvider();
    default:
      throw new Error(`Unsupported image provider: ${providerName}. Supported: FLUX, GEMINI, OPENAI`);
  }
}

export { FluxProvider, GeminiImageProvider, OpenAIImageProvider };
