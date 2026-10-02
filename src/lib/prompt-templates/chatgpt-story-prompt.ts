export interface StoryPromptOptions {
  userStoryText?: string;
  narrationMode?: 'SOLO_STORYTELLER' | 'DRAMATIC_DIALOGUE' | 'MINIMAL_NARRATION';
  narratorTone?: string;
}

/**
 * Generates the ChatGPT Story Planning Master Prompt that the user can copy
 * and paste into ChatGPT or Claude alongside their story concept.
 */
export function generateChatGPTStoryPrompt(options?: StoryPromptOptions | string): string {
  let userStoryText: string | undefined;
  let narrationMode: 'SOLO_STORYTELLER' | 'DRAMATIC_DIALOGUE' | 'MINIMAL_NARRATION' = 'SOLO_STORYTELLER';
  let narratorTone = 'Warm, engaging traditional Indian katha-vachak (दादी-नानी या ज्ञानी सूत्रधार की शैली)';

  if (typeof options === 'string') {
    userStoryText = options;
  } else if (options) {
    userStoryText = options.userStoryText;
    if (options.narrationMode) narrationMode = options.narrationMode;
    if (options.narratorTone) narratorTone = options.narratorTone;
  }

  // Voice architecture instructions based on user selection
  let voiceRuleSection = '';
  if (narrationMode === 'SOLO_STORYTELLER') {
    voiceRuleSection = `4. HINDI NARRATION ARCHITECTURE (STRICT SINGLE STORYTELLER / KATHA-VACHAK MODE):
   - CRITICAL REQUIREMENT: This entire film will be voiced by ONE SINGLE SPEAKER as a Master Storyteller (एकल सूत्रधार / कथावाचक).
   - DO NOT create separate character speech tracks. For EVERY scene, set "dialogueHindi": null and "speakingCharacterId": null.
   - Put 100% of the spoken text inside "narrationHindi".
   - When characters speak in the story, the narrator delivers their words in storytelling indirect/direct style (e.g. 'तभी रामू ने मुस्कुराते हुए कहा कि चिंता मत करो...', rather than standalone dialogue tracks).
   - Desired Narrator Tone: ${narratorTone}.
   - Write warm, emotionally authentic Hindi in DEVANAGARI script.`;
  } else if (narrationMode === 'DRAMATIC_DIALOGUE') {
    voiceRuleSection = `4. HINDI DIALOGUE & NARRATION (MULTI-CHARACTER DRAMATIC DIALOGUE + NARRATOR):
   - Characters have distinct spoken lines in "dialogueHindi" and "speakingCharacterId" matching their character ID.
   - "narrationHindi" is used to set the scene, describe emotional transitions, and conclude shots.
   - Tone: Cinematic, character-driven Indian cinema. Write in authentic Devanagari script.`;
  } else {
    voiceRuleSection = `4. HINDI DIALOGUE & NARRATION (ACTION & DIALOGUE DRIVEN):
   - Focus primarily on character conversations ("dialogueHindi" with "speakingCharacterId").
   - Use "narrationHindi" sparingly (only for the opening hook and final moral/resolution).
   - Write in authentic Devanagari script.`;
  }

  return `You are a master cinematic film director and AI animation screenwriter specializing in emotionally powerful, visually stunning Indian animated stories (in the aesthetic style of high-end stylized 3D animation, rich cultural environments, expressive characters, and cinematic lighting).

Your task is to analyze the story provided below and decompose it into a complete, production-ready OpenStory Studio JSON project file adhering to schemaVersion "1.0.0".

CRITICAL FILMMAKING & CONSISTENCY RULES:
1. DO NOT GENERATE ONE GIANT VIDEO. Break the story into short cinematic shots/scenes (each 3 to 8 seconds).
2. CHARACTER CONSISTENCY IS SUPREME:
   - For every major recurring character, create a rigorous "CharacterIdentityPackage".
   - Specify age, exact facial traits, warm Indian skin tone, eyes, hair texture, body proportions, and PRECISE clothing details (colors, textiles, patterns, accessories).
   - Character reference assets will include PRIMARY_FACE and PRIMARY_FULL_BODY for consistency.
   - Character clothes and features must remain strictly consistent across scenes.
3. VISUAL STYLE:
   - Polished cinematic stylized 3D animated film aesthetic.
   - Rich Indian environmental atmosphere (earthen walls, brass pots, golden hour lighting, vibrant fabrics).
   - Natural subsurface scattering on skin, controlled depth of field.
   - Do NOT use copyrighted franchise/studio names (e.g. do not say "Pixar" or "Disney"). Use technical artistic descriptors.
${voiceRuleSection}
5. CINEMATOGRAPHY:
   - Controlled camera motion: "Locked Camera", "Slow Dolly In", "Slow Dolly Out", "Pan Left", "Pan Right", "Tilt Up", "Tilt Down", "Arc Left", "Arc Right", "Tracking Forward", "Tracking Backward", "Subtle Handheld".
   - Motion presets: "STATIC_PLUS", "VERY_SUBTLE", "NATURAL", "MODERATE", "DYNAMIC".
   - Scene importance: "BACKGROUND", "NORMAL", "IMPORTANT", "HERO".

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact structure with no markdown code blocks around it or inside standard triple-backtick json:

{
  "schemaVersion": "1.0.0",
  "project": {
    "name": "Title of the Story",
    "description": "Brief narrative overview",
    "aspectRatio": "16:9",
    "fps": 24,
    "targetLanguage": "hi-IN"
  },
  "styleBible": {
    "masterStylePrompt": "Polished cinematic stylized 3D animated film aesthetic, rich Indian narrative cinema, detailed cloth micro-textures, expressive Indian character design, soft cinematic global illumination, physically plausible rim lighting, controlled shallow depth of field, premium feature-animation composition.",
    "characterStyle": "Stylized 3D animated Indian characters with expressive facial features, lifelike skin subsurface scattering without photorealism uncanny valley, anatomically proportioned with gentle animated stylization.",
    "lightingStyle": "Cinematic three-point lighting with warm golden key light, soft atmospheric bounce, gentle rim accents, volumetric dust motes.",
    "renderStyle": "Stylized octane render aesthetic, soft shadows, raytraced ambient occlusion, subsurface scattering on skin, high-end 3D animated film look.",
    "environmentStyle": "Richly detailed Indian rural/urban settings, weathered terracotta textures, earthen walls, handwoven textiles, authentic flora.",
    "colorLanguage": "Harmonious warm palette dominated by ochre, deep saffron, terracotta, marigold, indigo, and forest greens.",
    "cameraStyle": "Deliberate cinematic camera placement, eye-level intimate framing, slow dolly and tracking movements.",
    "lensStyle": "50mm and 85mm prime cinema lenses for character close-ups; 28mm for establishing vistas.",
    "depthOfFieldStyle": "Shallow depth of field with creamy bokeh, isolating character emotional expressions.",
    "animationStyle": "Weighty natural human movement, subtle facial micro-expressions, breathing cycles, authentic cultural gestures.",
    "materialStyle": "Tactile cotton, silk, khadi, weathered brass, clay pottery, carved teak wood, physical roughness maps.",
    "negativePrompt": "photorealistic human live-action, 2D flat cartoon, anime eyes, low poly, plastic skin, oversaturated neon, amateur CGI, watermark, blurry, extra limbs, distorted hands, morphing clothes",
    "aspectRatio": "16:9",
    "fps": 24,
    "isLocked": false
  },
  "characters": [
    {
      "id": "char_ramu",
      "name": "Ramu",
      "role": "PROTAGONIST",
      "gender": "Male",
      "ageDescription": "45-year-old Indian farmer",
      "faceDescription": "Weathered compassionate face, gentle crow's feet around eyes, strong jawline, warm demeanor",
      "skinDescription": "Sun-kissed warm dusky wheatish Indian skin tone",
      "eyeDescription": "Deep brown soulful expressive eyes with crinkles of kindness",
      "hairDescription": "Wavy black hair touched with silver strands at temples, tucked under a loose turban",
      "facialHairDescription": "Neat salt-and-pepper mustache",
      "bodyDescription": "Lean, wiry, hardworking posture with slightly rounded shoulders from years of farming",
      "heightDescription": "5 feet 8 inches",
      "clothingDescription": "Faded saffron-ochre cotton kurta with handstitched hem, off-white cotton dhoti, coarse marigold-colored pagri (turban)",
      "footwearDescription": "Worn traditional brown leather mojari",
      "accessories": "Simple black thread around right wrist",
      "personality": "Resilient, patient, devoted father and husband, quietly dignified",
      "defaultExpressions": "Thoughtful, gentle smile, introspective gaze",
      "consistencyPrompt": "Ramu, a 45-year-old Indian farmer with warm dusky skin, deep brown expressive eyes, salt-and-pepper mustache, wearing a faded saffron-ochre cotton kurta, off-white dhoti, and marigold pagri turban",
      "negativeConsistencyPrompt": "different clothing, Western shirt, clean shaven, missing turban, fair European skin, youthful face, modern glasses",
      "isLocked": true,
      "referenceAssets": []
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Evening in the Mustard Field",
      "importance": "NORMAL",
      "status": "NOT_STARTED",
      "location": "Yellow mustard farm outside a Punjab village",
      "timeOfDay": "Golden hour before sunset",
      "environment": "Vast blooming yellow mustard fields stretching towards mud-brick village rooftops in the distance",
      "lighting": "Low golden sun casting long dramatic shadows and warm rim light on Ramu's turban",
      "mood": "Peaceful yet filled with quiet anticipation",
      "summary": "Ramu stands among the golden mustard blooms, gently touching the crops as the evening breeze rustles the field.",
      "characterIds": ["char_ramu"],
      "narrationHindi": "सूरज ढलने को था और सरसों के पीले फूल सुनहरी धूप में चमक रहे थे। रामू अपनी मेहनत को देखकर एक गहरी सांस लेता है।",
      "dialogueHindi": ${narrationMode === 'SOLO_STORYTELLER' ? 'null' : '"मेरी फसल इस बार अच्छी होगी..."'},
      "speakingCharacterId": ${narrationMode === 'SOLO_STORYTELLER' ? 'null' : '"char_ramu"'},
      "shotType": "MEDIUM",
      "cameraAngle": "EYE_LEVEL",
      "cameraMovement": "Slow Dolly In",
      "motionPreset": "NATURAL",
      "durationSeconds": 4.5,
      "ambiencePrompt": "Gentle evening breeze rustling mustard plants, distant evening birds, village bell far away",
      "sfxPrompt": "Soft rustle of cloth and leaves as hands brush plants",
      "musicMood": "Warm acoustic sarangi and flute, subtle and emotional",
      "orderIndex": 0,
      "shots": [
        {
          "shotNumber": 1,
          "description": "Medium shot of Ramu smiling gently as his fingers touch the mustard flowers under the golden sunset.",
          "duration": 4.5
        }
      ]
    }
  ]
}

${
  userStoryText
    ? `\n--- USER STORY TO DECOMPOSE ---\n${userStoryText}`
    : '\n[PASTE YOUR RAW STORY OR SCRIPT HERE]'
}`;
}
