import { describe, it, expect } from 'vitest';
import { validateStoryFlowJson, StoryFlowProjectSchema } from '../storyflow.schema';
import { DEFAULT_HINDI_CINEMATIC_STYLE } from '../style.schema';

describe('StoryFlow Zod Schemas', () => {
  const validPayload = {
    schemaVersion: '1.0.0',
    project: {
      name: 'Ramu Ki Kahaani',
      description: 'A touching rural tale',
      aspectRatio: '16:9',
      fps: 24,
      targetLanguage: 'hi-IN',
    },
    styleBible: DEFAULT_HINDI_CINEMATIC_STYLE,
    characters: [
      {
        id: 'char_ramu',
        name: 'Ramu',
        role: 'PROTAGONIST',
        ageDescription: '45-year-old farmer',
        faceDescription: 'Warm weathered oval face with gentle crow feet',
        skinDescription: 'Warm dusky wheatish skin tone',
        eyeDescription: 'Soulful deep brown eyes',
        hairDescription: 'Dark wavy hair with silver temples',
        bodyDescription: 'Lean wiry build',
        clothingDescription: 'Faded saffron kurta with off-white dhoti',
        consistencyPrompt: 'Ramu, 45-year-old Indian farmer with warm dusky skin in saffron kurta',
        negativeConsistencyPrompt: 'western clothes, suit, clean shaven, fair skin',
        isLocked: true,
      },
    ],
    scenes: [
      {
        sceneNumber: 1,
        title: 'Morning in the field',
        importance: 'NORMAL',
        status: 'NOT_STARTED',
        location: 'Mustard field in Punjab',
        timeOfDay: 'Morning golden hour',
        environment: 'Dew-covered mustard plants',
        lighting: 'Warm sunrise key light',
        mood: 'Hopeful',
        summary: 'Ramu inspects his mustard flowers at dawn.',
        characterIds: ['char_ramu'],
        narrationHindi: 'सूरज की पहली किरण खेतों पर पड़ रही थी।',
        shotType: 'MEDIUM',
        cameraAngle: 'EYE_LEVEL',
        cameraMovement: 'Slow Dolly In',
        motionPreset: 'NATURAL',
        durationSeconds: 4.5,
        shots: [
          {
            shotNumber: 1,
            description: 'Ramu smiles gently at dawn in the field.',
            duration: 4.5,
          },
        ],
      },
    ],
  };

  it('successfully validates a complete valid StoryFlow project payload', () => {
    const result = validateStoryFlowJson(validPayload);
    expect(result.success).toBe(true);
    expect(result.data?.project.name).toBe('Ramu Ki Kahaani');
    expect(result.data?.characters).toHaveLength(1);
    expect(result.data?.scenes).toHaveLength(1);
  });

  it('rejects invalid schemaVersion with human-readable error', () => {
    const invalid = { ...validPayload, schemaVersion: '2.0.0' };
    const result = validateStoryFlowJson(invalid);
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('schemaVersion');
  });

  it('rejects payload with empty characters list', () => {
    const invalid = { ...validPayload, characters: [] };
    const result = validateStoryFlowJson(invalid);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('character'))).toBe(true);
  });

  it('rejects payload with empty scenes list', () => {
    const invalid = { ...validPayload, scenes: [] };
    const result = validateStoryFlowJson(invalid);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('scene'))).toBe(true);
  });
});
