# OpenStory Studio — Complete Agent Handoff & Technical Blueprint (A to Z)

> **Historical design record:** This file preserves early product decisions and may mention superseded model names or framework versions. Treat `README.md`, `package.json`, the Prisma schema, and the current source code as authoritative for shipped behavior.

> **For Future Autonomous Agents & Developers**:  
> Read this document first before writing or modifying any code. It contains the exact history of thoughts, architectural decisions, file structures, schemas, technical constraints, and design philosophies established across the entire lifecycle of this project.

---

## 1. Executive Summary & Core Mission

**OpenStory Studio** (formerly StoryFlow Studio / AiVidDesk) is an open-source, local-first production studio designed to take Indian animated storytelling from a raw story idea to a finished, rendered animated video with consistent characters, high-end cinematic visuals, and authentic Hindi voiceovers. OpenStory Studio launches with battle-tested support for Hindi storytelling and Stylized 3D Animation, with active roadmap expansion to additional regional & global languages and art styles.

### The Big Problem It Solves:
1. **AI Inconsistency**: Standard AI generators produce random character faces, morphing clothing, and conflicting visual art styles across scenes.
2. **Expensive API Lock-in**: Almost all modern AI video SaaS platforms require heavy recurring subscriptions ($50–$200/mo) for Midjourney, Runway, Kling, ElevenLabs, etc.
3. **Missing Cultural Authenticity**: Generic AI prompts fail at Indian aesthetics (clothing like pagri/dhoti/kurta, regional architecture, atmospheric lighting, and emotional Hindi narration/Devanagari scripts).

### The Solution:
A hybrid studio that enforces strict visual and character consistency via a **Master Style Bible** and **Character Bibles**, provides a **JSON Schema v1.0.0** pipeline for story planning via ChatGPT/Claude/Gemini/OpenRouter, and supports a **$0 Free-Quota Web Workflow** alongside direct API integrations.

---

## 2. Tech Stack & Environment

| Component | Technology | Rationale / Detail |
|---|---|---|
| **OS** | Cross-platform launchers; Windows is the primary development environment | Local-first desktop workflow |
| **Framework** | Next.js 16 (App Router) | React Server Components + client-side studio pages |
| **Language** | TypeScript (Strict mode) | Strict type safety for JSON schemas and database models |
| **Database** | SQLite via Prisma ORM | Zero-config, local-first database stored in `prisma/dev.db` |
| **Styling** | Tailwind CSS + Lucide Icons | Dark cinematic UI, high-density dashboard layouts |
| **Video Engine** | Local FFmpeg | Stitched transitions, audio ducking, subtitle overlay |
| **Media Storage** | Local filesystem (`data/projects/{id}/...`) | No mandatory cloud buckets; served via `/api/media/...` |
| **Schema** | Custom OpenStory JSON Schema `v1.0.0` | Interchangeable project definition format |

---

## 3. Dual Pipeline Philosophy ($0 Free Web vs. Direct API)

One of the most important architectural achievements in OpenStory Studio is the **dual operating mode**:

```
                                  [Story Idea]
                                       │
                                       ▼
                   [ChatGPT / Claude Planning with Master Prompt]
                                       │
                                       ▼
                         [OpenStory JSON Import v1.0.0]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     [Mode A: $0 Free Web Quota]                   [Mode B: Direct APIs]
 1-Click Launchers to Free Platforms            Optional API keys configured in
 (Krea, Leonardo, Hailuo, ElevenLabs)                  /settings page
                │                                             │
 Copy Master Prompts with 1-Click               Automatic generation via SDK
                │                                             │
 Download free media from web platforms                       │
                │                                             │
 Drag-and-drop upload into Studio                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
                    [Asset Assembly & Shot Synchronization]
                                       │
                                       ▼
                        [Local FFmpeg Render Engine]
                                       │
                                       ▼
                         [Final MP4 Cinematic Video]
```

1. **Mode A — 100% Free Web Quota ($0 Budget)**:
   - Users don't need paid API keys.
   - For every asset (Image, Video, Audio, Music), the Studio features:
     - **Copy Prompt**: Optimized prompt pre-compiled with Style Bible + Consistency rules.
     - **1-Click Web Launchers**: Opens free platforms directly (Leonardo, Krea, Ideogram, Kling, Hailuo, ElevenLabs, Suno, etc.).
     - **Instant File Dropzone**: Drag and drop the downloaded file to bind it directly to the character or scene.
