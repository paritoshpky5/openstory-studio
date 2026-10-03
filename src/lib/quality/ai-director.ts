import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { ensureProjectStorage, resolveStoredMediaPath } from '@/lib/storage/project-storage';
import { PromptCompiler } from '@/lib/prompt-compiler/prompt-compiler';

export const QualityReviewProviderSchema = z.enum(['AUTO', 'LOCAL', 'GEMINI', 'OLLAMA']);
export type QualityReviewProvider = z.infer<typeof QualityReviewProviderSchema>;

export type QualitySeverity = 'BLOCKER' | 'WARNING' | 'INFO';

export interface QualityFinding {
  id: string;
  severity: QualitySeverity;
  stage: 'STORY' | 'CHARACTERS' | 'IMAGES' | 'VIDEO' | 'AUDIO' | 'TIMELINE' | 'EXPORT';
  title: string;
  detail: string;
  suggestedAction: string;
  sceneId?: string;
  sceneNumber?: number;
}

export interface SceneAIReview {
  sceneNumber: number;
  score: number;
  verdict: 'PASS' | 'FIX' | 'REGENERATE';
  strengths: string[];
  issues: string[];
  recommendedAction: string;
  regenerationPrompt: string;
}

export interface PromptAudit {
  id: string;
  scope: 'STYLE' | 'CHARACTER' | 'SCENE';
  label: string;
  sceneNumber?: number;
  status: 'PASS' | 'IMPROVE' | 'MISSING';
  issues: string[];
  enhancedPositivePrompt?: string;
  enhancedNegativePrompt?: string;
  enhancedMotionPrompt?: string;
  enhancedNegativeMotionPrompt?: string;
}

export interface AIDirectorReport {
  version: 1;
  projectId: string;
  generatedAt: string;
  requestedProvider: QualityReviewProvider;
  providerUsed: 'LOCAL' | 'GEMINI' | 'OLLAMA';
  model?: string;
  score: number;
  exportReady: boolean;
  summary: string;
  findings: QualityFinding[];
  sceneReviews: SceneAIReview[];
  promptAudits: PromptAudit[];
  nextActions: string[];
}

const AIResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string().min(1),
  sceneReviews: z.array(z.object({
    sceneNumber: z.number().int().positive(),
    score: z.number().min(0).max(100),
    verdict: z.enum(['PASS', 'FIX', 'REGENERATE']),
    strengths: z.array(z.string()).default([]),
    issues: z.array(z.string()).default([]),
    recommendedAction: z.string().default(''),
    regenerationPrompt: z.string().default(''),
  })).default([]),
  nextActions: z.array(z.string()).default([]),
});

const AI_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  required: ['overallScore', 'summary', 'sceneReviews', 'nextActions'],
  properties: {
    overallScore: { type: 'number', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    sceneReviews: {
      type: 'array',
      items: {
        type: 'object',
        required: ['sceneNumber', 'score', 'verdict', 'strengths', 'issues', 'recommendedAction', 'regenerationPrompt'],
        properties: {
          sceneNumber: { type: 'integer' },
          score: { type: 'number', minimum: 0, maximum: 100 },
          verdict: { type: 'string', enum: ['PASS', 'FIX', 'REGENERATE'] },
          strengths: { type: 'array', items: { type: 'string' } },
          issues: { type: 'array', items: { type: 'string' } },
          recommendedAction: { type: 'string' },
          regenerationPrompt: { type: 'string' },
        },
      },
    },
    nextActions: { type: 'array', items: { type: 'string' } },
  },
} as const;

function activeAsset(scene: any, types: string[]) {
  return scene.assetVersions.find((asset: any) => asset.isActive && types.includes(asset.assetType));
}

function addFinding(
  findings: QualityFinding[],
  finding: Omit<QualityFinding, 'id'>
) {
  findings.push({ id: `${finding.stage.toLowerCase()}_${findings.length + 1}`, ...finding });
}

