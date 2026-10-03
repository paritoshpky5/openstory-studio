'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Film,
  Sparkles,
  Lock,
  Unlock,
  Users,
  Palette,
  Clapperboard,
  Volume2,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Camera,
  Play,
  Share2,
  RefreshCw,
  Sliders,
  DollarSign,
  Image as ImageIcon,
  Video as VideoIcon,
  Upload,
  Copy,
  Check,
  ExternalLink,
  Download,
  Archive,
  FolderArchive,
  Trash2,
  Settings,
} from 'lucide-react';
import { formatDuration, formatCurrency } from '@/lib/utils';

import { SceneImageStudio } from '@/components/studio/scene-image-studio';
import { VoiceAudioStudio } from '@/components/studio/voice-audio-studio';
import { VideoAnimationStudio } from '@/components/studio/video-animation-studio';
import { SoundDesignStudio } from '@/components/studio/sound-design-studio';
import { RenderStudio } from '@/components/studio/render-studio';
import { TimelineEditor } from '@/components/studio/timeline';
import { AIDirectorPanel } from '@/components/studio/ai-director-panel';

type CharacterImageProvider = 'FLUX' | 'GEMINI' | 'OPENAI';

const CHARACTER_IMAGE_PROVIDERS: Array<{
  id: CharacterImageProvider;
  label: string;
  modelId: string;
  settingsKey: string;
}> = [
  {
    id: 'GEMINI',
    label: 'Gemini 3.1 Flash Image',
    modelId: 'gemini-3.1-flash-image',
    settingsKey: 'GEMINI_API_KEY',
  },
  {
    id: 'OPENAI',
    label: 'OpenAI GPT Image',
    modelId: 'gpt-image-1',
    settingsKey: 'OPENAI_API_KEY',
  },
  {
    id: 'FLUX',
    label: 'FLUX.1 Dev',
    modelId: 'flux-1-dev',
    settingsKey: 'BFL_API_KEY',
  },
];