2. **Mode B — Direct API Engine**:
   - For power users with API credentials (OpenAI, OpenRouter, Fal.ai, Replicate, ElevenLabs, Runway).
   - Configure keys in `/settings` to enable in-app 1-click automated batch generation.

---

## 4. Phase-by-Phase Build History (A to Z)

### Phase 1: Conceptualization & Aesthetic Definition
- **Goal**: Define the visual identity and filmmaking rules for Indian animated stories.
- **Decisions**:
  - Rejected flat 2D cartoons and uncanny photorealism in favor of **Polished Stylized 3D Animation** (Octane render aesthetic, subsurface scattering, authentic cultural fabrics, golden hour cinematography).
  - Designed the **Master Style Bible** structure: master prompt, character style, lighting style, render style, environment style, color language, lens/depth-of-field, animation style, and comprehensive negative prompt.

### Phase 2: Schema Design & Project Foundation
- **Goal**: Create a reliable, portable schema for the entire lifecycle of an animated film.
- **Deliverable**: `OpenStory Studio JSON Schema v1.0.0` (`src/types/schema.ts` and `src/types/project.ts`).
- **Structure**:
  - `project`: Metadata, aspect ratio (16:9, 9:16), FPS (24), language (`hi-IN`).
  - `styleBible`: Global aesthetics locked across all generations.
  - `characters`: Facial traits, skin tone, hair, clothing, consistency prompt, reference asset slots (`PRIMARY_FACE`, `PRIMARY_FULL_BODY`, etc.).
  - `scenes`: Location, lighting, shot type, camera movement, motion preset, Hindi narration, Hindi dialogue, audio prompts.

### Phase 3: Project Creation Wizard & ChatGPT Master Planner
- **Goal**: Allow users to plan an entire film in 60 seconds without manually writing 50 prompts.
- **Deliverable**:
  - `src/app/projects/new/page.tsx`
  - `src/lib/prompt-templates/chatgpt-story-prompt.ts`
  - `src/app/api/prompt/story/route.ts`
- **Features**:
  - Generates a bulletproof system prompt for ChatGPT/Claude that instructs the LLM to output valid JSON matching Schema v1.0.0.
  - Supports pasting custom story concepts or generating stories from scratch.
  - 1-click JSON import tab that parses, validates, and initializes the project directly into SQLite.

### Phase 4: Solo Storyteller (कथावाचक) vs. Dramatic Dialogue Architecture
- **Goal**: Support traditional single-speaker Indian storytelling (कथावाचक / सूत्रधार) where one voice narrates the entire story, preventing fragmented multi-voice TTS chaos.
- **Implementation**:
  - Added Narration Mode selector into the prompt generator:
    1. **Solo Storyteller (कथावाचक / सूत्रधार)** *(Default)*: Instructs ChatGPT to set `dialogueHindi: null` and `speakingCharacterId: null` across all scenes and write 100% of speech into `narrationHindi` in narrative prose.
    2. **Dramatic Dialogue + Narrator**: Multi-character voice acting.
    3. **Action & Dialogue Only**: Minimal narration.
  - Added Storyteller Archetype/Tone selector: *Warm Katha-Vachak*, *Deep Mythological*, *Suspense Thriller*, *Poetic/Emotional*.

### Phase 5: Character Consistency Studio
- **Goal**: Solve character drifting across different shots and camera angles.
- **Deliverable**:
  - Character detail drawers and reference asset managers in `/projects/[id]`.
  - Reference slot types: `PRIMARY_FACE`, `PRIMARY_FULL_BODY`, `ANGLE_THREE_QUARTER`, `EXPRESSION_SHEET`.
  - Lock toggle (`isLocked`) to prevent accidental overwrites once a hero look is approved.
  - Compiler (`src/lib/prompt-templates/character-prompt.ts`) that combines Style Bible + Character physical attributes.

