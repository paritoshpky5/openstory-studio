export interface VideoModelOption {
  id: string;
  provider: 'KLING' | 'SEEDANCE' | 'MOCK_VIDEO';
  name: string;
  description: string;
  recommendedFor: string;
  costPerSec: string;
}

export const AVAILABLE_VIDEO_MODELS: VideoModelOption[] = [
  {
    id: 'kling-v1',
    provider: 'KLING',
    name: 'Kling 1.0 (Standard)',
    description: 'Cinematic image-to-video with natural walking, body motion, and controlled camera moves.',
    recommendedFor: 'Cinematic shots, general motion, walking characters',
    costPerSec: '$0.05 / sec',
  },
  {
    id: 'kling-v1-5',
    provider: 'KLING',
    name: 'Kling 1.5 (Pro)',
    description: 'High-detail motion with precise physics and lighting consistency.',
    recommendedFor: 'Hero shots, close-up acting, dramatic transitions',
    costPerSec: '$0.10 / sec',
  },
  {
    id: 'seedance-v1',
    provider: 'SEEDANCE',
    name: 'Seedance 1.0 (Narrative Acting)',
    description: 'Optimized for expressive acting, facial micro-expressions, and dialogue rhythm.',
    recommendedFor: 'Dialogue scenes, acting sequences',
    costPerSec: '$0.06 / sec',
  },
  {
    id: 'seedance-pro',
    provider: 'SEEDANCE',
    name: 'Seedance Pro (Multi-Character)',
    description: 'Heavy multi-character interactions, dynamic action, and complex blocking.',
    recommendedFor: 'Crowds, fights, multi-character interactions',
    costPerSec: '$0.12 / sec',
  },
];
