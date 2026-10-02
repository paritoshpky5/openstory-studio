import { VideoProvider } from '../base-provider';
import { KlingVideoProvider } from './kling-provider';
import { SeedanceVideoProvider } from './seedance-provider';
import { MockVideoProvider } from './mock-video-provider';

export function getVideoProvider(providerName: string): VideoProvider {
  switch (providerName.toUpperCase()) {
    case 'KLING':
      return new KlingVideoProvider();
    case 'SEEDANCE':
      return new SeedanceVideoProvider();
    case 'MOCK_VIDEO':
      return new MockVideoProvider();
    default:
      return new KlingVideoProvider();
  }
}

export { AVAILABLE_VIDEO_MODELS, type VideoModelOption } from './models';
