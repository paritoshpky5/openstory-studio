# AI Director pipeline

OpenStory uses a human-approved quality loop between generation and final export. The loop is intentionally advisory: it identifies defects and prepares corrected prompts, but it does not spend credits or replace approved media without a user action.

## Implemented

- Local deterministic gate for style/character locks, approved identity references, scene coverage, speech/video duration mismatch, narration pace, audio stems, prompt provenance, and saved timeline state.
- Full prompt audit covering the style bible, character identity packages, scene-image prompts, negative prompts, and motion prompts.
- Gemini Vision review with structured JSON output and sampled scene frames. This is opt-in and clearly identifies that media is sent to Google.
- Ollama vision review for an entirely local AI pass.
- Per-scene verdicts and regeneration prompt packs that remain subject to human approval.
- A persistent report at `data/projects/<project-id>/logs/ai-director-latest.json` so an export decision is auditable.

## GitHub research adopted

- [OpenMontage](https://github.com/tjebastin/openmontage): pre-compose validation, post-render review, checkpoints, and approval gates. OpenStory adopts the gate pattern while retaining its existing editor and renderer.
- [OpenX Flow](https://github.com/OpenX-Inc/flow): character banks, last-frame/first-frame scene chaining, and scene-level regeneration. The current character references and retry workflow are the foundation; boundary-frame conditioning is the next video adapter.
- [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo): staged topic-to-export automation, provider choice, and batch variants. OpenStory keeps its richer filmmaking stages and adds explicit quality gates between them.
- [WhisperX](https://github.com/m-bain/whisperX) and [faster-whisper](https://github.com/SYSTRAN/faster-whisper): planned local word timing/alignment for subtitles and objective speech-rate checks.
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect): planned detection of accidental cuts and frozen or overlong shots in final renders.
- [Ollama vision](https://github.com/ollama/ollama/blob/main/docs/capabilities/vision.mdx): local visual continuity review, integrated through the Ollama chat API.
- [Netflix VMAF](https://github.com/Netflix/vmaf): useful later for comparing transcode quality against a source master; it is not used as a creative or continuity judge.

Architectural ideas were adapted; no source code was copied. In particular, GPL-licensed editor projects were treated as product research only.

## Next integration slices

1. Extract the last accepted frame from scene N and use it as optional conditioning for scene N+1.
2. Add WhisperX/faster-whisper alignment and subtitle timing validation.
3. Run PySceneDetect plus freeze/black-frame checks on the final render.
4. Add a bounded retry queue that proposes one corrected take at a time, records cost, and waits for approval.
5. Require an export-ready AI Director report for client-master presets while leaving previews unrestricted.
