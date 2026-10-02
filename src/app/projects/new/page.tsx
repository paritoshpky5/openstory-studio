'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  FileCheck,
  ArrowRight,
  BookOpen,
  Clapperboard,
  ShieldCheck,
  RefreshCw,
  Volume2,
  Mic,
  Users,
  Archive,
  FolderArchive,
  Upload,
  Zap,
} from 'lucide-react';
import { validateStoryFlowJson } from '@/schemas/storyflow.schema';

export default function NewProjectPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'prompt' | 'import' | 'zip'>('prompt');

  // Tab 1 state
  const [userStory, setUserStory] = useState('');
  const [promptText, setPromptText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [narrationMode, setNarrationMode] = useState<'SOLO_STORYTELLER' | 'DRAMATIC_DIALOGUE' | 'MINIMAL_NARRATION'>('SOLO_STORYTELLER');
  const [narratorTone, setNarratorTone] = useState<string>('Warm, engaging traditional Indian katha-vachak (दादी-नानी / ज्ञानी सूत्रधार)');
  const [shotPlanningMode, setShotPlanningMode] = useState<'SCENE_AS_SHOT' | 'MULTI_SHOT'>('SCENE_AS_SHOT');

  // Auto-generation state (LLM API Automation)
  const [llmProvider, setLlmProvider] = useState<'openai' | 'anthropic' | 'gemini' | 'openrouter'>('openai');
  const [customLlmKey, setCustomLlmKey] = useState('');
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenError, setAutoGenError] = useState<string | null>(null);
  const [autoGenStatus, setAutoGenStatus] = useState<string | null>(null);

  // Tab 2 state
  const [pastedJson, setPastedJson] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Tab 3 state (ZIP backup import)
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [zipImportError, setZipImportError] = useState<string | null>(null);
  const [zipImportSuccess, setZipImportSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'zip') {
        setActiveTab('zip');
      }
    }
  }, []);

  const handleImportZip = async () => {
    if (!zipFile) return;
    setIsImportingZip(true);
    setZipImportError(null);
    setZipImportSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', zipFile);

      const res = await fetch('/api/projects/import-zip', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.projectId) {
        setZipImportSuccess(`Project "${data.name}" restored successfully! Redirecting to studio...`);
        setTimeout(() => {
          router.push(`/projects/${data.projectId}`);
        }, 1200);
      } else {
        setZipImportError(data.error || 'Failed to import project ZIP archive');
      }
    } catch (err: any) {
      setZipImportError(err.message || 'Network error importing project ZIP');
    } finally {
      setIsImportingZip(false);
    }
  };

  // Fetch / generate prompt
  const handleGeneratePrompt = async () => {
    setIsGeneratingPrompt(true);
    try {
      const res = await fetch('/api/prompt/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyText: userStory,
          narrationMode,
          narratorTone,
          shotPlanningMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPromptText(data.prompt);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleCopyPrompt = async () => {
    let textToCopy = promptText;
    if (!textToCopy) {
      const res = await fetch('/api/prompt/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyText: userStory,
          narrationMode,
          narratorTone,
          shotPlanningMode,
        }),
      });
      const data = await res.json();
      textToCopy = data.prompt;
      setPromptText(textToCopy);
    }

    await navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleAutoGenerate = async () => {
    setIsAutoGenerating(true);
    setAutoGenError(null);
    setAutoGenStatus(`Connecting to ${llmProvider.toUpperCase()} to architect 3D character bibles & shot timeline...`);

    try {
      const res = await fetch('/api/prompt/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyText: userStory,
          narrationMode,
          narratorTone,
          shotPlanningMode,
          provider: llmProvider,
          apiKey: customLlmKey || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.projectId) {
        setAutoGenStatus(`Story "${data.project?.name || 'Project'}" successfully created! Loading studio...`);
        setTimeout(() => {
          router.push(`/projects/${data.projectId}`);
        }, 1200);
      } else {
        setAutoGenError(data.error || 'Failed to auto-generate story project');
        setAutoGenStatus(null);
      }
    } catch (err: any) {
      setAutoGenError(err.message || 'Network error during automated story generation');
      setAutoGenStatus(null);
    } finally {
      setIsAutoGenerating(false);
    }
  };

  // Validate JSON
  const handleValidate = () => {
    setImportError(null);
    if (!pastedJson.trim()) {
      setValidationErrors(['Please paste the JSON output from ChatGPT or Claude']);
      setIsValidated(false);
      setParsedPreview(null);
      return;
    }

    try {
      // Strip potential markdown backticks ```json ... ```
      let clean = pastedJson.trim();
      if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(clean);
      const validation = validateStoryFlowJson(parsed);

      if (validation.success && validation.data) {
        setValidationErrors([]);
        setIsValidated(true);
        setParsedPreview(validation.data);
      } else {
        setValidationErrors(validation.errors || ['Schema validation failed']);
        setIsValidated(false);
        setParsedPreview(null);
      }
    } catch (err: any) {
      setValidationErrors([`JSON Syntax Error: ${err.message}`]);
      setIsValidated(false);
      setParsedPreview(null);
    }
  };

  // Submit and import to database & filesystem
  const handleImport = async () => {
    if (!parsedPreview) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectJson: {
            ...parsedPreview,
            project: { ...parsedPreview.project, shotPlanningMode },
          },
        }),
      });
      const result = await res.json();

      if (result.success && result.project?.id) {
        router.push(`/projects/${result.project.id}`);
      } else {
        setImportError(result.error || 'Failed to import project');
        if (result.details) {
          setValidationErrors(result.details);
        }
      }
    } catch (err: any) {
      setImportError(err.message || 'Network error importing project');
    } finally {
      setIsImporting(false);
    }
  };

  // Load sample project
  const handleLoadSample = () => {
    const sample = {
      schemaVersion: '1.0.0',
      project: {
        name: 'द गोल्डन दिया (The Golden Diya)',
        description: 'An emotional Hindi animated tale about a humble potter who discovers the true light of Diwali during a torrential village storm.',
        aspectRatio: '16:9',
        fps: 24,
        targetLanguage: 'hi-IN',
        budgetLimit: 50.0,
      },
      styleBible: {
        masterStylePrompt: 'Polished cinematic stylized 3D animated film aesthetic, rich Indian narrative cinema, detailed cloth micro-textures, expressive Indian character design, soft cinematic global illumination, physically plausible rim lighting, controlled shallow depth of field, premium feature-animation composition.',
        characterStyle: 'Stylized 3D animated Indian characters with expressive facial features, lifelike skin subsurface scattering without photorealism uncanny valley, anatomically proportioned with gentle animated stylization.',
        lightingStyle: 'Cinematic three-point lighting with warm golden key light, soft atmospheric bounce, gentle rim accents, volumetric dust motes.',
        renderStyle: 'Stylized octane render aesthetic, soft shadows, raytraced ambient occlusion, subsurface scattering on skin, high-end 3D animated film look.',
        environmentStyle: 'Richly detailed Indian rural pottery workshop, weathered terracotta textures, earthen walls, handwoven textiles, authentic brass utensils.',
        colorLanguage: 'Harmonious warm palette dominated by ochre, deep saffron, terracotta, marigold, indigo, and forest greens.',
        cameraStyle: 'Deliberate cinematic camera placement, eye-level intimate framing, slow dolly and tracking movements.',
        lensStyle: '50mm and 85mm prime cinema lenses for character close-ups; 28mm for establishing vistas.',
        depthOfFieldStyle: 'Shallow depth of field with creamy bokeh, isolating character emotional expressions.',
        animationStyle: 'Weighty natural human movement, subtle facial micro-expressions, breathing cycles, authentic cultural gestures.',
        materialStyle: 'Tactile cotton, silk, khadi, weathered brass, clay pottery, carved teak wood, physical roughness maps.',
        negativePrompt: 'photorealistic human live-action, 2D flat cartoon, anime eyes, low poly, plastic skin, oversaturated neon, amateur CGI, watermark, blurry, extra limbs, distorted hands, morphing clothes',
        aspectRatio: '16:9',
        fps: 24,
        isLocked: false,
      },
      characters: [
        {
          id: 'char_shyam',
          name: 'Shyam Kaka',
          role: 'PROTAGONIST',
          gender: 'Male',
          ageDescription: '56-year-old master potter from a rural Rajasthan village',
          faceDescription: 'Warm weathered oval face, deep caring smile lines around gentle eyes, strong cheekbones dusted with fine dry clay',
          skinDescription: 'Rich warm copper-brown Indian skin tone with subtle natural skin highlights',
          eyeDescription: 'Soulful deep almond-shaped dark brown eyes with patient resilience',
          hairDescription: 'Thick wavy grey hair swept back, silvery sideburns, weathered texture',
          facialHairDescription: 'Distinguished silver-grey mustache neatly trimmed over warm smile',
          bodyDescription: 'Sturdy posture with hands shaped by decades of spinning the pottery wheel, gentle stoop in shoulders',
          heightDescription: '5 feet 7 inches',
          clothingDescription: 'Faded terracotta-brown khadi kurta with rolled up sleeves, off-white cotton dhoti, dark indigo shoulder angavastram cloth',
          footwearDescription: 'Traditional worn leather jutti',
          accessories: 'Red sacred kalava thread on right wrist, small clay smudge on left temple',
          personality: 'Patient, deeply spiritual, loving elder, proud artisan who believes clay has a soul',
          defaultExpressions: 'Gentle warmth, quiet concentration, reverent awe',
          consistencyPrompt: 'Shyam Kaka, 56-year-old Indian master potter, warm copper-brown skin, grey swept-back hair, silver-grey mustache, wearing terracotta-brown rolled-sleeve khadi kurta, off-white dhoti, indigo shoulder cloth',
          negativeConsistencyPrompt: 'different clothing, modern shirt, young face, clean shaved, western clothing, fair skin, missing mustache',
          isLocked: true,
          referenceAssets: [],
        },
      ],
      scenes: [
        {
          sceneNumber: 1,
          title: 'The Rain Begins on the Wheel',
          importance: 'NORMAL',
          status: 'NOT_STARTED',
          location: 'Open courtyard of clay pottery workshop',
          timeOfDay: 'Overcast twilight before monsoon storm',
          environment: 'Open-air pottery workshop surrounded by shelves of drying clay pots, earthen floor, raindrops starting to patter on tin roof awning',
          lighting: 'Moody slate-blue ambient twilight contrasted by the warm glow of an oil lantern illuminating Shyam Kakas hands',
          mood: 'Anticipation and focused serenity',
          summary: 'Shyam Kaka sits at his stone wheel shaping wet terracotta clay as the first heavy rain drops hit the courtyard tiles.',
          characterIds: ['char_shyam'],
          narrationHindi: 'शाम का धुंधलका घिर आया था और आसमान में काले बादल उमड़ रहे थे। श्याम काका चाक पर बैठी मिट्टी को बड़े प्यार से तराश रहे थे।',
          dialogueHindi: null,
          speakingCharacterId: null,
          shotType: 'MEDIUM',
          cameraAngle: 'EYE_LEVEL',
          cameraMovement: 'Slow Dolly In',
          motionPreset: 'NATURAL',
          durationSeconds: 5.0,
          ambiencePrompt: 'Heavy raindrops beginning on tin roof, distant low rumble of thunder, soft rhythmic hum of spinning stone pottery wheel',
          sfxPrompt: 'Wet squelch of clay between fingers, water droplets splashing',
          musicMood: 'Low resonant sitar with gentle bansuri flute melody',
          orderIndex: 0,
          shots: [
            {
              shotNumber: 1,
              description: 'Medium shot of Shyam Kaka focusing on his spinning wheel as rain begins to fall around the open courtyard workshop.',
              duration: 5.0,
            },
          ],
        },
        {
          sceneNumber: 2,
          title: 'The Fragile Flame in the Storm',
          importance: 'HERO',
          status: 'NOT_STARTED',
          location: 'Sheltered doorway of workshop',
          timeOfDay: 'Night during heavy monsoon downpour',
          environment: 'Sheets of torrential rain outside the doorway, terracotta pots gleaming wet in reflected lightning',
          lighting: 'Dramatic warm golden flicker of a single lit diya held between trembling weathered hands, with occasional cool blue lightning rim glow',
          mood: 'Heroic tenderness and spiritual devotion',
          summary: 'Shyam Kaka shields the tiny golden flame of his diya from the fierce wind using his indigo angavastram cloth, his eyes reflecting pure hope.',
          characterIds: ['char_shyam'],
          narrationHindi: 'हवा का एक तेज झोंका आया, लेकिन काका ने अपने अंगवस्त्र से उस छोटे से दीये को संभाल लिया। कुछ दिए कभी बुझने के लिए नहीं बनते।',
          dialogueHindi: 'तू जलता रह नन्हें... जब तक मैं हूँ, ये आंधी तुझे छू नहीं सकती।',
          speakingCharacterId: 'char_shyam',
          shotType: 'CLOSE_UP',
          cameraAngle: 'LOW_ANGLE',
          cameraMovement: 'Arc Left',
          motionPreset: 'VERY_SUBTLE',
          durationSeconds: 6.0,
          ambiencePrompt: 'Fierce monsoon wind howl, pouring sheets of rain, wood creaking',
          sfxPrompt: 'Cloth whipping in wind, soft hiss of flickering oil flame',
          musicMood: 'Emotional orchestral strings swelling with sarangi crescendo',
          orderIndex: 1,
          shots: [
            {
              shotNumber: 1,
              description: 'Dramatic close up of Shyam Kaka shielding the glowing diya against the howling storm with unwavering determination.',
              duration: 6.0,
            },
          ],
        },
      ],
    };

    setPastedJson(JSON.stringify(sample, null, 2));
    const validation = validateStoryFlowJson(sample);
    if (validation.success && validation.data) {
      setIsValidated(true);
      setParsedPreview(validation.data);
      setValidationErrors([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <Clapperboard className="w-3.5 h-3.5" />
          Story Ingestion Engine
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Create New Hindi Film Project
        </h1>
        <p className="text-sm text-slate-400">
          OpenStory Studio uses a two-step human-in-the-loop workflow. First copy our master filmmaking prompt to ChatGPT or Claude, then paste back the validated JSON.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'prompt'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          1. Copy ChatGPT Story Prompt
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'import'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          2. Paste OpenStory JSON
          {isValidated && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('zip')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'zip'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Archive className="w-4 h-4" />
          3. Restore Project Backup (.zip)
          {zipFile && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-1" />
          )}
        </button>
      </div>

      {/* Tab 1: Copy Prompt */}
      {activeTab === 'prompt' && (
        <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={shotPlanningMode === 'MULTI_SHOT'}
              onChange={(event) => {
                setShotPlanningMode(event.target.checked ? 'MULTI_SHOT' : 'SCENE_AS_SHOT');
                setPromptText('');
              }}
              className="mt-0.5 h-4 w-4 accent-amber-500"
            />
            <span>
              <span className="block text-sm font-bold text-white">Allow multiple shots inside each scene</span>
              <span className="mt-1 block text-xs text-slate-400">
                Off keeps the simple workflow: every scene is one final shot. Turn it on for coverage, cutaways, and multiple camera setups per scene.
              </span>
            </span>
          </label>
          {/* Storyteller & Narration Mode Selector */}
          <div className="space-y-3 pb-5 border-b border-slate-800">
            <div>
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-400" />
                Storyteller & Voice Architecture
              </label>
              <p className="text-xs text-slate-400 mt-0.5">
                Tell ChatGPT how the speech track should be structured across your scenes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setNarrationMode('SOLO_STORYTELLER');
                  setPromptText('');
                }}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  narrationMode === 'SOLO_STORYTELLER'
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-amber-400" />
                    Solo Storyteller (कथावाचक)
                  </span>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Entire film is voiced by <b>1 single speaker</b>. Characters do not have separate voice actors; their lines are told expressively by the narrator.
                  </p>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono mt-2 font-semibold">Recommended for Tales & Mythology</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNarrationMode('DRAMATIC_DIALOGUE');
                  setPromptText('');
                }}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  narrationMode === 'DRAMATIC_DIALOGUE'
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    Dramatic Dialogue + Narrator
                  </span>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Multi-voice film. Characters have their own dialogue tracks, with a narrator introducing and connecting scenes.
                  </p>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono mt-2">Cinematic Acting</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNarrationMode('MINIMAL_NARRATION');
                  setPromptText('');
                }}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  narrationMode === 'MINIMAL_NARRATION'
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
                    Action & Dialogue Only
                  </span>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Minimal narration. The story is driven almost entirely by character dialogue and visual action.
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-2">Show, Don&apos;t Tell</span>
              </button>
            </div>

            {/* Narrator Tone Selection */}
            {narrationMode === 'SOLO_STORYTELLER' && (
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs text-slate-400 shrink-0 font-medium">Storyteller Archetype / Tone:</span>
                <select
                  value={narratorTone}
                  onChange={(e) => {
                    setNarratorTone(e.target.value);
                    setPromptText('');
                  }}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 flex-1"
                >
                  <option value="Warm, engaging traditional Indian katha-vachak (दादी-नानी या ज्ञानी सूत्रधार की शैली)">
                    Warm & Engaging Katha-Vachak (दादी-नानी / ज्ञानी सूत्रधार)
                  </option>
                  <option value="Deep, majestic, mythological narrator (महाकाव्य / पौराणिक कथा शैली)">
                    Deep & Majestic Mythological (पौराणिक / महाकाव्य शैली)
                  </option>
                  <option value="Suspenseful and dramatic thriller narrator (रहस्यमयी / रोमांचक कथा शैली)">
                    Suspense & Mystery Thriller (रहस्यमयी / रोमांचक शैली)
                  </option>
                  <option value="Gentle, poetic, and emotional narrator (भावुक एवं काव्यात्मक शैली)">
                    Gentle, Poetic & Emotional (भावुक एवं काव्यात्मक शैली)
                  </option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200 block">
              Optional: Enter Your Story Idea or Script Draft
            </label>
            <p className="text-xs text-slate-400">
              You can write a few sentences or paste an entire story. We will embed it into the prompt for ChatGPT.
            </p>
            <textarea
              rows={4}
              value={userStory}
              onChange={(e) => {
                setUserStory(e.target.value);
                setPromptText('');
              }}
              placeholder="e.g. A poor village potter in Rajasthan struggles to make a special diya for Diwali when a sudden monsoon storm threatens to destroy all his unbaked pots..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Option A: Automated AI Story Generation via API */}
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-900 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Zap className="w-4 h-4" />
                  Option A: 1-Click Automated Story Generation (API)
                </span>
                <p className="text-xs text-slate-400">
                  Let AI instantly plan, decompose scenes, and build your character bibles directly into the database.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 self-start sm:self-auto font-semibold">
                FAST TRACK
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Select AI Model / Provider:
                </label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                >
                  <option value="openai">OpenAI — Recommended</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 Pro)</option>
                  <option value="openrouter">OpenRouter (Multi-LLM Gateway)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  API Key (Optional if already configured in Settings):
                </label>
                <input
                  type="password"
                  value={customLlmKey}
                  onChange={(e) => setCustomLlmKey(e.target.value)}
                  placeholder={`Enter ${llmProvider.toUpperCase()} key (or leave empty to use Settings)`}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {autoGenError && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{autoGenError}</span>
              </div>
            )}

            {autoGenStatus && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 flex items-center gap-2 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                <span>{autoGenStatus}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-400">
                Uses 1 LLM request to architect entire visual &amp; audio script.
              </span>
              <button
                type="button"
                disabled={isAutoGenerating}
                onClick={handleAutoGenerate}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {isAutoGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Planning Film with AI...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Auto-Generate &amp; Launch Project
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-slate-500 text-xs font-mono uppercase tracking-wider">
              OR OPTION B: FREE WEB QUOTA ($0 SPEND)
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopyPrompt}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md hover:border-amber-500/50"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Copied Prompt to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-amber-400" />
                  Copy Master Story Prompt
                </>
              )}
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-2"
            >
              Already have JSON? Skip to Step 2 →
            </button>
          </div>

          {/* Workflow Guide */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              Filmmaking Workflow Instructions
            </h4>
            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Click <strong className="text-white">Copy ChatGPT Master Prompt</strong> above.
              </li>
              <li>
                Open <strong className="text-white">ChatGPT</strong>, <strong className="text-white">Claude</strong>, or <strong className="text-white">Google Gemini</strong>.
              </li>
              <li>Paste the prompt and press Enter. It will analyze your story and return valid OpenStory JSON.</li>
              <li>Copy the raw JSON response from the LLM.</li>
              <li>Click on the <strong>&quot;2. Paste OpenStory JSON&quot;</strong> tab and paste it.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab 2: Paste & Validate JSON */}
      {activeTab === 'import' && (
        <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shotPlanningMode === 'MULTI_SHOT'}
              onChange={(event) => setShotPlanningMode(event.target.checked ? 'MULTI_SHOT' : 'SCENE_AS_SHOT')}
              className="mt-0.5 h-4 w-4 accent-amber-500"
            />
            <span className="text-xs text-slate-300">
              <strong className="block text-white">Use multiple shots per scene</strong>
              When off, OpenStory imports one production shot for every scene, even if the JSON contains additional shot suggestions.
            </span>
          </label>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-200">
              Paste ChatGPT / Claude JSON Response
            </label>
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 underline underline-offset-4"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Sample Hindi Project
            </button>
          </div>

          <textarea
            rows={12}
            value={pastedJson}
            onChange={(e) => {
              setPastedJson(e.target.value);
              setIsValidated(false);
              setParsedPreview(null);
              setValidationErrors([]);
            }}
            placeholder='{\n  "schemaVersion": "1.0.0",\n  "project": {\n    "name": "..."\n  },\n  ...\n}'
            className="w-full bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 rounded-lg p-3 placeholder:text-slate-700 focus:outline-none focus:border-amber-500/50"
          />

          {/* Validation Feedback */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                <AlertCircle className="w-4 h-4" />
                Validation Errors Detected ({validationErrors.length})
              </div>
              <ul className="text-xs text-red-300/90 font-mono space-y-1 max-h-48 overflow-y-auto pl-2">
                {validationErrors.map((err, i) => (
                  <li key={i} className="list-disc list-inside">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 font-semibold">
              {importError}
            </div>
          )}

          {/* Validated Preview Card */}
          {isValidated && parsedPreview && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  OpenStory Schema v1.0.0 Validated Successfully
                </div>
                <span className="text-[11px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  Ready to Import
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Project Title</span>
                  <strong className="text-white text-sm block truncate">
                    {parsedPreview.project?.name}
                  </strong>
                  <span className="text-[10px] text-slate-400">
                    {parsedPreview.project?.aspectRatio} • {parsedPreview.project?.fps}fps
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Recurring Characters</span>
                  <strong className="text-amber-400 text-sm block">
                    {parsedPreview.characters?.length || 0} Defined
                  </strong>
                  <span className="text-[10px] text-slate-400">
                    {parsedPreview.characters?.map((c: any) => c.name).join(', ')}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Scenes & Shots</span>
                  <strong className="text-cyan-400 text-sm block">
                    {parsedPreview.scenes?.length || 0} Scenes
                  </strong>
                  <span className="text-[10px] text-slate-400">
                    Hindi Audio & Sound Specs Ready
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleValidate}
              className="inline-flex items-center gap-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              <FileCheck className="w-4 h-4 text-cyan-400" />
              Validate Schema
            </button>

            <button
              type="button"
              disabled={!isValidated || isImporting}
              onClick={handleImport}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg ${
                isValidated && !isImporting
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Importing to SQLite & Filesystem...
                </>
              ) : (
                <>
                  Import Project to Studio
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Restore Project Backup (.zip) */}
      {activeTab === 'zip' && (
        <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FolderArchive className="w-5 h-5 text-amber-400" />
              Restore Full OpenStory Project (.zip)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload an exported OpenStory Studio project archive. All scenes, shots, camera specs,
              Hindi voiceover/narration, character bibles, and local media files (images, audio, videos)
              will be completely unpacked and restored into your local database and filesystem.
            </p>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                const file = files[0];
                if (file.name.endsWith('.zip')) {
                  setZipFile(file);
                  setZipImportError(null);
                } else {
                  setZipImportError('Please select a valid .zip project archive.');
                }
              }
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10'
                : zipFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/50'
            }`}
            onClick={() => {
              const input = document.getElementById('zip-file-input');
              if (input) input.click();
            }}
          >
            <input
              id="zip-file-input"
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const file = files[0];
                  if (file.name.endsWith('.zip') || file.type.includes('zip')) {
                    setZipFile(file);
                    setZipImportError(null);
                  } else {
                    setZipImportError('Please select a valid .zip project archive.');
                  }
                }
              }}
            />

            {zipFile ? (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{zipFile.name}</h4>
                  <p className="text-xs text-slate-400">
                    {(zipFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to unpack & restore
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZipFile(null);
                  }}
                  className="text-xs text-slate-400 hover:text-red-400 underline underline-offset-4"
                >
                  Choose a different file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    Drag and drop your project <span className="text-amber-400">.zip</span> archive here
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    or click to browse your local computer
                  </p>
                </div>
                <span className="inline-block text-[11px] font-mono text-slate-500 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  Supports *.zip generated by OpenStory Studio
                </span>
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {zipImportError && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{zipImportError}</span>
            </div>
          )}

          {zipImportSuccess && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300 flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{zipImportSuccess}</span>
            </div>
          )}

          {/* Restore Button */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              disabled={!zipFile || isImportingZip}
              onClick={handleImportZip}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg ${
                zipFile && !isImportingZip
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isImportingZip ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Unpacking Media & Restoring Database...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Restore Full Project
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