export function buildTechnicalFindings(project: any): QualityFinding[] {
  const findings: QualityFinding[] = [];

  if (!project.styleBible?.isLocked) {
    addFinding(findings, {
      severity: 'BLOCKER', stage: 'STORY', title: 'Style bible is not locked',
      detail: 'Generation can drift because the visual rules are still editable.',
      suggestedAction: 'Review and lock the style bible before generating more assets.',
    });
  }

  for (const character of project.characters) {
    const approvedRefs = character.references.filter((reference: any) => reference.isActive && reference.isApproved);
    if (!character.isLocked || approvedRefs.length === 0) {
      addFinding(findings, {
        severity: 'BLOCKER', stage: 'CHARACTERS', title: `${character.name} needs a locked visual reference`,
        detail: approvedRefs.length === 0
          ? 'No active approved character reference is available for visual comparison.'
          : 'The character bible is not locked.',
        suggestedAction: 'Generate and approve a face plus full-body reference, then lock the character bible.',
      });
    } else if (approvedRefs.length < 2) {
      addFinding(findings, {
        severity: 'WARNING', stage: 'CHARACTERS', title: `${character.name} has only one reference angle`,
        detail: 'A single portrait is weak supervision for profile, action, and wide shots.',
        suggestedAction: 'Add a full-body or three-quarter reference before regenerating inconsistent scenes.',
      });
    }
  }

  for (const scene of project.scenes) {
    const scope = { sceneId: scene.id, sceneNumber: scene.sceneNumber };
    const image = activeAsset(scene, ['PRODUCTION_IMAGE']);
    const video = activeAsset(scene, ['VIDEO']);
    const lipSync = activeAsset(scene, ['LIPSYNC']);
    const speech = activeAsset(scene, ['DIALOGUE', 'NARRATION']);
    const ambience = activeAsset(scene, ['AMBIENCE']);
    const sfx = activeAsset(scene, ['SFX']);
    const text = scene.dialogueHindi || scene.narrationHindi || '';

    if (!image) {
      addFinding(findings, {
        ...scope, severity: 'BLOCKER', stage: 'IMAGES', title: `Scene ${scene.sceneNumber} has no active production frame`,
        detail: 'Video generation has no approved visual anchor.',
        suggestedAction: 'Generate or import a production frame using the locked character references.',
      });
    }
    const plannedShots = scene.shots || [];
    const activeShotVideos = plannedShots.map((shot: any) =>
      scene.assetVersions.find((asset: any) => asset.isActive && asset.assetType === 'VIDEO' && asset.shotId === shot.id)
    );
    const missingShotCount = plannedShots.length > 1
      ? activeShotVideos.filter((asset: any) => !asset).length
      : 0;
    if (!video) {
      addFinding(findings, {
        ...scope, severity: 'BLOCKER', stage: 'VIDEO', title: `Scene ${scene.sceneNumber} has no active motion take`,
        detail: 'The final film cannot provide continuous visual coverage for this scene.',
        suggestedAction: 'Generate at least one approved image-to-video take.',
      });
    } else if (missingShotCount > 0) {
      addFinding(findings, {
        ...scope, severity: 'BLOCKER', stage: 'VIDEO', title: `Scene ${scene.sceneNumber} is missing ${missingShotCount} planned video shot${missingShotCount === 1 ? '' : 's'}`,
        detail: `The measured speech requires ${plannedShots.length} shots, but the approved coverage is still a single legacy scene take or incomplete shot set.`,
        suggestedAction: 'Generate and approve each audio-timed shot; do not loop or stretch the old five-second clip.',
      });
    }
    if (text && !speech) {
      addFinding(findings, {
        ...scope, severity: 'BLOCKER', stage: 'AUDIO', title: `Scene ${scene.sceneNumber} is missing speech audio`,
        detail: 'Narration or dialogue exists in the script but has no active audio take.',
        suggestedAction: 'Generate and approve the missing speech take.',
      });
    }

    if (speech?.duration && text.trim()) {
      const wordCount = text.trim().split(/\s+/).length;
      const wordsPerMinute = Math.round((wordCount * 60) / speech.duration);
      if (wordsPerMinute > 180) {
        addFinding(findings, {
          ...scope, severity: wordsPerMinute > 210 ? 'BLOCKER' : 'WARNING', stage: 'AUDIO',
          title: `Scene ${scene.sceneNumber} narration is ${wordsPerMinute} WPM`,
          detail: 'The delivery is faster than a relaxed Hindi storyteller pace of roughly 140–170 WPM.',
          suggestedAction: 'Shorten the line or regenerate a slower take; then extend the scene timing to the new audio duration.',
        });
      }
    }

    const chosenVisual = scene.dialogueHindi && lipSync ? lipSync : video;
    const shotCoverageDuration = activeShotVideos.every(Boolean)
      ? activeShotVideos.reduce((total: number, asset: any) => total + (asset?.duration || 0), 0)
      : 0;
    const visualDuration = plannedShots.length > 1 && shotCoverageDuration > 0
      ? shotCoverageDuration
      : chosenVisual?.duration;
    if (visualDuration && speech?.duration && visualDuration + 0.2 < speech.duration) {
      addFinding(findings, {
        ...scope, severity: 'BLOCKER', stage: 'VIDEO', title: `Scene ${scene.sceneNumber} visual ends before speech`,
        detail: `Visual coverage is ${visualDuration.toFixed(1)}s but speech is ${speech.duration.toFixed(1)}s.`,
        suggestedAction: 'Generate a longer take or split the scene into two shots instead of stretching one clip.',
      });
    }

    if (image && (!image.prompt || image.prompt.length < 80 || image.prompt.includes('Manual web generation import'))) {
      addFinding(findings, {
        ...scope, severity: 'WARNING', stage: 'IMAGES', title: `Scene ${scene.sceneNumber} lacks an auditable image prompt`,
        detail: 'The approved frame cannot be reproduced reliably from its stored metadata.',
        suggestedAction: 'Store the compiled style, character, environment, shot, and negative prompts with the asset.',
      });
    }
    if (scene.ambiencePrompt && !ambience) {
      addFinding(findings, {
        ...scope, severity: 'INFO', stage: 'AUDIO', title: `Scene ${scene.sceneNumber} has no ambience stem`,
        detail: 'The scene defines ambience direction but no generated or imported ambience is active.',
        suggestedAction: 'Generate the ambience bed and let automatic ducking place it under speech.',
      });
    }
    if (scene.sfxPrompt && !sfx) {
      addFinding(findings, {
        ...scope, severity: 'INFO', stage: 'AUDIO', title: `Scene ${scene.sceneNumber} has no SFX stem`,
        detail: 'The scene defines sound effects but no active SFX asset is present.',
        suggestedAction: 'Generate or import the planned effects before the final mix.',
      });
    }
  }

  if (!project.timeline) {
    addFinding(findings, {
      severity: 'WARNING', stage: 'TIMELINE', title: 'Timeline has not been saved',
      detail: 'Export will use the deterministic scene fallback rather than an approved edit.',
      suggestedAction: 'Open Timeline / Export and save or reset the initial assembly.',
    });
  }

  return findings;
}

