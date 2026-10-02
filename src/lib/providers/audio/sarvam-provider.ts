import { AudioProvider, ModelDefinition } from '../base-provider';
import { generateMockWavBuffer } from '@/lib/audio/wav-generator';

export class SarvamAudioProvider extends AudioProvider {
  readonly providerName = 'SARVAM';

  getSupportedModels(): ModelDefinition[] {
    return [
      {
        id: 'bulbul:v3',
        provider: 'SARVAM',
        displayName: 'Sarvam Bulbul TTS',
        type: 'AUDIO',
        channel: 'DIRECT_API',
        capabilities: { supportsLipSync: false },
        pricing: { perMillionTokens: 2.0, currency: 'USD' },
      },
    ];
  }

  estimateCost(modelId: string, settings: any): number {
    const chars = settings?.characterCount || 100;
    return (2.0 / 1_000_000) * chars;
  }

  async generateAudio(
    modelId: string,
    text: string,
    voiceId: string,
    settings: any = {}
  ): Promise<{ buffer: Buffer }> {
    const apiKey = process.env.SARVAM_API_KEY;

    // Check for real API call vs Mock fallback
    if (!apiKey && process.env.OPENSTORY_DEMO_MODE === 'true') {
      console.warn('[SarvamAudioProvider] SARVAM_API_KEY not found. Using local mock audio generation.');
      // Estimate duration: roughly 1 second per ~15 characters of Hindi text, minimum 1.5s
      const estimatedDuration = Math.max(1.5, Math.min(15.0, text.length / 15.0));
      const buffer = generateMockWavBuffer(estimatedDuration, 440);
      return { buffer };
    }
    if (!apiKey) throw new Error('SARVAM_API_KEY is not configured. Use Free Web audio upload mode instead.');

    const legacyVoiceMap: Record<string, string> = {
      meera: 'ritu', pavithra: 'pooja', maitreyi: 'kavya',
      arvind: 'rahul', amartya: 'amit', diwakar: 'shubh',
    };
    const speaker = legacyVoiceMap[voiceId] || voiceId || 'shubh';
    const pace = Math.max(0.5, Math.min(2.0, settings.pace ?? 1.0));
    const temperature = Math.max(0.01, Math.min(2.0, settings.temperature ?? 0.6));

    try {
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify({
          text,
          language_code: 'hi-IN',
          speaker: speaker,
          pace: pace,
          temperature,
          speech_sample_rate: 24000,
          output_audio_codec: 'wav',
          model: modelId === 'bulbul:v1' ? 'bulbul:v3' : (modelId || 'bulbul:v3'),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sarvam TTS error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      if (!data.audios || !data.audios[0]) {
        throw new Error('Sarvam TTS returned empty audio list');
      }

      const base64Audio = data.audios[0];
      const buffer = Buffer.from(base64Audio, 'base64');
      return { buffer };
    } catch (error: any) {
      console.error('[SarvamAudioProvider] Generation failed:', error);
      throw error;
    }
  }
}
