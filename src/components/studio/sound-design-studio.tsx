'use client';

import React, { useState } from 'react';
import {
  Volume2,
  Sliders,
  FileText,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Download,
  Play,
  Film,
  Music,
  Headphones,
  Mic,
  MessageSquare,
} from 'lucide-react';

interface SoundDesignStudioProps {
  projectId: string;
  project: any;
  onRefresh?: () => void;
}

export function SoundDesignStudio({ projectId, project, onRefresh }: SoundDesignStudioProps) {
  // Stem Volume Sliders
  const [narrationVol, setNarrationVol] = useState<number>(100);
  const [dialogueVol, setDialogueVol] = useState<number>(100);
  const [musicVol, setMusicVol] = useState<number>(30);
  const [ambienceVol, setAmbienceVol] = useState<number>(20);
  const [sfxVol, setSfxVol] = useState<number>(60);
  const [autoDucking, setAutoDucking] = useState<boolean>(true);
  const [duckingDb, setDuckingDb] = useState<number>(14);

  // Subtitle Generation State
  const [generatingSubtitles, setGeneratingSubtitles] = useState<boolean>(false);
  const [subtitleResult, setSubtitleResult] = useState<any>(null);

  // Lip Sync State
  const [lipSyncingSceneId, setLipSyncingSceneId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

  // Handle Subtitle Generation
  const handleGenerateSubtitles = async () => {
    try {
      setGeneratingSubtitles(true);
      const res = await fetch(`/api/projects/${projectId}/subtitles/generate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setSubtitleResult(data);
        if (onRefresh) onRefresh();
      } else {
        alert(data.error || 'Failed to generate subtitles');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGeneratingSubtitles(false);
    }
  };

  // Handle Lip Sync
  const handleRunLipSync = async (scene: any) => {
    const videoAsset = scene.assetVersions?.find(
      (a: any) => a.isActive && a.assetType === 'VIDEO'
    ) || scene.assetVersions?.find((a: any) => a.assetType === 'VIDEO');

    const audioAsset = scene.assetVersions?.find(
      (a: any) => a.isActive && (a.assetType === 'DIALOGUE' || a.assetType === 'NARRATION')
    ) || scene.assetVersions?.find(
      (a: any) => a.assetType === 'DIALOGUE' || a.assetType === 'NARRATION'
    );

    if (!videoAsset) {
      alert('This scene does not have a generated video shot yet. Please generate a video in Image → Video Studio first.');
      return;
    }
    if (!audioAsset) {
      alert('This scene does not have an audio take yet. Please generate narration or dialogue in Hindi Voice Lab first.');
      return;
    }

    try {
      setLipSyncingSceneId(scene.id);
      const res = await fetch(`/api/projects/${projectId}/lipsync/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: scene.id,
          videoAssetId: videoAsset.id,
          audioAssetId: audioAsset.id,
          provider: 'SYNCLABS',
          modelId: 'sync-1.6.0',
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('Lip sync completed successfully!');
        if (onRefresh) onRefresh();
      } else {
        alert(data.error || 'Lip sync failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLipSyncingSceneId(null);
    }
  };

  const handleRunLipSyncAll = async () => {
    const eligibleScenes = project?.scenes?.filter((scene: any) => {
      const hasVideo = scene.assetVersions?.some((a: any) => a.assetType === 'VIDEO');
      const hasAudio = scene.assetVersions?.some(
        (a: any) => a.assetType === 'DIALOGUE' || a.assetType === 'NARRATION'
      );
      const hasLipSync = scene.assetVersions?.some((a: any) => a.assetType === 'LIPSYNC');
      return hasVideo && hasAudio && !hasLipSync;
    }) || [];

    if (eligibleScenes.length === 0) {
      alert('No eligible scenes found for lip sync (requires video + audio, and not already synced).');
      return;
    }

    const confirm = window.confirm(`This will queue lip sync for ${eligibleScenes.length} scene(s). Continue?`);
    if (!confirm) return;

    setIsSyncingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const scene of eligibleScenes) {
      setLipSyncingSceneId(scene.id);

      const videoAsset = scene.assetVersions?.find(
        (a: any) => a.isActive && a.assetType === 'VIDEO'
      ) || scene.assetVersions?.find((a: any) => a.assetType === 'VIDEO');

      const audioAsset = scene.assetVersions?.find(
        (a: any) => a.isActive && (a.assetType === 'DIALOGUE' || a.assetType === 'NARRATION')
      ) || scene.assetVersions?.find(
        (a: any) => a.assetType === 'DIALOGUE' || a.assetType === 'NARRATION'
      );

      try {
        const res = await fetch(`/api/projects/${projectId}/lipsync/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneId: scene.id,
            videoAssetId: videoAsset.id,
            audioAssetId: audioAsset.id,
            provider: 'SYNCLABS',
            modelId: 'sync-1.6.0',
          }),
        });

        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          console.error('Lip sync failed for scene', scene.id, data.error);
          failCount++;
        }
      } catch (e: any) {
        console.error('Lip sync error for scene', scene.id, e.message);
        failCount++;
      }
    }

    setLipSyncingSceneId(null);
    setIsSyncingAll(false);

    alert(`Batch Lip Sync complete! Success: ${successCount}, Failed: ${failCount}`);
    if (onRefresh && successCount > 0) onRefresh();
  };

  return (
    <div className="space-y-6 font-sans">
      {/* SECTION 1: 5-STEM SOUND DESIGN MIXER */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              5-Stem Cinematic Sound Mixer
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic track balancing with automatic sidechain music ducking during speech.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-300 font-semibold flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <input
                type="checkbox"
                checked={autoDucking}
                onChange={(e) => setAutoDucking(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>Sidechain Music Ducking</span>
            </label>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {/* Stem 1: Narration */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
              <span className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                Narration
              </span>
              <span className="font-mono">{narrationVol}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              value={narrationVol}
              onChange={(e) => setNarrationVol(Number(e.target.value))}
              className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block text-right font-mono">0.0 dB</span>
          </div>

          {/* Stem 2: Dialogue */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                Dialogue
              </span>
              <span className="font-mono">{dialogueVol}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              value={dialogueVol}
              onChange={(e) => setDialogueVol(Number(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block text-right font-mono">0.0 dB</span>
          </div>

          {/* Stem 3: Ambience */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
              <span className="flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                Ambience
              </span>
              <span className="font-mono">{ambienceVol}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={ambienceVol}
              onChange={(e) => setAmbienceVol(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block text-right font-mono">-16 dB</span>
          </div>

          {/* Stem 4: SFX */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                Sound FX
              </span>
              <span className="font-mono">{sfxVol}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVol}
              onChange={(e) => setSfxVol(Number(e.target.value))}
              className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block text-right font-mono">-6 dB</span>
          </div>

          {/* Stem 5: Music */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
              <span className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-rose-400" />
                Music Score
              </span>
              <span className="font-mono">{musicVol}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVol}
              onChange={(e) => setMusicVol(Number(e.target.value))}
              className="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block text-right font-mono">
              {autoDucking ? `Ducking -${duckingDb}dB` : '-12 dB'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: LIP SYNC CONSOLE */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-cyan-400" />
              Scene Lip Sync (SyncLabs)
            </h3>
            <p className="text-xs text-slate-400">
              Synchronize animated character facial videos with generated Hindi dialogue audio.
            </p>
          </div>
          <button
            onClick={handleRunLipSyncAll}
            disabled={isSyncingAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors disabled:opacity-50 shrink-0"
          >
            {isSyncingAll ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Syncing All...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Lip Sync All
              </>
            )}
          </button>
        </div>

        <div className="divide-y divide-slate-800/80">
          {project?.scenes?.map((scene: any) => {
            const hasVideo = scene.assetVersions?.some((a: any) => a.assetType === 'VIDEO');
            const hasAudio = scene.assetVersions?.some(
              (a: any) => a.assetType === 'DIALOGUE' || a.assetType === 'NARRATION'
            );
            const hasLipSync = scene.assetVersions?.some((a: any) => a.assetType === 'LIPSYNC');
            const isSyncing = lipSyncingSceneId === scene.id;

            return (
              <div key={scene.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      SHOT #{scene.sceneNumber}
                    </span>
                    <span className="text-xs font-semibold text-white">{scene.title}</span>
                    {hasLipSync && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Lip Synced
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1 italic">
                    {scene.narrationHindi || scene.dialogueHindi || scene.summary}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRunLipSync(scene)}
                    disabled={!hasVideo || !hasAudio || isSyncing || isSyncingAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-40"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Syncing Lips...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Run Lip Sync
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: DEVANAGARI SUBTITLE GENERATOR & PREVIEW */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Devanagari Subtitle Generator (.SRT / .VTT)
            </h3>
            <p className="text-xs text-slate-400">
              Generates compliant SubRip (.srt) and WebVTT (.vtt) files formatted for YouTube and video players.
            </p>
          </div>

          <button
            onClick={handleGenerateSubtitles}
            disabled={generatingSubtitles}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {generatingSubtitles ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Subtitles
              </>
            )}
          </button>
        </div>

        {subtitleResult && (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Generated {subtitleResult.cuesCount} Subtitle Cues
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Saved to disk (.srt & .vtt)
              </span>
            </div>

            {/* Subtitle Preview Box */}
            <div className="max-h-48 overflow-y-auto rounded bg-slate-900/80 p-3 font-mono text-[11px] text-amber-200/90 whitespace-pre-wrap leading-relaxed border border-slate-800">
              {subtitleResult.srtContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
