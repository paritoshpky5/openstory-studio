import { describe, it, expect } from 'vitest';
import { PromptCompiler, PromptCompilerInput } from '../prompt-compiler';
import { DEFAULT_HINDI_CINEMATIC_STYLE } from '@/schemas/style.schema';

describe('PromptCompiler Architecture', () => {
  const sampleInput: PromptCompilerInput = {
    styleBible: DEFAULT_HINDI_CINEMATIC_STYLE,
    characters: [
      {
        id: 'char_shyam',
        name: 'Shyam Kaka',
        role: 'PROTAGONIST',
        ageDescription: '56-year-old master potter',
        faceDescription: 'Warm weathered oval face with gentle smile lines',
        skinDescription: 'Warm copper-brown Indian skin tone',
        eyeDescription: 'Deep brown almond eyes',
        hairDescription: 'Thick wavy grey hair',
        facialHairDescription: 'Distinguished silver-grey mustache',
        bodyDescription: 'Sturdy posture',
        clothingDescription: 'Terracotta-brown khadi kurta with off-white dhoti',
        accessories: 'Red kalava thread on right wrist',
        consistencyPrompt: 'Shyam Kaka, 56-year-old Indian master potter, warm copper skin, grey mustache, terracotta kurta',
        negativeConsistencyPrompt: 'modern shirt, youthful face, fair skin, clean shaved',
        isLocked: true,
        referenceAssets: [],
      },
    ],
    scene: {
      orderIndex: 0,
      sceneNumber: 1,
      title: 'Monsoon in Pottery Courtyard',
      importance: 'NORMAL',
      status: 'NOT_STARTED',
      location: 'Rural Rajasthan courtyard',
      timeOfDay: 'Overcast twilight',
      environment: 'Shelves of terracotta pottery and earthen floor',
      lighting: 'Moody slate-blue ambient with warm oil lantern key',
      mood: 'Focused anticipation',
      summary: 'Shyam Kaka sits at his stone wheel shaping wet clay.',
      characterIds: ['char_shyam'],
      shotType: 'MEDIUM',
      cameraAngle: 'EYE_LEVEL',
      cameraMovement: 'Slow Dolly In',
      motionPreset: 'NATURAL',
      durationSeconds: 5.0,
      ambiencePrompt: 'Heavy raindrops beginning on tin roof',
      shots: [],
    },
  };

  it('compiles FLUX prompt with style, character consistency, clothing, and optics', () => {
    const compiled = PromptCompiler.compileForFlux(sampleInput);
    expect(compiled.provider).toBe('FLUX');
    expect(compiled.positivePrompt).toContain('Shyam Kaka');
    expect(compiled.positivePrompt).toContain('terracotta kurta');
    expect(compiled.positivePrompt).toContain('medium shot');
    expect(compiled.positivePrompt).toContain('50mm');
    expect(compiled.negativePrompt).toContain('modern shirt');
    expect(compiled.negativePrompt).toContain('photorealistic');
  });

  it('compiles Gemini prompt with narrative cultural framing and emotional mood', () => {
    const compiled = PromptCompiler.compileForGemini(sampleInput);
    expect(compiled.provider).toBe('GEMINI');
    expect(compiled.positivePrompt).toContain('stylized 3D animated movie production frame');
    expect(compiled.positivePrompt).toContain('Shyam Kaka');
    expect(compiled.positivePrompt).toContain('Focused anticipation');
    expect(compiled.negativePrompt).toContain('modern shirt');
  });

  it('compiles OpenAI prompt in cinematic narrative format without trademark studios', () => {
    const compiled = PromptCompiler.compileForOpenAI(sampleInput);
    expect(compiled.provider).toBe('OPENAI');
    expect(compiled.positivePrompt).toContain('stylized 3D animated feature film');
    expect(compiled.positivePrompt).not.toContain('Pixar');
    expect(compiled.positivePrompt).not.toContain('Disney');
    expect(compiled.positivePrompt).toContain('Shyam Kaka');
  });

  it('compiles motion prompt for video generation focusing on movement and continuity', () => {
    const compiled = PromptCompiler.compileForMotion(sampleInput, 'KLING');
    expect(compiled.provider).toBe('KLING');
    expect(compiled.motionPrompt).toContain('Camera movement: Slow Dolly In');
    expect(compiled.motionPrompt).toContain('Preserve exact character facial structure');
    expect(compiled.motionPrompt).toContain('Subtle secondary movement in cloth folds');
    expect(compiled.negativeMotionPrompt).toContain('face morphing');
    expect(compiled.negativeMotionPrompt).toContain('clothing change');
  });
});
