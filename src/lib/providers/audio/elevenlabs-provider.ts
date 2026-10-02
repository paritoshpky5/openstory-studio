import { AudioProvider, ModelDefinition } from '../base-provider';
import { generateMockWavBuffer } from '@/lib/audio/wav-generator';

export class ElevenLabsAudioProvider extends AudioProvider {
  readonly providerName = 'ELEVENLABS';

  getSupportedModels(): ModelDefinition[] {
    return [
      {
        id: 'eleven_multilingual_v2',
        provider: 'ELEVENLABS',
        displayName: 'ElevenLabs Multilingual v2',
        type: 'AUDIO',
        channel: 'DIRECT_API',
        capabilities: { supportsLipSync: false },
        pricing: { perMillionTokens: 30.0, currency: 'USD' },
      },
    ];
  }

  estimateCost(modelId: string, settings: any): number {
    const chars = settings?.characterCount || 100;
    return (30.0 / 1_000_000) * chars;
  }

  async generateAudio(
    modelId: string,
    text: string,
    voiceId: string,
    settings: any = {}
  ): Promise<{ buffer: Buffer }> {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey && process.env.OPENSTORY_DEMO_MODE === 'true') {
      console.warn('[ElevenLabsAudioProvider] ELEVENLABS_API_KEY not found. Using local mock audio generation.');
      const estimatedDuration = Math.max(1.5, Math.min(15.0, text.length / 15.0));
      const buffer = generateMockWavBuffer(estimatedDuration, 520);
      return { buffer };
    }
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured. Use Free Web audio upload mode instead.');

    const actualVoiceId = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel voice or configured voice
    const stability = settings.stability ?? 0.5;
    const similarityBoost = settings.similarityBoost ?? 0.75;
    const style = settings.style ?? 0.0;
    const useSpeakerBoost = settings.useSpeakerBoost ?? true;

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${actualVoiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: modelId || 'eleven_multilingual_v2',
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs TTS error (${response.status}): ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { buffer };
    } catch (error: any) {
      console.error('[ElevenLabsAudioProvider] Generation failed:', error);
      throw error;
    }
  }
}
