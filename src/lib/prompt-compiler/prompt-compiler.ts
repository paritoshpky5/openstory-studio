import { StyleBibleInput } from '@/schemas/style.schema';
import { CharacterIdentityPackage } from '@/schemas/character.schema';
import { SceneInput, ShotInput } from '@/schemas/scene.schema';

export interface CompiledImagePrompt {
  provider: 'FLUX' | 'GEMINI' | 'OPENAI' | 'GENERIC';
  positivePrompt: string;
  negativePrompt: string;
  aspectRatio: string;
  referenceImagePaths: string[];
  metadata: {
    charactersIncluded: string[];
    cameraSetup: string;
    lightingSetup: string;
    locationSetup: string;
  };
}

export interface CompiledMotionPrompt {
  provider: 'KLING' | 'SEEDANCE' | 'GROK' | 'VEO' | 'GENERIC';
  motionPrompt: string;
  negativeMotionPrompt: string;
  cameraMovement: string;
  motionPreset: string;
  durationSeconds: number;
}

export interface PromptCompilerInput {
  styleBible: StyleBibleInput;
  characters: CharacterIdentityPackage[];
  scene: SceneInput;
  shot?: ShotInput;
  activeReferences?: { characterId: string; filePath: string; type: string }[];
}

function humanize(value?: string | null, fallback = 'eye level') {
  return (value || fallback).replaceAll('_', ' ').toLowerCase();
}

function selectLens(shotType?: string | null) {
  const shot = (shotType || '').toUpperCase();
  if (shot.includes('WIDE') || shot === 'ESTABLISHING') return '28mm prime cinema lens';
  if (shot.includes('CLOSE')) return '85mm prime cinema lens';
  return '50mm prime cinema lens';
}

function fixedCharacterDescription(character: CharacterIdentityPackage) {
  return [
    character.consistencyPrompt,
    character.heightDescription ? `fixed scale: ${character.heightDescription}` : '',
  ].filter(Boolean).join(', ');
}

export class PromptCompiler {
  /**
   * Compiles provider-tailored image prompts combining style, characters, environment, lighting, and camera.
   */
  static compileForImage(
    input: PromptCompilerInput,
    provider: 'FLUX' | 'GEMINI' | 'OPENAI' | 'GENERIC' = 'GENERIC'
  ): CompiledImagePrompt {
    switch (provider) {
      case 'FLUX':
        return this.compileForFlux(input);
      case 'GEMINI':
        return this.compileForGemini(input);
      case 'OPENAI':
        return this.compileForOpenAI(input);
      default:
        return this.compileForGeneric(input);
    }
  }

  /**
   * Black Forest Labs / FLUX compiler.
   * Excels with rich descriptive narrative sentences, material textures, and precise lighting vectors.
   */
  static compileForFlux(input: PromptCompilerInput): CompiledImagePrompt {
    const { styleBible, characters, scene, shot } = input;
    const shotDesc = shot?.description || scene.summary;

    const charDescriptions = characters
      .map((c) => {
        const lockedDetails = [
          fixedCharacterDescription(c),
          `expressive facial expression matching ${scene.mood.toLowerCase()}`,
        ]
          .filter(Boolean)
          .join(', ');
        return lockedDetails;
      })
      .join('. In the scene alongside: ');

    const positivePrompt = [
      // 1. Core Visual Style & Medium
      `${styleBible.masterStylePrompt}.`,
      // 2. Main Subject & Action
      charDescriptions ? `Characters: ${charDescriptions}.` : '',
      `Action: ${shotDesc}.`,
      // 3. Location & Environment
      `Setting: ${scene.location}, ${scene.environment}. ${scene.timeOfDay}.`,
      // 4. Lighting & Atmosphere
      `Lighting: ${scene.lighting}. ${styleBible.lightingStyle}.`,
      // 5. Cinematography & Optics
      `Cinematography: ${humanize(scene.shotType, 'medium')} shot, ${humanize(scene.cameraAngle)} angle. Lens: ${selectLens(scene.shotType)}. Depth of field: ${styleBible.depthOfFieldStyle}. Keep every named subject fully readable with clear silhouettes and grounded feet.`,
      // 6. Materials & Shaders
      `Materials: ${styleBible.materialStyle}. ${styleBible.renderStyle}. Color grading: ${styleBible.colorLanguage}.`,
      // 7. Continuity lock
      `Strict continuity: exactly ${characters.length || 1} named subject${characters.length === 1 ? '' : 's'}, stable identity, scale, anatomy, colors, markings, clothing, accessories, and left/right placement. Clean cinematic frame with no text.`,
    ]
      .filter(Boolean)
      .join(' ');

    const negativePrompt = [
      styleBible.negativePrompt,
      ...characters.map((c) => c.negativeConsistencyPrompt),
      'photorealistic live-action human faces, uncanny valley skin, blurry edges, extra hands, extra paws, mutated limbs, asymmetrical clothing, duplicate character, wrong character count, identity drift, costume redesign, floating feet, broken ground contact, text, caption, logo, watermark, border',
    ]
      .filter(Boolean)
      .join(', ');

    return {
      provider: 'FLUX',
      positivePrompt,
      negativePrompt,
      aspectRatio: styleBible.aspectRatio,
      referenceImagePaths: input.activeReferences?.map((r) => r.filePath) || [],
      metadata: {
        charactersIncluded: characters.map((c) => c.name),
        cameraSetup: `${scene.shotType} ${scene.cameraAngle} (${styleBible.lensStyle})`,
        lightingSetup: `${scene.lighting} | ${scene.timeOfDay}`,
        locationSetup: scene.location,
      },
    };
  }

