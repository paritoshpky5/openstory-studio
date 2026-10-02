import { AudioProvider } from '../base-provider';
import { SarvamAudioProvider } from './sarvam-provider';
import { ElevenLabsAudioProvider } from './elevenlabs-provider';

export interface VoiceOption {
  id: string;
  provider: 'SARVAM' | 'ELEVENLABS';
  name: string;
  gender: 'MALE' | 'FEMALE';
  language: string;
  description: string;
  recommendedRole?: string;
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  // Sarvam Bulbul Hindi Native Voices
  {
    id: 'meera',
    provider: 'SARVAM',
    name: 'Meera',
    gender: 'FEMALE',
    language: 'Hindi (Native)',
    description: 'Calm, clear, and expressive female voice ideal for cinematic narration.',
    recommendedRole: 'Narrator / Female Lead',
  },
  {
    id: 'pavithra',
    provider: 'SARVAM',
    name: 'Pavithra',
    gender: 'FEMALE',
    language: 'Hindi (Native)',
    description: 'Soft, gentle, and warm female voice.',
    recommendedRole: 'Young Female Character / Princess',
  },
  {
    id: 'maitreyi',
    provider: 'SARVAM',
    name: 'Maitreyi',
    gender: 'FEMALE',
    language: 'Hindi (Native)',
    description: 'Authoritative, dramatic, and emotionally rich female voice.',
    recommendedRole: 'Mother / Queen / Goddess',
  },
  {
    id: 'arvind',
    provider: 'SARVAM',
    name: 'Arvind',
    gender: 'MALE',
    language: 'Hindi (Native)',
    description: 'Clear, modern, narrative male voice with steady cadence.',
    recommendedRole: 'Narrator / Male Hero',
  },
  {
    id: 'amartya',
    provider: 'SARVAM',
    name: 'Amartya',
    gender: 'MALE',
    language: 'Hindi (Native)',
    description: 'Deep, resonant, commanding male voice with epic weight.',
    recommendedRole: 'King / Warrior / Villian / Sage',
  },
  {
    id: 'diwakar',
    provider: 'SARVAM',
    name: 'Diwakar',
    gender: 'MALE',
    language: 'Hindi (Native)',
    description: 'Traditional folkloric Indian storytelling cadence.',
    recommendedRole: 'Traditional Storyteller / Elder',
  },
  // ElevenLabs Multilingual Voices
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    provider: 'ELEVENLABS',
    name: 'Rachel (Multilingual)',
    gender: 'FEMALE',
    language: 'Multilingual v2',
    description: 'Calm, professional international tone.',
    recommendedRole: 'Modern Documentary / Narration',
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    provider: 'ELEVENLABS',
    name: 'Adam (Multilingual)',
    gender: 'MALE',
    language: 'Multilingual v2',
    description: 'Deep, warm, and engaging American-accented multilingual voice.',
    recommendedRole: 'Documentary Narrator',
  },
];

export function getAudioProvider(providerName: string): AudioProvider {
  switch (providerName.toUpperCase()) {
    case 'SARVAM':
      return new SarvamAudioProvider();
    case 'ELEVENLABS':
      return new ElevenLabsAudioProvider();
    default:
      // Default to Sarvam for Hindi stories
      return new SarvamAudioProvider();
  }
}
