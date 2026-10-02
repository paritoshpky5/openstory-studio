# OpenStory Studio — Architecture Guide

OpenStory Studio is designed from the ground up as a **local-first production suite** for generating cinematic animated Hindi narrative story videos.

## System Tenets

1. **Local-First & Autonomous**: Media files stay on disk (`data/projects/{projectId}/...`), SQLite stores metadata and relational pointers. No reliance on cloud databases or external microservices.
2. **Shot-by-Shot Decomposition**: We reject "Story → One Giant AI Video". A high-quality animated film consists of distinct, controllable 3–8 second shots stitched together deterministically.
3. **Identity & Style Locking**: Recurring characters and visual styles are locked before initiating expensive generation jobs.
4. **Economic Optimization**: Optimize **Cost Per Approved Shot**, not cost per individual generation attempt.

---

## Directory Layout

```
q:/AiVidDesk/
├── data/
│   └── projects/
│       └── {projectId}/
│           ├── project.json
│           ├── characters/
│           ├── character-references/
│           ├── storyboards/
│           ├── images/
│           ├── videos/
│           ├── lipsync/
│           ├── narration/
│           ├── dialogue/
│           ├── music/
│           ├── sfx/
│           ├── subtitles/
│           ├── renders/
│           ├── benchmarks/
│           ├── logs/
│           └── manual-packages/
├── prisma/
│   └── schema.prisma        # Complete SQLite relational model
├── src/
│   ├── app/                 # Next.js App Router (UI & API routes)
│   ├── lib/
│   │   ├── db/              # Prisma singleton
│   │   ├── services/        # Project, prompt, model, & render services
│   │   ├── storage/         # Local filesystem media manager
│   │   └── prompt-templates/# ChatGPT story prompt & prompt compiler
│   └── schemas/             # Zod validation schemas
└── docs/                    # Architectural & operational specs
```

---

## Data Pipeline Lifecycle

```
[ Multi-LLM API (GPT-4o/Claude/Gemini) / ChatGPT Web ]
        │  (Strict JSON output)
        ▼
[ OpenStory Ingestion Engine ] ──▶ SQLite + Disk Directory Setup
        │
        ▼
[ Character & Style Bible ] ─────▶ Lock Traits, Face, Proportions, Clothing
        │
        ▼
[ Storyboard Generation ] ───────▶ Fast Candidate Frames (BFL / Gemini / OpenAI)
        │
        ▼
[ Approved Production Image ] ───▶ Human Approval Gate
        │
        ▼
[ Image-to-Video Engine ] ───────▶ Kling / Seedance / Veo Motion
        │
        ▼
[ Hindi Audio & Voice Lab ] ─────▶ Sarvam AI / ElevenLabs (Devanagari TTS)
        │
        ▼
[ Lip Sync & Sound Design ] ─────▶ Auto-ducking & Ambience SFX
        │
        ▼
[ Deterministic FFmpeg Render ] ──▶ Final 1080p, 4K, & Shorts Output
```