### Phase 6: Scene & Shot Production Dashboard
- **Goal**: Visual timeline and shot-by-shot management.
- **Deliverable**:
  - Scene cards with camera parameters (Shot Type, Camera Movement, Motion Preset, Lens).
  - Bilingual story cards: English action summary + authentic Devanagari Hindi narration/dialogue.
  - Media asset binding: Image, Video, Narration Audio, Dialogue Audio, Background Music (BGM), and Sound Effects (SFX).

### Phase 7: The $0 Free-Quota Web Workflow & Launchers
- **Goal**: Empower creators with zero budget to use the highest quality free tools on the web.
- **Deliverable**:
  - `src/lib/constants/free-web-platforms.ts`: Curated directory of top free-tier generative AI platforms with tags (Daily Quota, Free Forever, Trial).
  - `src/components/common/FreeWebPlatformLauncher.tsx`: Compact launcher modal embedded next to every "Copy Prompt" button.
  - Platforms integrated:
    - **Image**: Krea AI, Leonardo AI, Ideogram, SeaArt, Tensor.art.
    - **Video**: Kling AI, Hailuo/Minimax, Luma Dream Machine, PixVerse, Viggle.
    - **Voiceover**: ElevenLabs (Free Tier), Clipchamp, TTSMP3, PlayHT, TTSMaker.
    - **Music/SFX**: Suno AI, Udio, Freesound, Pixabay Music.
  - Direct local upload endpoint: `src/app/api/projects/[id]/upload/route.ts`.

### Phase 8: Settings & Multi-Provider API Key Architecture
- **Goal**: Seamless transition for users who want automated generation.
- **Deliverable**:
  - `src/app/settings/page.tsx` & `src/app/api/settings/route.ts`.
  - Secure local storage of keys for OpenAI, OpenRouter, Fal.ai, Replicate, ElevenLabs, Runway.
  - Clear toggle allowing users to choose between Free Web Upload and API Generation on a per-service basis.

### Phase 9: Local FFmpeg Rendering Pipeline
- **Goal**: Combine all generated shots, voice tracks, and audio into a final broadcast-quality video file locally.
- **Deliverable**:
  - `src/lib/ffmpeg/render-pipeline.ts` & `src/app/api/projects/[id]/render/route.ts`.
  - Concatenation with crossfade transitions.
  - Audio mixing: dialogue/narration ducking over background music.
  - Local export to `data/projects/{id}/renders/final_output.mp4`.

### Phase 10: Open-Source Launch Kit & Documentation
- **Goal**: Prepare for public release on GitHub, Product Hunt, and LinkedIn.
- **Deliverable**:
  - MIT License (`LICENSE`).
  - High-impact visual `README.md` with badges, architecture diagrams, step-by-step Quickstart, and release notes.
  - Cleaned Git repository initialized on branch `master`.

### Phase 11: Whole Video Project Portability & Standalone ZIP Archive Engine
- **Goal**: Allow creators to export their entire video project (database records, timeline shots, camera parameters, Hindi narration, PLUS every generated image, audio voiceover, and video clip) into a self-contained `.zip` file, and restore it on any machine with 1-click.
- **Deliverable**:
  - `src/lib/services/project-archive-service.ts`:
    - `exportProjectZip(projectId)`: Queries full project graph, compiles `project.json` manifest (`format: openstory-archive`), recursively zips local disk media from `data/projects/{projectId}/` under `media/`, and streams the archive.
    - `importProjectZip(zipBuffer)`: Validates manifest (supports both `openstory-archive` and legacy `storyflow-archive`), creates a new project in SQLite with new IDs, unpacks media files into `data/projects/{newId}/`, and dynamically remaps all `filePath` references across `AssetVersion` and `CharacterReference` models.
  - API Routes:
    - `GET /api/projects/[id]/export-zip`
    - `POST /api/projects/import-zip`
  - UI Features:
    - Header **"Export Project (.zip)"** button in `/projects/[id]`.
    - Tab 3 **"Restore Project Backup (.zip)"** in `/projects/new` with drag-and-drop zone.
    - Quick **"Restore ZIP Backup"** action in home dashboard (`/`).

