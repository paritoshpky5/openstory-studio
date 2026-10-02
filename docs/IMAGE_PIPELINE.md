# OpenStory Studio — Image Pipeline & Approval Architecture

## Overview

The Image Pipeline in OpenStory Studio is designed around local-first non-destructive asset creation, multi-provider model adapters, and a strict approval state machine.

---

## 1. Supported Providers & Models

### Black Forest Labs / FLUX (`FluxProvider`)
- **API Spec**: Official BFL REST API (`https://api.bfl.ml/v1/{model}`)
- **Models**:
  - `flux-1-schnell` ($0.003 / image)
  - `flux-1-dev` ($0.030 / image)
  - `flux-1-pro` ($0.050 / image)
  - `flux-pro-1.1` ($0.050 / image)
- **Async Polling**: Submits job and polls `https://api.bfl.ml/v1/get_result?id={id}` with exponential backoff.
- **Reference-Assisted Generation**: Supports character reference images via `image_prompt`.

### Google Gemini / Imagen 3 (`GeminiImageProvider`)
- **API Spec**: Google Cloud / Generative Language API (`imagen-3.0-generate-001:predict`)
- **Model**: `imagen-3.0-generate-001` ($0.030 / image)
- **Aspect Ratio Mapping**: Native `16:9`, `9:16`, `4:3`, `3:4`, `1:1`.
- **Payload**: Synchronous base64 image bytes (`predictions[0].bytesBase64Encoded`).

### OpenAI Image Generation (`OpenAIImageProvider`)
- **API Spec**: OpenAI API (`https://api.openai.com/v1/images/generations`)
- **Model**: `dall-e-3` ($0.040 standard, $0.080 HD)
- **Resolution**: `1792x1024` (16:9 landscape), `1024x1792` (9:16 portrait), `1024x1024` (1:1 square).
- **Payload**: Synchronous base64 JSON (`b64_json`).

---

## 2. Storage & Asset Versioning Strategy

All generated media is saved non-destructively:

```
data/projects/{projectId}/
├── storyboards/
│   └── scene_1_storyboard_1729000000_abc123.svg / .png
├── images/
│   └── scene_1_production_image_1729000000_def456.svg / .png
└── character-references/
    └── char_raja_reference_1729000000_ghi789.svg / .png
```

- **SQLite `AssetVersion` Table**: Stores relative paths (`images/filename.png`), prompts, negative prompts, provider, model ID, settings, actual cost, approval status, and active take flag.
- **Local Media Streaming**: Served locally through `/api/media/[...path]` with strict path traversal validation.

---

## 3. Approval State Machine & Transitions

```
[ NOT_STARTED ]
       │
       ▼ (Generate Storyboard)
[ STORYBOARD ]
       │
       ▼ (Approve Storyboard)
[ STORYBOARD_APPROVED ]
       │
       ▼ (Generate Production Frame)
[ PRODUCTION_IMAGE ]
       │
       ▼ (Approve Production Frame)
[ IMAGE_APPROVED ] ──────────────► Ready for Image-to-Video Animation (Kling / Seedance)
```

### Active Take Switching
Multiple candidate takes can be generated for any shot using different providers or prompt seeds. When the user approves a take:
1. Sibling versions of the same `assetType` are set to `isActive: false`.
2. Target version is set to `isActive: true` and `approvalStatus: 'APPROVED'`.
3. Shot pointer `Shot.activeImageVersionId` is updated to point directly to the approved take.
4. Scene status advances to `IMAGE_APPROVED`.