  /**
   * Google Gemini Image Generation compiler.
   * Excels with natural cinematic framing, vivid cultural environmental authenticity, and expressive emotional nuance.
   */
  static compileForGemini(input: PromptCompilerInput): CompiledImagePrompt {
    const { styleBible, characters, scene, shot } = input;
    const shotDesc = shot?.description || scene.summary;

    const charDetails = characters
      .map((c) => `LOCKED CHARACTER — ${fixedCharacterDescription(c)}. Face: ${c.faceDescription}. Eyes: ${c.eyeDescription}.`)
      .join(' ');

    const positivePrompt = [
      `A high-end cinematic stylized 3D animated movie production frame.`,
      charDetails,
      `Action: ${shotDesc}. Emotional mood: ${scene.mood}.`,
      `Environment: ${scene.location} in ${scene.environment} during ${scene.timeOfDay}.`,
      `Atmosphere and Lighting: ${scene.lighting}, with ${styleBible.lightingStyle}.`,
      `Cinematography: ${humanize(scene.shotType, 'medium')} shot, ${humanize(scene.cameraAngle)} perspective, ${selectLens(scene.shotType)}, ${styleBible.depthOfFieldStyle}. ${scene.cameraMovement ? `Compose for a later ${humanize(scene.cameraMovement)} move.` : ''}`,
      `Art direction: ${styleBible.renderStyle}. ${styleBible.materialStyle}. ${styleBible.colorLanguage}.`,
      `Continuity contract: exactly ${characters.length || 1} named subject${characters.length === 1 ? '' : 's'}; preserve approved identity, anatomy, relative scale, colors, markings, clothing, accessories, and side placement. Maintain clear silhouettes, believable ground contact, consistent eyelines, and readable action. One 16:9 production frame only; no text or layout panels.`,
    ]
      .filter(Boolean)
    .join(' ');

    const negativePrompt = [
      styleBible.negativePrompt,
      ...characters.map((c) => c.negativeConsistencyPrompt),
      'duplicate character, wrong character count, identity drift, age change, species change, costume redesign, mirrored accessory, extra limbs, extra paws, fused bodies, floating feet, broken ground contact, mismatched eyeline, cropped ears, cropped shell, text, subtitle, caption, logo, watermark, border, contact sheet, split screen',
    ].filter(Boolean).join(', ');

    return {
      provider: 'GEMINI',
      positivePrompt,
      negativePrompt,
      aspectRatio: styleBible.aspectRatio,
      referenceImagePaths: input.activeReferences?.map((r) => r.filePath) || [],
      metadata: {
        charactersIncluded: characters.map((c) => c.name),
        cameraSetup: `${scene.shotType} ${scene.cameraAngle}`,
        lightingSetup: scene.lighting,
        locationSetup: scene.location,
      },
    };
  }

  /**
   * OpenAI Image Generation compiler (DALL-E 3 / GPT-image).
   * Excels with coherent narrative description, clear instruction adherence, and avoiding studio trademark terms.
   */
  static compileForOpenAI(input: PromptCompilerInput): CompiledImagePrompt {
    const { styleBible, characters, scene, shot } = input;
    const shotDesc = shot?.description || scene.summary;

    const charBlocks = characters
      .map((c) => `LOCKED CHARACTER: ${fixedCharacterDescription(c)}. ${c.faceDescription}. ${c.eyeDescription}.`)
      .join(' ');

    const positivePrompt = `A production keyframe from a high-budget stylized 3D animated feature film set in India.
${charBlocks}
Current Shot: ${shotDesc}
The scene takes place at ${scene.location} surrounded by ${scene.environment} during ${scene.timeOfDay}.
Lighting and Color: ${scene.lighting}. ${styleBible.colorLanguage}. Warm atmospheric glow with soft volumetric light.
Camera Setup: ${humanize(scene.shotType, 'medium')} view framed at ${humanize(scene.cameraAngle)} with a ${selectLens(scene.shotType)}. ${styleBible.depthOfFieldStyle}.
Aesthetic: ${styleBible.renderStyle}. ${styleBible.materialStyle}. ${styleBible.colorLanguage}.
Continuity contract: exactly ${characters.length || 1} named subject${characters.length === 1 ? '' : 's'} with the same approved identity, species, proportions, markings, clothing and accessories. Clear silhouettes, grounded feet, consistent eyelines, no text, no contact sheet.`;

    const negativePrompt = [
      styleBible.negativePrompt,
      ...characters.map((c) => c.negativeConsistencyPrompt),
      'duplicate character, wrong character count, identity drift, costume redesign, extra limbs, fused bodies, floating feet, text, subtitle, logo, watermark, border',
    ].filter(Boolean).join(', ');

    return {
      provider: 'OPENAI',
      positivePrompt,
      negativePrompt,
      aspectRatio: styleBible.aspectRatio,
      referenceImagePaths: input.activeReferences?.map((r) => r.filePath) || [],
      metadata: {
        charactersIncluded: characters.map((c) => c.name),
        cameraSetup: `${scene.shotType} ${scene.cameraAngle}`,
        lightingSetup: scene.lighting,
        locationSetup: scene.location,
      },
    };
  }