### Phase 12: Automated AI Story Planning & Complete Rebrand to OpenStory Studio
- **Goal**: Add 1-click automated AI story generation via LLM APIs alongside the $0 free mode, simplify settings UX, provide cross-platform 1-click launchers, and rebrand to OpenStory Studio (`openstory-studio`).
- **Deliverable**:
  - `src/app/api/prompt/generate-story/route.ts`: Multi-LLM provider orchestration engine supporting OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), Google Gemini (Gemini 1.5 Pro), and OpenRouter. It sends the Master Story Planning prompt, parses the JSON response, validates against Zod schema, and initializes the project directly in SQLite.
  - `src/app/projects/new/page.tsx`: Added dual-mode UI — Option A (Fast Track 1-Click AI Generation via API) and Option B (Free Web Mode $0 spend copy-paste master prompt).
  - Consolidated API settings: Removed redundant "API Keys" button and settings tab from individual project studio page (`/projects/[id]`); all keys are centralized in `/settings`.
  - 1-Click Launchers: `start.bat` (Windows), `start.sh` (macOS/Linux), and `start.ps1` with 1-line copy-paste quickstart commands in `README.md`.
  - Stated launch scope: Starting with authentic Hindi storytelling and Stylized 3D Animation, with planned roadmap expansion to additional regional & global languages (Tamil, Telugu, Bengali, Marathi, English) and art styles (Anime, 2D Classic, Watercolor).

---

## 5. Directory & File Blueprint

```
q:\AiVidDesk/
├── prisma/
│   ├── schema.prisma              # SQLite schema (Project, StyleBible, Character, Scene, Shot, MediaAsset)
│   └── dev.db                     # Local SQLite database file
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── projects/          # CRUD endpoints for projects & scene updates
│   │   │   │   ├── import-zip/    # Restores full project and unpacks media from zip
│   │   │   │   └── [id]/
│   │   │   │       ├── export-zip/# Streams downloadable full project backup zip
│   │   │   │       ├── render/    # FFmpeg video render trigger & status
│   │   │   │       └── upload/    # File upload handler for local disk media
│   │   │   ├── prompt/
│   │   │   │   ├── story/         # ChatGPT Story Planner prompt generation API
│   │   │   │   └── generate-story/# 1-Click Automated Multi-LLM Story Generation API
│   │   │   ├── settings/          # API key retrieval and storage
│   │   │   └── media/             # Local media file streaming route
│   │   ├── projects/
│   │   │   ├── new/               # New Project wizard (Auto AI Gen, Prompt Gen, Import JSON, Restore ZIP)
│   │   │   └── [id]/              # Main Production Studio (Timeline, Scenes, Characters)
│   │   ├── settings/              # Settings & API Key configuration page
│   │   ├── layout.tsx             # Root layout with top navigation
│   │   └── page.tsx               # Projects dashboard / landing page
│   ├── components/
│   │   ├── common/
│   │   │   └── FreeWebPlatformLauncher.tsx # 1-click modal to open free AI web platforms
│   │   ├── characters/            # Character cards, reference managers, consistency locks
│   │   ├── scenes/                # Scene editors, shot timelines, media slots
│   │   ├── style-bible/           # Visual style prompt editor and locks
│   │   └── export/                # Video render progress, export logs, download player
│   ├── lib/
│   │   ├── constants/
│   │   │   └── free-web-platforms.ts # Curated directory of free image/video/audio platforms
│   │   ├── ffmpeg/
│   │   │   └── render-pipeline.ts # FFmpeg command runner, filter chains, audio ducking
│   │   ├── prompt-templates/
│   │   │   ├── chatgpt-story-prompt.ts # ChatGPT Master Story Planning generator (Solo vs Dialogue)
│   │   │   ├── character-prompt.ts     # Character consistency prompt compiler
│   │   │   ├── scene-image-prompt.ts   # Shot visual prompt compiler
│   │   │   └── video-prompt.ts         # Camera motion prompt compiler
│   │   ├── services/
│   │   │   ├── project-service.ts        # Database transactions for project CRUD
│   │   │   └── project-archive-service.ts# Export/import whole project zip archives
│   │   └── prisma.ts              # Global Prisma client singleton
│   └── types/
│       ├── schema.ts              # OpenStory Studio JSON Schema v1.0.0 definitions
│       └── project.ts             # TypeScript interfaces for UI & database models
├── data/                          # Ignored by git; stores project assets locally on disk
│   └── projects/{id}/
│       ├── characters/
│       ├── scenes/
│       └── renders/
├── README.md                      # Public open-source documentation
├── LICENSE                        # MIT License
├── start.bat                      # 1-Click launcher for Windows
├── start.sh                       # 1-Click launcher for macOS / Linux
├── start.ps1                      # 1-Click launcher for PowerShell
└── package.json                   # Dependencies (Next 14, Prisma, Tailwind, Lucide)
```

