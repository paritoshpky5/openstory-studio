'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
} from 'lucide-react';
import { formatDuration, formatCurrency } from '@/lib/utils';

import { SceneImageStudio } from '@/components/studio/scene-image-studio';
import { VoiceAudioStudio } from '@/components/studio/voice-audio-studio';
import { VideoAnimationStudio } from '@/components/studio/video-animation-studio';
import { SoundDesignStudio } from '@/components/studio/sound-design-studio';
import { RenderStudio } from '@/components/studio/render-studio';

export default function ProjectStudioPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'style' | 'scenes' | 'storyboards' | 'video' | 'voice' | 'timeline'>('overview');
  const [lockingAction, setLockingAction] = useState<string | null>(null);
  const [uploadingCharId, setUploadingCharId] = useState<string | null>(null);
  const [copiedCharId, setCopiedCharId] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);

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
    const text = `Indian character portrait. ${char.name}, ${char.role}. Age: ${char.ageDescription}. Skin tone: ${char.skinDescription}. Face: ${char.faceDescription}. Eyes: ${char.eyeDescription}, Hair: ${char.hairDescription}. Attire: ${char.clothingDescription}. Style: stylized 3D Indian animated film, rich textures, soft rim lighting, neutral studio background. Consistency token: ${char.consistencyPrompt || ''}`;
    navigator.clipboard.writeText(text);
    setCopiedCharId(char.id);
    setTimeout(() => setCopiedCharId(null), 2500);
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

  const fetchProject = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

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
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-800 pt-3 gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'characters', label: `Character Bible (${project.characters?.length || 0})`, icon: Users },
            { id: 'style', label: 'Style Bible', icon: Palette },
            { id: 'scenes', label: `Scenes & Shots (${project.scenes?.length || 0})`, icon: Clapperboard },
            { id: 'storyboards', label: 'Image Studio & Takes', icon: ImageIcon },
            { id: 'video', label: 'Image → Video Studio', icon: VideoIcon },
            { id: 'voice', label: 'Hindi Voice Lab', icon: Volume2 },
            { id: 'timeline', label: 'Timeline & Audio', icon: Film },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
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

          {/* Timeline Track Rows */}
          <div className="space-y-3 font-mono text-xs">
            {/* Video Track */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-cyan-400" />
                  VIDEO TRACK (V1)
                </span>
                <span>{project.scenes?.length || 0} Shots</span>
              </div>
              <div className="flex gap-1 overflow-x-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
                {project.scenes?.map((s: any) => (
                  <div
                    key={s.id}
                    style={{ flexGrow: s.durationSeconds }}
                    className="min-w-[90px] h-14 rounded bg-cyan-950/60 border border-cyan-500/30 p-2 flex flex-col justify-between shrink-0 hover:bg-cyan-900/60 transition-colors cursor-pointer"
                  >
                    <span className="text-[10px] text-cyan-300 font-bold truncate">#{s.sceneNumber} {s.title}</span>
                    <span className="text-[9px] text-slate-400">{s.durationSeconds}s</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Narration Track */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  HINDI NARRATION (A1)
                </span>
                <span>Sarvam / ElevenLabs TTS</span>
              </div>
              <div className="flex gap-1 overflow-x-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
                {project.scenes?.map((s: any) => (
                  <div
                    key={s.id}
                    style={{ flexGrow: s.durationSeconds }}
                    className="min-w-[90px] h-10 rounded bg-amber-950/50 border border-amber-500/30 p-1.5 flex items-center justify-between shrink-0"
                  >
                    <span className="text-[10px] text-amber-200 truncate">
                      {s.narrationHindi ? 'Narration' : 'Silence'}
                    </span>
                    <span className="text-[9px] text-slate-400">{s.durationSeconds}s</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Music & Ambience Track */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  AMBIENCE & MUSIC DUCKING (A2)
                </span>
                <span>Auto-ducking enabled (-12dB)</span>
              </div>
              <div className="w-full h-8 rounded bg-emerald-950/30 border border-emerald-500/20 p-2 flex items-center justify-between">
                <span className="text-[10px] text-emerald-400">Master Ambience Track + Soundtrack</span>
                <span className="text-[10px] text-slate-500">{formatDuration(totalDuration)}</span>
              </div>
            </div>
          </div>

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
