# OpenStory Studio — Story Schema Specification

Schema version: `1.0.0`

## Top-Level Schema Structure

A valid OpenStory project document contains four mandatory top-level sections:

```json
{
  "schemaVersion": "1.0.0",
  "project": { ... },
  "styleBible": { ... },
  "characters": [ ... ],
  "scenes": [ ... ]
}
```

---

## 1. Project Metadata (`project`)

| Field | Type | Description |
|---|---|---|
| `name` | string | Working title of the story film |
| `description` | string? | Brief narrative synopsis |
| `aspectRatio` | enum | `"16:9"`, `"9:16"`, `"1:1"`, `"2.39:1"` |
| `fps` | integer | Target frame rate (default: 24) |
| `targetLanguage` | string | Target voice language code (default: `"hi-IN"`) |
| `budgetLimit` | float? | Optional project cost alert ceiling |

---

## 2. Style Bible (`styleBible`)

The Style Bible defines technical cinematography, color language, and render shaders inherited by all prompt compilers.

- `masterStylePrompt`: Core overarching visual prompt (e.g. *Polished cinematic stylized 3D animated film aesthetic, rich Indian narrative cinema...*)
- `characterStyle`: Character design aesthetic (e.g. *Stylized 3D animated Indian characters with expressive facial features...*)
- `lightingStyle`: Lighting direction (e.g. *Warm golden hour key light, soft bounce, volumetric dust motes...*)
- `renderStyle`: Engine aesthetic (e.g. *Stylized octane render aesthetic, raytraced ambient occlusion...*)
- `environmentStyle`: Set & backdrop details (e.g. *Rural earthen walls, handwoven fabrics, authentic brass vessels...*)
- `colorLanguage`: Palette rules (e.g. *Harmonious palette of ochre, saffron, terracotta, marigold, indigo...*)
- `cameraStyle`: Framing guidelines (e.g. *Deliberate cinematic camera placement, eye-level intimate framing...*)
- `lensStyle`: Focal lengths (e.g. *50mm and 85mm prime lenses...*)
- `depthOfFieldStyle`: Bokeh rules (e.g. *Shallow depth of field with creamy bokeh isolating character expressions...*)
- `animationStyle`: Physical weight & motion guidelines
- `materialStyle`: Texture specifications (cotton, khadi, silk, brass, teak wood)
- `negativePrompt`: Strict negative constraints (e.g. *photorealistic human live-action, 2D anime, flat cartoon, low poly, oversaturated, amateur CGI, watermark...*)

---

## 3. Characters (`characters`)

Array of `CharacterIdentityPackage` objects. Each contains:
- `id`: Unique character identifier (e.g. `"char_ramu"`)
- `name`: Character name
- `role`: `"PROTAGONIST"`, `"ANTAGONIST"`, `"SUPPORTING"`, `"EXTRA"`
- `ageDescription`: e.g. `"45-year-old Indian farmer"`
- `faceDescription`: Facial structure, wrinkles, features
- `skinDescription`: Skin tone specification (e.g. `"Warm dusky wheatish Indian skin tone"`)
- `eyeDescription`: Eye shape and color
- `hairDescription`: Hairstyle, texture, and graying
- `facialHairDescription`: Mustache / beard details
- `bodyDescription`: Physical build and posture
- `clothingDescription`: Detailed attire, fabrics, and colors
- `accessories`: Specific items (e.g. kalava thread, turban, ear studs)
- `consistencyPrompt`: Core token injected into every image prompt
- `negativeConsistencyPrompt`: Negative token to prevent drift
- `isLocked`: Boolean indicating approved identity

---

## 4. Scenes & Shots (`scenes`)

- `sceneNumber`: Sequential order integer
- `title`: Short descriptive title
- `importance`: `"BACKGROUND"`, `"NORMAL"`, `"IMPORTANT"`, `"HERO"`
- `status`: Lifecycle state (`"NOT_STARTED"`, `"STORYBOARD"`, `"PRODUCTION_IMAGE"`, `"VIDEO_GENERATED"`, etc.)
- `location`: Specific physical setting
- `timeOfDay`: Lighting condition
- `environment`: Detailed environmental backdrop
- `lighting`: Key, fill, and rim light specifics
- `mood`: Emotional tone
- `summary`: Narrative action summary
- `narrationHindi`: Devanagari script for narration
- `dialogueHindi`: Devanagari script for character speech
- `cameraMovement`: Cinematic camera preset
- `motionPreset`: Physical speed preset
- `durationSeconds`: Target duration (3–8s typical)
- `ambiencePrompt`, `sfxPrompt`, `musicMood`: Audio specifications
- `shots`: Sub-array of specific shot descriptions