function isImportPlaceholder(prompt?: string | null) {
  return !prompt
    || prompt.length < 80
    || /^(imported|manual web generation import)/i.test(prompt.trim());
}

export function buildPromptAudits(project: any): PromptAudit[] {
  const audits: PromptAudit[] = [];
  const styleIssues: string[] = [];
  const style = project.styleBible;

  if (!style?.masterStylePrompt?.trim()) styleIssues.push('Master visual style is missing.');
  if (!style?.negativePrompt?.trim()) styleIssues.push('Global negative prompt is missing.');
  audits.push({
    id: 'style-bible',
    scope: 'STYLE',
    label: 'Style Bible',
    status: styleIssues.length ? 'IMPROVE' : 'PASS',
    issues: styleIssues,
    enhancedPositivePrompt: style ? [
      style.masterStylePrompt,
      `Character design: ${style.characterStyle}`,
      `Environment: ${style.environmentStyle}`,
      `Lighting: ${style.lightingStyle}`,
      `Materials and render: ${style.materialStyle}; ${style.renderStyle}`,
      `Color language: ${style.colorLanguage}`,
      `Animation: ${style.animationStyle}`,
      'Maintain one coherent production design, stable character scale, stable costume colors, physically grounded contact shadows, and clean cinematic silhouettes across every shot.',
    ].filter(Boolean).join(' ') : undefined,
    enhancedNegativePrompt: style ? [
      style.negativePrompt,
      'text, subtitles, captions, logo, watermark, border, contact-sheet layout, split screen, duplicate character, wrong character count, fused bodies, extra fingers, extra paws, cropped ears, cropped shell, inconsistent scale, floating feet, broken ground contact, mismatched eyeline, continuity error',
    ].filter(Boolean).join(', ') : undefined,
  });

  for (const character of project.characters) {
    const issues: string[] = [];
    if (!character.consistencyPrompt?.includes(character.name)) issues.push('Identity token does not explicitly include the character name.');
    if (!character.negativeConsistencyPrompt?.trim()) issues.push('Character-specific negative prompt is missing.');
    if (!character.heightDescription) issues.push('Relative height/scale guidance is missing.');
    const approvedRefs = character.references?.filter((reference: any) => reference.isActive && reference.isApproved) || [];
    if (approvedRefs.length < 2) issues.push('Prompt has fewer than two approved visual reference angles.');
    audits.push({
      id: `character-${character.id}`,
      scope: 'CHARACTER',
      label: character.name,
      status: approvedRefs.length === 0 ? 'MISSING' : issues.length ? 'IMPROVE' : 'PASS',
      issues,
      enhancedPositivePrompt: [
        character.consistencyPrompt,
        `Fixed anatomy and scale: ${character.bodyDescription}; ${character.heightDescription || 'preserve the approved reference proportions'}.`,
        `Fixed face: ${character.faceDescription}; ${character.eyeDescription}.`,
        `Fixed clothing/accessories: ${character.clothingDescription}; ${character.accessories || 'no accessories'}.`,
        'Treat the approved face and full-body images as identity references, not loose inspiration. Preserve silhouette, markings, colors, proportions, and left/right accessory placement exactly.',
      ].filter(Boolean).join(' '),
      enhancedNegativePrompt: [
        character.negativeConsistencyPrompt,
        'identity drift, age change, species change, altered proportions, mirrored accessory placement, duplicate character, extra limbs, missing limbs, asymmetrical eyes, inconsistent markings, costume redesign',
      ].filter(Boolean).join(', '),
    });
  }

  if (!style) return audits;
  for (const scene of project.scenes) {
    const characters = scene.characters
      .map((link: any) => project.characters.find((character: any) => character.id === link.characterId) || link.character)
      .filter(Boolean);
    const compilerInput = {
      styleBible: style,
      characters,
      scene,
      shot: scene.shots?.[0],
      activeReferences: characters.flatMap((character: any) =>
        (character.references || [])
          .filter((reference: any) => reference.isActive && reference.isApproved)
          .map((reference: any) => ({ characterId: character.id, filePath: reference.filePath, type: reference.referenceType }))
      ),
    } as any;
    const imagePrompt = PromptCompiler.compileForGemini(compilerInput);
    const motionPrompt = PromptCompiler.compileForMotion(compilerInput, 'GENERIC');
    const image = activeAsset(scene, ['PRODUCTION_IMAGE']);
    const video = activeAsset(scene, ['VIDEO']);
    const issues: string[] = [];
    if (isImportPlaceholder(image?.prompt)) issues.push('The approved image stores only an import filename, not the generation prompt.');
    if (!image?.negativePrompt) issues.push('The approved image has no stored negative prompt.');
    if (!video?.motionPrompt && isImportPlaceholder(video?.prompt)) issues.push('The approved video has no reproducible motion prompt.');
    if ((scene.durationSeconds || 0) > 6 && (scene.shots?.length || 0) < 2) {
      issues.push(`${scene.durationSeconds}s of story is represented by one shot; split it into a primary action and reaction/cutaway prompt.`);
    }
    if (!characters.length) issues.push('No character identity package is attached to this scene prompt.');
    audits.push({
      id: `scene-${scene.id}`,
      scope: 'SCENE',
      label: `Scene ${scene.sceneNumber}: ${scene.title}`,
      sceneNumber: scene.sceneNumber,
      status: !image || !video ? 'MISSING' : issues.length ? 'IMPROVE' : 'PASS',
      issues,
      enhancedPositivePrompt: imagePrompt.positivePrompt,
      enhancedNegativePrompt: imagePrompt.negativePrompt,
      enhancedMotionPrompt: motionPrompt.motionPrompt,
      enhancedNegativeMotionPrompt: motionPrompt.negativeMotionPrompt,
    });
  }
  return audits;
}

