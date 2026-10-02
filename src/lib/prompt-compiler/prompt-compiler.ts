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
          c.consistencyPrompt,
          `wearing ${c.clothingDescription}`,
          c.accessories ? `with ${c.accessories}` : '',
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
      `Cinematography: ${scene.shotType.toLowerCase().replace('_', ' ')} shot, ${scene.cameraAngle.toLowerCase().replace('_', ' ')} angle. Lens: ${styleBible.lensStyle}. Depth of field: ${styleBible.depthOfFieldStyle}.`,
      // 6. Materials & Shaders
      `Materials: ${styleBible.materialStyle}. ${styleBible.renderStyle}. Color grading: ${styleBible.colorLanguage}.`,
      // 7. Continuity lock
      'Strict character consistency, highly detailed facial anatomy, intact clothing textures, no deformities.',
    ]
      .filter(Boolean)
      .join(' ');

    const negativePrompt = [
      styleBible.negativePrompt,
      ...characters.map((c) => c.negativeConsistencyPrompt),
      'photorealistic live-action human faces, uncanny valley skin, blurry edges, extra hands, mutated limbs, asymmetrical clothing',
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
      .map((c) => {
        return `A stylized 3D animated character named ${c.name} (${c.ageDescription}, ${c.skinDescription}, ${c.faceDescription}, ${c.hairDescription}, wearing ${c.clothingDescription}).`;
      })
      .join(' ');

    const positivePrompt = [
      `A high-end cinematic stylized 3D animated movie production frame.`,
      charDetails,
      `Action: ${shotDesc}. Emotional mood: ${scene.mood}.`,
      `Environment: ${scene.location} in ${scene.environment} during ${scene.timeOfDay}.`,
      `Atmosphere and Lighting: ${scene.lighting}, with ${styleBible.lightingStyle}.`,
      `Cinematography: Filmed as a ${scene.shotType.toLowerCase()} shot with a ${styleBible.lensStyle} cinema lens, ${styleBible.depthOfFieldStyle}, ${scene.cameraAngle.toLowerCase()} perspective.`,
      `Art Direction: ${styleBible.renderStyle}, rich Indian textile textures, authentic cultural ambiance, subtle subsurface scattering on skin.`,
    ]
      .filter(Boolean)
    .join(' ');

    const negativePrompt = [
      styleBible.negativePrompt,
      ...characters.map((c) => c.negativeConsistencyPrompt),
    ].join(', ');

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
      .map((c) => {
        return `${c.name} is a stylized 3D animated ${c.ageDescription} with ${c.skinDescription}, ${c.eyeDescription}, and ${c.hairDescription}. Dressed in ${c.clothingDescription}.`;
      })
      .join(' ');

    const positivePrompt = `A production keyframe from a high-budget stylized 3D animated feature film set in India.
${charBlocks}
Current Shot: ${shotDesc}
The scene takes place at ${scene.location} surrounded by ${scene.environment} during ${scene.timeOfDay}.
Lighting and Color: ${scene.lighting}. ${styleBible.colorLanguage}. Warm atmospheric glow with soft volumetric light.
Camera Setup: ${scene.shotType.toLowerCase()} view framed at ${scene.cameraAngle.toLowerCase()} with a ${styleBible.lensStyle} lens. Soft background blur with creamy cinematic depth of field.
Aesthetic: Stylized 3D CGI with soft subsurface scattering on skin, detailed fabric weave on clothing, physically plausible clay and brass textures. Rich, emotional, cinematic storytelling.`;

    const negativePrompt = styleBible.negativePrompt;

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
      NATURAL: 'Natural human motion: deliberate gestures, organic body weight shift, natural breathing cadence and eyelid movements.',
      MODERATE: 'Clear continuous movement: walking, turning around, handling props with natural weight and inertia.',
      DYNAMIC: 'Energetic cinematic motion: swift physical reactions, brisk walking, sudden turn towards light.',
    }[motionPreset];

    const motionPrompt = [
      // 1. Primary Subject Motion
      `${charNames || 'The subject'} moves with natural, restrained cinematic animation. ${shotDesc}.`,
      // 2. Facial & Emotional Micro-Motion
      `Subtle facial expression shift reflecting ${scene.mood.toLowerCase()}: gentle eye movements, natural blinks, quiet breathing cycles.`,
      // 3. Secondary Animation (Hair, Fabric, Environment)
      `Subtle secondary movement in cloth folds and hair responding to gentle ambient air. Environmental motion: ${scene.ambiencePrompt || 'soft atmospheric breeze'}.`,
      // 4. Camera Trajectory
      `Camera movement: ${cameraMovement}. Controlled, smooth, steady cinematic trajectory.`,
      // 5. Preset pacing
      presetGuidance,
      // 6. Identity & Continuity Lock
      `CRITICAL: Preserve exact character facial structure, skin tone, hair, and clothing from the reference image. No body distortion.`,
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