---

## 6. Critical Gotchas, Quirks & Windows Pitfalls

Future agents must be aware of the following technical behaviors:

### 1. Windows Next.js Dev/Build Concurrency Lock
- **The Issue**: On Windows, running `npm run build` while `npm run dev` is running concurrently locks files inside `.next/`. This triggers fatal runtime errors such as:
  ```
  Error: Cannot find module './276.js' Require stack: webpack-runtime.js
  ```
- **The Rule**: **NEVER** run `npm run build` while `next dev` is active in the background. Always terminate or check active background tasks first.

### 2. PowerShell Git Index Locks
- **The Issue**: Interrupting git processes or executing chained commands on PowerShell can leave `.git/index.lock` behind, preventing future git commits with `fatal: Unable to create '.git/index.lock': File exists`.
- **The Solution**: If this occurs, remove the lock file using:
  ```powershell
  Remove-Item -Force .git/index.lock
  ```

### 3. Media URL Paths
- **The Issue**: Files are stored on disk under `data/projects/{projectId}/...`. Storing raw Windows paths (`Q:\AiVidDesk\...`) in database image/video URLs breaks client browser rendering.
- **The Rule**: All media paths must be stored and referenced as relative API routes:
  `/api/media/projects/{projectId}/characters/{filename}`.

### 4. SQLite Single-Writer Constraint
- SQLite supports unlimited concurrent readers, but only **one writer at a time**.
- When writing batch database transactions (e.g. importing a 20-scene project), always use `prisma.$transaction` or sequential loops to avoid database lock timeouts.

### 5. Solo Storyteller Prompt Rule for LLMs
- If a prompt vaguely asks ChatGPT to "narrate the story", it frequently writes dialogue into both `dialogueHindi` and `narrationHindi`.
- In `src/lib/prompt-templates/chatgpt-story-prompt.ts`, we enforce:
  ```
  CRITICAL: For EVERY scene, set "dialogueHindi": null and "speakingCharacterId": null.
  Put 100% of spoken text inside "narrationHindi".
  ```
  Do not relax this rule or single-speaker projects will generate unwanted dialogue tracks.

---

## 7. Backlog & Suggested Next Steps for Future Agents

If you are asked to continue expanding OpenStory Studio, here are the highest-impact features to build next:

1. **SRT Subtitle Auto-Generator**:
   - Parse `narrationHindi` and scene `durationSeconds` to automatically produce an `.srt` file.
   - Offer an option in the FFmpeg render pipeline to burn stylized colored subtitles (Karaoke/word-by-word or standard Indian TV serial yellow font).
2. **Audio Waveform Visualizer & Timeline Trimmer**:
   - In `/projects/[id]`, allow users to inspect audio waveforms for voiceovers and trim dead air directly in the browser using the Web Audio API.
3. **Multi-Language Expansion**:
   - Add support for Tamil, Telugu, Bengali, Marathi, and English voice synthesis and prompt compiling.
4. **Additional Visual Style Bibles**:
   - Introduce Anime, Classic 2D Animation, and Watercolor presets alongside Stylized 3D.
5. **Cloudflare R2 / S3 Sync (Optional)**:
   - For teams who want multi-device synchronization, add an optional S3-compatible cloud storage adapter alongside local disk storage.

---

## 8. Essential Commands Reference

```powershell
# 1-Click Launchers (auto-checks node, env, prisma, dev server & opens browser)
.\start.bat      # Windows cmd / PowerShell
./start.sh       # macOS / Linux bash

# Start local development server manually
npm run dev

# Regenerate Prisma Client after schema changes
npx prisma generate

# Apply Prisma schema migrations
npx prisma db push

# View local database in Prisma Studio GUI
npx prisma studio

# Check Git status
git status -s

# Commit work
git add .
git commit -m "feat/fix: description"
```

*This document was generated for autonomous agent continuity. Keep it updated as new major architectural changes occur.*