export default function ProjectStudioPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'style' | 'scenes' | 'storyboards' | 'video' | 'voice' | 'timeline'>('overview');
  const [lockingAction, setLockingAction] = useState<string | null>(null);
  const [uploadingCharId, setUploadingCharId] = useState<string | null>(null);
  const [copiedCharId, setCopiedCharId] = useState<string | null>(null);
  const [characterImageProvider, setCharacterImageProvider] = useState<CharacterImageProvider>('GEMINI');
  const [imageApiStatus, setImageApiStatus] = useState<Record<string, { configured: boolean }>>({});
  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null);
  const [generatedCharId, setGeneratedCharId] = useState<string | null>(null);
  const [characterGenerationErrors, setCharacterGenerationErrors] = useState<Record<string, string>>({});
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedCharacterProvider = CHARACTER_IMAGE_PROVIDERS.find(
    (provider) => provider.id === characterImageProvider
  )!;
  const isCharacterProviderConfigured = Boolean(
    imageApiStatus[selectedCharacterProvider.settingsKey]?.configured
  );

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to completely delete this project? All images, videos, and generated audio files will be permanently destroyed.')) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
      router.push('/');
    } catch (err: any) {
      alert(err.message || 'Error deleting project');
      setIsDeleting(false);
    }
  };

  const handleExportZip = async () => {
    try {
      setIsExportingZip(true);
      const res = await fetch(`/api/projects/${projectId}/export-zip`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate project archive');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = res.headers.get('content-disposition');
      let filename = `${project?.name || 'project'}_openstory_backup.zip`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Error exporting project ZIP');
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleCopyCharPrompt = (char: any) => {
    const text = buildCharacterPortraitPrompt(char);
    navigator.clipboard.writeText(text);
    setCopiedCharId(char.id);
    setTimeout(() => setCopiedCharId(null), 2500);
  };

  const buildCharacterPortraitPrompt = (char: any) => {
    const styleBible = project?.styleBible;
    return [
      'Create one production-ready character identity portrait for an animated film character bible.',
      `${char.name}, role: ${char.role}.`,
      `Locked identity: ${char.consistencyPrompt || ''}`,
      `Age and build: ${char.ageDescription}; ${char.bodyDescription}.`,
      `Face and coloring: ${char.skinDescription}; ${char.faceDescription}.`,
      `Eyes and hair: ${char.eyeDescription}; ${char.hairDescription}.`,
      char.facialHairDescription ? `Facial hair: ${char.facialHairDescription}.` : '',
      `Locked clothing: ${char.clothingDescription}.`,
      char.accessories ? `Locked accessories: ${char.accessories}.` : '',
      styleBible?.characterStyle ? `Character style: ${styleBible.characterStyle}.` : '',
      styleBible?.renderStyle ? `Render style: ${styleBible.renderStyle}.` : '',
      styleBible?.materialStyle ? `Materials: ${styleBible.materialStyle}.` : '',
      styleBible?.lightingStyle ? `Lighting language: ${styleBible.lightingStyle}.` : '',
      'Composition: one character only, centered head-and-shoulders portrait, straight-on eye-level camera, face fully visible, calm neutral expression, clean neutral studio background, soft even portrait lighting, sharp identity-defining details.',
      'Preserve every named physical trait, color, clothing item, accessory, and distinctive marking exactly. No text, labels, borders, props, extra characters, or alternate costume.',
    ].filter(Boolean).join(' ');
  };

  const buildCharacterNegativePrompt = (char: any) => [
    char.negativeConsistencyPrompt,
    project?.styleBible?.negativePrompt,
    'multiple characters, duplicate body parts, cropped ears, cropped head, obscured face, profile view, extreme expression, costume variation, accessory variation, text, caption, logo, watermark, frame, busy background',
  ].filter(Boolean).join(', ');

  const handleGenerateCharacterRef = async (char: any) => {
    const activePrimaryFace = char.references?.find(
      (reference: any) => reference.isActive && reference.isApproved && reference.referenceType === 'PRIMARY_FACE'
    );

    try {
      setGeneratingCharId(char.id);
      setGeneratedCharId(null);
      setCharacterGenerationErrors((current) => {
        const next = { ...current };
        delete next[char.id];
        return next;
      });

      const generationResponse = await fetch(`/api/projects/${projectId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: char.id,
          assetType: 'CHARACTER_REFERENCE',
          provider: selectedCharacterProvider.id,
          modelId: selectedCharacterProvider.modelId,
          customPrompt: buildCharacterPortraitPrompt(char),
          customNegativePrompt: buildCharacterNegativePrompt(char),
          settings: {
            aspectRatio: '1:1',
            referenceType: 'PRIMARY_FACE',
            quality: 'auto',
          },
          referencePaths: activePrimaryFace ? [activePrimaryFace.filePath] : [],
          forceRegeneration: Boolean(activePrimaryFace),
        }),
      });
      const generationData = await generationResponse.json().catch(() => ({}));
      if (!generationResponse.ok || !generationData.success) {
        throw new Error(generationData.error || 'Character portrait generation failed');
      }

      const assetId = generationData.assetVersion?.id;
      if (!assetId) throw new Error('The provider returned an image without an asset ID');

      const approvalResponse = await fetch(`/api/projects/${projectId}/assets/${assetId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', makeActive: true }),
      });
      const approvalData = await approvalResponse.json().catch(() => ({}));
      if (!approvalResponse.ok || !approvalData.success) {
        throw new Error(approvalData.error || 'Portrait generated, but it could not be set as the active reference');
      }

      await fetchProject(false);
      setGeneratedCharId(char.id);
      setTimeout(() => setGeneratedCharId((current) => current === char.id ? null : current), 3500);
    } catch (err: any) {
      setCharacterGenerationErrors((current) => ({
        ...current,
        [char.id]: err.message || 'Character portrait generation failed',
      }));
    } finally {
      setGeneratingCharId(null);
    }
  };

  const handleUploadCharRef = async (charId: string, file: File) => {
    try {
      setUploadingCharId(charId);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('characterId', charId);
      formData.append('assetType', 'CHARACTER_REF');
      formData.append('viewType', 'PRIMARY_FACE');
      formData.append('prompt', `Imported ${file.name} for Character Reference`);

      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        await fetchProject();
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (e: any) {
      alert(e.message || 'Upload error');
    } finally {
      setUploadingCharId(null);
    }
  };

  const fetchProject = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success) {
        setProject(data.project);
      } else {
        setError(data.error || 'Failed to load project');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching project');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  useEffect(() => {
    const fetchImageApiStatus = async () => {
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (!response.ok || !data.success) return;

        setImageApiStatus(data.settings || {});
        const firstConfiguredProvider = CHARACTER_IMAGE_PROVIDERS.find(
          (provider) => data.settings?.[provider.settingsKey]?.configured
        );
        if (firstConfiguredProvider) setCharacterImageProvider(firstConfiguredProvider.id);
      } catch (settingsError) {
        console.error('Failed to load image API status:', settingsError);
      }
    };

    fetchImageApiStatus();
  }, []);

  const toggleStyleLock = async () => {
    if (!project?.styleBible) return;
    setLockingAction('style');
    try {
      const targetState = !project.styleBible.isLocked;
      const res = await fetch(`/api/projects/${projectId}/style/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: targetState }),
      });
      const data = await res.json();
      if (data.success) {
        setProject((prev: any) => ({
          ...prev,
          styleBible: data.styleBible,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLockingAction(null);
    }
  };

  const toggleCharacterLock = async (characterId: string, currentState: boolean) => {
    setLockingAction(characterId);
    try {
      const res = await fetch(`/api/characters/${characterId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !currentState }),
      });
      const data = await res.json();
      if (data.success) {
        setProject((prev: any) => ({
          ...prev,
          characters: prev.characters.map((c: any) =>
            c.id === characterId ? { ...c, isLocked: !currentState } : c
          ),
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLockingAction(null);
    }
  };

  if (loading && !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm font-mono text-slate-400">Loading OpenStory Studio Project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Project Not Found</h2>
        <p className="text-xs text-red-300">{error || 'The requested project could not be found.'}</p>
        <Link
          href="/"
          className="inline-block px-4 py-2 text-xs font-semibold bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700"
        >
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  const totalDuration = project.scenes?.reduce(
    (acc: number, s: any) => acc + (s.durationSeconds || 0),
    0
  ) || 0;

  return (
    <div className="space-y-6">
      {/* Studio Header Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {project.aspectRatio} • {project.fps} FPS
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                Lang: {project.targetLanguage}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Phase: {project.currentPhase.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-xs text-slate-400 max-w-2xl line-clamp-1">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={toggleStyleLock}
              disabled={lockingAction === 'style'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                project.styleBible?.isLocked
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-amber-500/50'
              }`}
            >
              {project.styleBible?.isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Style Bible Locked
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  Lock Style Bible
                </>
              )}
            </button>

            <Link
              href={`/lab?projectId=${project.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Model Lab
            </Link>

            <button
              onClick={handleExportZip}
              disabled={isExportingZip}
              title="Export whole video project (database records, prompts, images, video & audio) as a portable .zip archive"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-50"
            >
              {isExportingZip ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  Packaging ZIP...
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5 text-amber-400" />
                  Export Project (.zip)
                </>
              )}
            </button>

            <button
              onClick={handleDeleteProject}
              disabled={isDeleting}
              title="Permanently delete this project"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              {isDeleting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  Delete Project
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-800 pt-3 gap-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'Overview', icon: Layers, isActionable: false },
            { id: 'style', label: 'Style Bible', icon: Palette, isActionable: false },
            { id: 'scenes', label: `Scenes (${project.scenes?.length || 0})`, icon: Clapperboard, isActionable: false },
            { id: 'characters', label: `Character Bible (${project.characters?.length || 0})`, icon: Users, isActionable: true },
            { id: 'storyboards', label: 'Image Studio', icon: ImageIcon, isActionable: true },
            { id: 'voice', label: 'Audio Lab', icon: Volume2, isActionable: true },
            { id: 'video', label: 'Video Studio', icon: VideoIcon, isActionable: true },
            { id: 'timeline', label: 'Timeline / Export', icon: Film, isActionable: true },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            // Highlight actionable tabs differently
            const inactiveStyle = tab.isActionable
              ? 'bg-indigo-500/10 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500/20 shadow-inner'
              : 'text-slate-400 border border-transparent hover:text-white hover:bg-slate-800/60';

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md scale-[1.02]'
                    : inactiveStyle
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : tab.isActionable ? 'text-indigo-400' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1">
              <span className="text-xs text-slate-500 font-mono uppercase">Total Runtime</span>
              <div className="text-2xl font-bold text-white flex items-center gap-1.5">
                <Clock className="w-5 h-5 text-amber-400" />
                {formatDuration(totalDuration)}
              </div>
              <span className="text-[10px] text-slate-400">{project.scenes?.length || 0} discrete shots</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1">
              <span className="text-xs text-slate-500 font-mono uppercase">Recurring Cast</span>
              <div className="text-2xl font-bold text-amber-400 flex items-center gap-1.5">
                <Users className="w-5 h-5" />
                {project.characters?.length || 0}
              </div>
              <span className="text-[10px] text-slate-400">
                {project.characters?.filter((c: any) => c.isLocked).length || 0} locked identities
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1">
              <span className="text-xs text-slate-500 font-mono uppercase">Visual Style</span>
              <div className="text-lg font-bold text-white flex items-center gap-1.5 truncate">
                <Palette className="w-5 h-5 text-cyan-400 shrink-0" />
                {project.styleBible?.isLocked ? 'Locked' : 'Drafting'}
              </div>
              <span className="text-[10px] text-slate-400">Stylized 3D Indian Cinema</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1">
              <span className="text-xs text-slate-500 font-mono uppercase">Budget Allocation</span>
              <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="w-5 h-5" />
                {project.budgetLimit ? formatCurrency(project.budgetLimit) : 'Flexible'}
              </div>
              <span className="text-[10px] text-slate-400">Cost-per-approved-shot metric</span>
            </div>
          </div>

          {/* Project Backup & Portability Banner */}
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-950 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                <FolderArchive className="w-4 h-4" />
                Full Project Backup & Portability (.zip)
              </div>
              <h4 className="text-sm font-bold text-white">
                Download Entire Video Project with All Media Files
              </h4>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Export a self-contained archive containing all {project.scenes?.length || 0} scene prompts,
                camera movements, Hindi narration, character bibles, plus every generated image, audio voiceover,
                music track, and video clip stored on disk. Import this ZIP on any machine running OpenStory Studio.
              </p>
            </div>
            <button
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-all shadow-md shadow-amber-500/10 shrink-0 disabled:opacity-50"
            >
              {isExportingZip ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Archive...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Project (.zip)
                </>
              )}
            </button>
          </div>

          {/* Quick Scene Checklist */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-amber-400" />
              Filmmaking Shot Sequence
            </h3>
            <div className="divide-y divide-slate-800/80">
              {project.scenes?.map((scene: any) => (
                <div key={scene.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        SHOT #{scene.sceneNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-200">{scene.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-amber-400 border border-slate-700">
                        {scene.importance}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {scene.durationSeconds}s
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{scene.summary}</p>
                    {scene.narrationHindi && (
                      <p className="text-xs font-serif text-amber-200/90 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 inline-block">
                        &quot;{scene.narrationHindi}&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {scene.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHARACTER BIBLE */}
      {activeTab === 'characters' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Character Identity Packages</h2>
              <p className="text-xs text-slate-400">
                Rigorous visual traits ensuring persistent appearance across every scene and model.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5">
                <span className={`h-2 w-2 rounded-full ${isCharacterProviderConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <select
                  value={characterImageProvider}
                  onChange={(event) => setCharacterImageProvider(event.target.value as CharacterImageProvider)}
                  aria-label="Character portrait API provider"
                  className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none"
                >
                  {CHARACTER_IMAGE_PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id} className="bg-slate-950">
                      {provider.label}{imageApiStatus[provider.settingsKey]?.configured ? ' — ready' : ' — key needed'}
                    </option>
                  ))}
                </select>
              </div>
              {!isCharacterProviderConfigured && (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Add API key
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {project.characters?.map((char: any) => (
              <div
                key={char.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {char.role}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{char.name}</h3>
                    </div>

                    <button
                      onClick={() => toggleCharacterLock(char.id, char.isLocked)}
                      disabled={lockingAction === char.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        char.isLocked
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-amber-500/50'
                      }`}
                    >
                      {char.isLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                          Locked
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-amber-400" />
                          Lock Identity
                        </>
                      )}
                    </button>
                  </div>

                  {/* Character Trait Badges */}
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">
                        Age & Build
                      </span>
                      <p className="text-slate-300 font-medium">
                        {char.ageDescription} • {char.bodyDescription}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">
                        Facial Features & Skin Tone
                      </span>
                      <p className="text-slate-300">
                        <strong>Skin:</strong> {char.skinDescription}
                      </p>
                      <p className="text-slate-300">
                        <strong>Face:</strong> {char.faceDescription}
                      </p>
                      <p className="text-slate-300">
                        <strong>Eyes:</strong> {char.eyeDescription} • <strong>Hair:</strong> {char.hairDescription}
                      </p>
                      {char.facialHairDescription && (
                        <p className="text-slate-300">
                          <strong>Facial Hair:</strong> {char.facialHairDescription}
                        </p>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">
                        Locked Clothing & Accessories
                      </span>
                      <p className="text-slate-300">
                        <strong>Attire:</strong> {char.clothingDescription}
                      </p>
                      {char.accessories && (
                        <p className="text-slate-300">
                          <strong>Accessories:</strong> {char.accessories}
                        </p>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
                      <span className="text-[10px] font-mono text-amber-400 uppercase block font-bold">
                        Compiler Consistency Token
                      </span>
                      <p className="text-amber-200/90 font-mono text-[11px] leading-relaxed">
                        {char.consistencyPrompt}
                      </p>
                    </div>
                  </div>
                </div>

                {/* References Shelf & Web Free Workflow */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  {(() => {
                    const primaryFace = char.references?.find((r: any) => r.isActive && r.referenceType === 'PRIMARY_FACE') 
                                     || char.references?.[0];
                    if (primaryFace) {
                      return (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <img
                            src={`/api/media/${primaryFace.filePath}`}
                            alt={char.name}
                            className="w-12 h-12 rounded object-cover border border-amber-500/40"
                          />
                          <div className="text-xs">
                            <span className="text-slate-200 font-bold block">{primaryFace.referenceType || 'Primary Face Anchor'}</span>
                            <span className="text-[10px] text-emerald-400 font-mono">Active Reference Set</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => handleGenerateCharacterRef(char)}
                      disabled={generatingCharId !== null || !isCharacterProviderConfigured}
                      title={
                        isCharacterProviderConfigured
                          ? `Generate with ${selectedCharacterProvider.label}. This uses API credits and sets the result as the active face reference.`
                          : `Add a ${selectedCharacterProvider.label} API key in Settings first.`
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {generatingCharId === char.id ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Generating portrait...
                        </>
                      ) : generatedCharId === char.id ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active reference ready
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          {char.references?.some((reference: any) => reference.isActive && reference.referenceType === 'PRIMARY_FACE')
                            ? 'Regenerate with API'
                            : 'Generate Portrait (API)'}
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleCopyCharPrompt(char)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                    >
                      {copiedCharId === char.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px]">Copy Portrait Prompt</span>
                        </>
                      )}
                    </button>

                    <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 cursor-pointer transition-colors">
                      <Upload className="w-3 h-3 text-indigo-400" />
                      <span className="text-[11px]">{uploadingCharId === char.id ? 'Uploading...' : 'Upload Face (Free Web)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingCharId === char.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadCharRef(char.id, file);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {characterGenerationErrors[char.id] && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-2 text-[11px] text-red-200" role="alert">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span>{characterGenerationErrors[char.id]}</span>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500">
                    API portraits are generated at 1:1, approved, and installed as the active PRIMARY_FACE reference automatically.
                  </p>

                  {/* Free Web Generators Quick Links */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-400">
                    <span className="font-mono text-slate-500">Free Generators:</span>
                    <a
                      href="https://aitestkitchen.withgoogle.com/tools/image-fx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-amber-300 hover:underline flex items-center gap-0.5"
                    >
                      ImageFX (Free) ↗
                    </a>
                    <a
                      href="https://copilot.microsoft.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-cyan-300 hover:underline flex items-center gap-0.5"
                    >
                      Copilot ↗
                    </a>
                    <a
                      href="https://www.seaart.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-emerald-300 hover:underline flex items-center gap-0.5"
                    >
                      SeaArt (Flux) ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STYLE BIBLE */}
      {activeTab === 'style' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Project Style Bible</h2>
              <p className="text-xs text-slate-400">
                Technical visual grammar inherited by all generation prompts in this production.
              </p>
            </div>
            <button
              onClick={toggleStyleLock}
              disabled={lockingAction === 'style'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                project.styleBible?.isLocked
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              {project.styleBible?.isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Locked for Production
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  Lock Visual Style
                </>
              )}
            </button>
          </div>

          {project.styleBible && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="col-span-full p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">
                  Master Style Prompt
                </span>
                <p className="text-slate-200 text-sm leading-relaxed">
                  {project.styleBible.masterStylePrompt}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Character Design Style
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {project.styleBible.characterStyle}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Lighting & Atmosphere
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {project.styleBible.lightingStyle}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Environment & Set Aesthetics
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {project.styleBible.environmentStyle}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Color Grading & Palette
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {project.styleBible.colorLanguage}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Cinematography & Lens Choices
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {project.styleBible.cameraStyle} • {project.styleBible.lensStyle} • {project.styleBible.depthOfFieldStyle}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Negative Quality Constraints
                </span>
                <p className="text-red-300/80 leading-relaxed font-mono text-[11px]">
                  {project.styleBible.negativePrompt}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SCENES & SHOTS */}
      {activeTab === 'scenes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Scenes & Shot Plan</h2>
              <p className="text-xs text-slate-400">
                Individual 3–8 second shots ready for storyboard and production image generation.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {project.scenes?.map((scene: any) => (
              <div
                key={scene.id}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                      SHOT #{scene.sceneNumber}
                    </span>
                    <h3 className="font-bold text-base text-white">{scene.title}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        scene.importance === 'HERO'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : scene.importance === 'IMPORTANT'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {scene.importance}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-slate-400">{scene.durationSeconds}s</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {scene.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Location & Lighting</span>
                    <p className="text-slate-300 font-medium">{scene.location}</p>
                    <p className="text-slate-400 text-[11px]">{scene.timeOfDay} • {scene.lighting}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Camera & Motion</span>
                    <p className="text-slate-300 font-medium">{scene.cameraMovement}</p>
                    <p className="text-slate-400 text-[11px]">{scene.shotType} • {scene.cameraAngle} • Preset: {scene.motionPreset}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Sound & Mood</span>
                    <p className="text-slate-300 font-medium">{scene.mood}</p>
                    <p className="text-slate-400 text-[11px] line-clamp-1">{scene.ambiencePrompt || 'Ambience'}</p>
                  </div>
                </div>

                {/* Hindi Narration / Dialogue */}
                {(scene.narrationHindi || scene.dialogueHindi) && (
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 space-y-1.5 text-xs">
                    {scene.narrationHindi && (
                      <div>
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">
                          Hindi Narration (Devanagari)
                        </span>
                        <p className="text-amber-100 font-serif text-sm leading-relaxed">
                          {scene.narrationHindi}
                        </p>
                      </div>
                    )}
                    {scene.dialogueHindi && (
                      <div className="pt-1.5 border-t border-amber-500/10">
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">
                          Character Dialogue (Devanagari)
                        </span>
                        <p className="text-amber-200 font-serif text-sm leading-relaxed">
                          &quot;{scene.dialogueHindi}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: IMAGE STUDIO & TAKES */}
      {activeTab === 'storyboards' && (
        <SceneImageStudio
          projectId={projectId}
          project={project}
          onRefresh={fetchProject}
        />
      )}

      {/* TAB: IMAGE TO VIDEO STUDIO */}
      {activeTab === 'video' && (
        <VideoAnimationStudio
          projectId={projectId}
          project={project}
          onRefresh={fetchProject}
        />
      )}

      {/* TAB: HINDI VOICE LAB */}
      {activeTab === 'voice' && (
        <VoiceAudioStudio
          projectId={projectId}
          project={project}
          onRefresh={fetchProject}
        />
      )}

      {/* TAB 6: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Audio & Video Timeline</h2>
              <p className="text-xs text-slate-400">
                Multi-track deterministic assembly ready for FFmpeg render.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                {formatDuration(totalDuration)} Total
              </span>
            </div>
          </div>

          <AIDirectorPanel projectId={projectId} />

          {/* Interactive Multi-Track Timeline Editor */}
          <TimelineEditor
            projectId={projectId}
            project={project}
            onTimelineChange={fetchProject}
          />

          {/* 5-Stem Sound Design, Lip Sync & Subtitle Mixer */}
          <SoundDesignStudio
            projectId={projectId}
            project={project}
            onRefresh={fetchProject}
          />
          
          <div className="pt-8 border-t border-slate-800/80">
            <h2 className="text-xl font-black text-white mb-6">Final Render & Export</h2>
            <RenderStudio 
              projectId={projectId} 
              project={project} 
              onRefresh={fetchProject} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