  /**
   * Generic baseline compiler.
   */
  static compileForGeneric(input: PromptCompilerInput): CompiledImagePrompt {
    return this.compileForFlux(input);
  }

  /**
   * Compiles the video/motion prompt for image-to-video models (Kling, Seedance, Grok, Veo).
   *
   * Crucial rule: Does NOT repeat huge image generation descriptions.
   * Instead focuses on subject motion, facial micro-movements, secondary cloth/hair physics,
   * camera trajectory, and strict identity preservation.
   */
  static compileForMotion(
    input: PromptCompilerInput,
    provider: 'KLING' | 'SEEDANCE' | 'GROK' | 'VEO' | 'GENERIC' = 'GENERIC'
  ): CompiledMotionPrompt {
    const { characters, scene, shot } = input;
    const shotDesc = shot?.description || scene.summary;

    const charNames = characters.map((c) => c.name).join(' and ');
    const cameraMovement = scene.cameraMovement || 'Slow Dolly In';
    const motionPreset = scene.motionPreset || 'NATURAL';

    // Tailor motion speed guidance based on preset
    const presetGuidance = {
      STATIC_PLUS: 'Extremely subtle living stillness: gentle breathing motion, tiny eye blinks, quiet ambient leaf rustling.',
      VERY_SUBTLE: 'Slow, restrained emotional performance: subtle head turn, gentle shift in gaze, micro-expressions.',
      NATURAL: 'Natural character motion: deliberate gestures, organic body weight shift, natural breathing cadence and eyelid movements.',
      MODERATE: 'Clear continuous movement: walking, turning around, handling props with natural weight and inertia.',
      DYNAMIC: 'Energetic cinematic motion: swift physical reactions, brisk walking, sudden turn towards light.',
    }[motionPreset];

    const motionPrompt = [
      // 1. Primary Subject Motion
      `${charNames || 'The subject'} ${characters.length === 1 ? 'moves' : 'move'} with natural, restrained cinematic animation. ${shotDesc}.`,
      // 2. Facial & Emotional Micro-Motion
      `Subtle facial expression shift reflecting ${scene.mood.toLowerCase()}: gentle eye movements, natural blinks, quiet breathing cycles.`,
      // 3. Secondary Animation (Hair, Fabric, Environment)
      `Subtle secondary movement in cloth folds when present; fur responds gently, shell remains rigid, and leaves and grass move in a soft atmospheric breeze.`,
      // 4. Camera Trajectory
      `Camera movement: ${cameraMovement}. Controlled, smooth, steady cinematic trajectory.`,
      // 5. Preset pacing
      presetGuidance,
      // 6. Identity & Continuity Lock
      `CRITICAL: Preserve exact character facial structure and the approved identity, species, fur or skin color, shell markings, body proportions, relative scale, clothing, and accessories. Keep anatomy stable from first frame to last. No unrequested speech or mouth movement.`,
    ]
      .filter(Boolean)
      .join(' ');

    const negativeMotionPrompt = [
      'face morphing',
      'clothing change',
      'identity shift',
      'duplicated people',
      'extra limbs',
      'unnatural jitter',
      'sudden camera jerk',
      'rapid erratic zooms',
      'morphing background',
      'flickering frames',
      'floating artifacts',
      'character distortion',
      'shell deformation',
      'fur color shift',
      'accessory swap',
      'unmotivated lip movement',
      'sliding feet',
      'broken ground contact',
      'speed ramp',
    ].join(', ');

    return {
      provider,
      motionPrompt,
      negativeMotionPrompt,
      cameraMovement,
      motionPreset,
      durationSeconds: scene.durationSeconds || 4.0,
    };
  }
}
