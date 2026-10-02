# OpenStory Studio — Prompt Compiler Architecture

The `PromptCompiler` is the translation layer between high-level film narrative intent and low-level diffusion/video models.

## Philosophy: Never Send Raw Prompts Directly

Raw narrative summaries are unsuitable for production generation:
- They lack technical lighting, lens optics, and render shader parameters.
- They fail to enforce locked character traits (clothing, face, skin, accessories).
- They cause character drift between shots.

---

## 1. Image Prompt Hierarchy

The `PromptCompiler.compileForImage()` engine synthesizes seven distinct layers:

1. **Master Style & Medium**: Inherited from locked `StyleBible` (e.g. *Polished cinematic stylized 3D animated film aesthetic, rich Indian narrative cinema, detailed cloth micro-textures...*).
2. **Subject Identity & Continuity**: Injected from locked `CharacterIdentityPackage` (consistency token, locked clothing description, accessories, expressive mood).
3. **Action & Shot Specifics**: Extracted from `Shot.description` or `Scene.summary`.
4. **Setting & Environment**: Authentic regional Indian environment (`Scene.location`, `Scene.environment`, `Scene.timeOfDay`).
5. **Lighting & Atmosphere**: Directional, volumetric, and bounce light vectors (`Scene.lighting`, `StyleBible.lightingStyle`).
6. **Cinematography & Optics**: Shot type (Close Up, Medium, Establishing), camera angle (Eye Level, Low Angle), lens choice (50mm/85mm primes), and bokeh depth of field.
7. **Materials & Render Shaders**: Physical roughness, subsurface scattering on skin, handwoven cotton, weathered brass, and color grading.

---

## 2. Provider-Specific Compilers

- **`compileForFlux()`**: Rich natural language paragraphs detailing micro-textures, material weave, and physical lighting vectors. Negative prompt includes character-specific drift constraints.
- **`compileForGemini()`**: Structured cinematic production keyframe framing, emphasizing Indian cultural authenticity and emotional facial nuance.
- **`compileForOpenAI()`**: High-budget stylized 3D animation feature film description, avoiding trademark studio terms (e.g. "Pixar", "Disney") while preserving technical depth.

---

## 3. Motion Prompt Compiler (`compileForMotion()`)

**Critical rule**: The motion prompt does **NOT** repeat the massive visual description already present in the source image.

Instead, it specifies:
1. **Primary Subject Motion**: Pacing and direction of character movement.
2. **Facial Micro-Expressions**: Eye shifts, natural blinks, breathing cadence, subtle smiles or frowns.
3. **Secondary Physics**: Loose fabric folds, hair strands, and environmental movement (dust motes, rustling leaves).
4. **Camera Trajectory**: Controlled cinematic presets (Slow Dolly In, Arc Left, Tracking Forward).
5. **Pacing Preset**: `STATIC_PLUS`, `VERY_SUBTLE`, `NATURAL`, `MODERATE`, `DYNAMIC`.
6. **Identity Lock Constraints**: "CRITICAL: Preserve exact character facial structure, skin tone, hair, and clothing from the reference image. No morphing."