function localScore(findings: QualityFinding[]) {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'BLOCKER') return total + 8;
    if (finding.severity === 'WARNING') return total + 3;
    return total + 0.5;
  }, 0);
  return Math.round(Math.max(0, Math.min(100, 100 - penalty)));
}

function localSceneReviews(project: any, findings: QualityFinding[]): SceneAIReview[] {
  return project.scenes.map((scene: any) => {
    const sceneFindings = findings.filter((finding) => finding.sceneId === scene.id);
    const hasBlocker = sceneFindings.some((finding) => finding.severity === 'BLOCKER');
    const hasWarning = sceneFindings.some((finding) => finding.severity === 'WARNING');
    return {
      sceneNumber: scene.sceneNumber,
      score: localScore(sceneFindings),
      verdict: hasBlocker ? 'REGENERATE' : hasWarning ? 'FIX' : 'PASS',
      strengths: [],
      issues: sceneFindings.map((finding) => finding.title),
      recommendedAction: sceneFindings[0]?.suggestedAction || 'No technical correction required.',
      regenerationPrompt: '',
    };
  });
}

function toProjectBrief(project: any, findings: QualityFinding[]) {
  return JSON.stringify({
    project: {
      title: project.name,
      description: project.description,
      aspectRatio: project.aspectRatio,
      fps: project.fps,
      language: project.targetLanguage,
      style: project.styleBible,
    },
    characters: project.characters.map((character: any) => ({
      name: character.name,
      role: character.role,
      consistencyPrompt: character.consistencyPrompt,
      negativeConsistencyPrompt: character.negativeConsistencyPrompt,
    })),
    scenes: project.scenes.map((scene: any) => ({
      sceneNumber: scene.sceneNumber,
      title: scene.title,
      summary: scene.summary,
      shotType: scene.shotType,
      cameraAngle: scene.cameraAngle,
      cameraMovement: scene.cameraMovement,
      durationSeconds: scene.durationSeconds,
      narrationHindi: scene.narrationHindi,
      dialogueHindi: scene.dialogueHindi,
      activePrompts: scene.assetVersions
        .filter((asset: any) => asset.isActive && ['PRODUCTION_IMAGE', 'VIDEO', 'LIPSYNC'].includes(asset.assetType))
        .map((asset: any) => ({ type: asset.assetType, prompt: asset.prompt, motionPrompt: asset.motionPrompt })),
    })),
    technicalFindings: findings,
  });
}

function reviewPrompt(projectBrief: string, imageLabels: string[]) {
  return `You are the independent AI Director and continuity supervisor for a Hindi animated film.
Review the structured production brief and the attached scene frames in their listed order.

Judge only visible or supplied evidence. Check:
1. character identity, fur/skin, face, anatomy, clothing, accessories and scale across scenes;
2. style bible, palette, lighting, environment and material consistency;
3. prompt/shot adherence, composition, camera grammar and readable action;
4. temporal plan: whether one short take is being stretched where a cutaway or second shot is needed;
5. Hindi narration pace, scene duration, lip-sync applicability and subtitle readability;
6. client-delivery risks such as morphing, extra limbs, weak expressions, repetitive framing or slideshow feel.

Be strict but practical. Never invent a defect that is not visible. A regenerationPrompt must preserve locked identity tokens and describe only the needed correction. Return JSON matching the provided schema.

IMAGE ORDER:
${imageLabels.join('\n')}

PRODUCTION BRIEF:
${projectBrief}`;
}

function renderJpeg(inputPath: string, isVideo: boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      ...(isVideo ? ['-ss', '1'] : []),
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', 'scale=768:-2:force_original_aspect_ratio=decrease',
      '-q:v', '5',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1',
    ];
    execFile(ffmpegInstaller.path, args, { encoding: 'buffer', maxBuffer: 5 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
    });
  });
}

async function collectSceneImages(project: any) {
  const images: Array<{ label: string; base64: string }> = [];
  for (const scene of project.scenes) {
    const asset = activeAsset(scene, ['PRODUCTION_IMAGE']) || activeAsset(scene, ['VIDEO']);
    if (!asset) continue;
    const absolutePath = resolveStoredMediaPath(project.id, asset.filePath);
    if (!fs.existsSync(absolutePath)) continue;
    try {
      const jpeg = await renderJpeg(absolutePath, asset.assetType === 'VIDEO');
      images.push({ label: `Scene ${scene.sceneNumber}: ${scene.title}`, base64: jpeg.toString('base64') });
    } catch {
      // Technical findings already report unavailable assets; one bad frame must
      // not prevent the remaining scenes from receiving a review.
    }
  }
  return images;
}

async function runGeminiReview(project: any, findings: QualityFinding[]) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in Settings.');
  const model = process.env.AI_DIRECTOR_GEMINI_MODEL || 'gemini-2.5-flash';
  const images = await collectSceneImages(project);
  const prompt = reviewPrompt(toProjectBrief(project, findings), images.map((image) => image.label));
  const parts: any[] = [{ text: prompt }];
  for (const image of images) {
    parts.push({ text: image.label });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: image.base64 } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: AI_RESPONSE_JSON_SCHEMA,
          temperature: 0.2,
        },
      }),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini review failed with HTTP ${response.status}.`);
  }
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.find((part: any) => part.text)?.text;
  if (!text) throw new Error('Gemini returned an empty quality review.');
  return { model, result: AIResponseSchema.parse(JSON.parse(text)) };
}

async function runOllamaReview(project: any, findings: QualityFinding[]) {
  const model = process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b';
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const images = await collectSceneImages(project);
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: AI_RESPONSE_JSON_SCHEMA,
      messages: [{
        role: 'user',
        content: reviewPrompt(toProjectBrief(project, findings), images.map((image) => image.label)),
        images: images.map((image) => image.base64),
      }],
      options: { temperature: 0.2 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama review failed with HTTP ${response.status}.`);
  const payload = await response.json();
  if (!payload.message?.content) throw new Error('Ollama returned an empty quality review.');
  return { model, result: AIResponseSchema.parse(JSON.parse(payload.message.content)) };
}

function saveReport(report: AIDirectorReport) {
  const projectDir = ensureProjectStorage(report.projectId);
  const logsDir = path.join(projectDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(path.join(logsDir, 'ai-director-latest.json'), JSON.stringify(report, null, 2), 'utf-8');
}

export function loadLatestAIDirectorReport(projectId: string): AIDirectorReport | null {
  const reportPath = path.join(process.cwd(), 'data', 'projects', projectId, 'logs', 'ai-director-latest.json');
  if (!fs.existsSync(reportPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as AIDirectorReport;
  } catch {
    return null;
  }
}

export async function runAIDirectorReview(
  projectId: string,
  requestedProvider: QualityReviewProvider
): Promise<AIDirectorReport> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      styleBible: true,
      timeline: true,
      characters: { include: { references: true } },
      assetVersions: { where: { isActive: true } },
      scenes: {
        orderBy: { sceneNumber: 'asc' },
        include: {
          shots: { orderBy: { shotNumber: 'asc' } },
          characters: { include: { character: true } },
          assetVersions: true,
        },
      },
    },
  });
  if (!project) throw new Error('Project not found.');

  const findings = buildTechnicalFindings(project);
  const promptAudits = buildPromptAudits(project);
  let providerUsed: AIDirectorReport['providerUsed'] = 'LOCAL';
  let model: string | undefined;
  let aiResult: z.infer<typeof AIResponseSchema> | null = null;
  const resolvedProvider = requestedProvider === 'AUTO'
    ? (process.env.GEMINI_API_KEY ? 'GEMINI' : 'LOCAL')
    : requestedProvider;

  if (resolvedProvider === 'GEMINI') {
    const response = await runGeminiReview(project, findings);
    providerUsed = 'GEMINI';
    model = response.model;
    aiResult = response.result;
  } else if (resolvedProvider === 'OLLAMA') {
    const response = await runOllamaReview(project, findings);
    providerUsed = 'OLLAMA';
    model = response.model;
    aiResult = response.result;
  }

  const technicalScore = localScore(findings);
  const score = aiResult
    ? Math.round((technicalScore * 0.55) + (aiResult.overallScore * 0.45))
    : technicalScore;
  const blockers = findings.filter((finding) => finding.severity === 'BLOCKER');
  const report: AIDirectorReport = {
    version: 1,
    projectId,
    generatedAt: new Date().toISOString(),
    requestedProvider,
    providerUsed,
    model,
    score,
    exportReady: blockers.length === 0 && (aiResult?.sceneReviews.every((scene) => scene.verdict !== 'REGENERATE') ?? true),
    summary: aiResult?.summary || (blockers.length
      ? `${blockers.length} blocking production issue${blockers.length === 1 ? '' : 's'} must be resolved before client delivery.`
      : 'The project passes the deterministic production checks.'),
    findings,
    sceneReviews: aiResult?.sceneReviews || localSceneReviews(project, findings),
    promptAudits,
    nextActions: aiResult?.nextActions?.length
      ? aiResult.nextActions
      : findings.slice(0, 5).map((finding) => finding.suggestedAction),
  };
  saveReport(report);
  return report;
}
