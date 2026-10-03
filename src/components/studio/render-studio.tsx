'use client';

import React, { useState } from 'react';
import {
  Film,
  Download,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Monitor,
  Smartphone,
  Youtube,
  Tv,
} from 'lucide-react';

interface RenderStudioProps {
  projectId: string;
  project: any;
  onRefresh?: () => void;
}

const PRESETS = [
  { id: 'YOUTUBE_1080', label: 'YouTube 1080p', desc: '1920x1080, 16:9, 30fps', icon: Youtube, color: 'text-red-400' },
  { id: 'YOUTUBE_4K', label: 'Cinematic 4K', desc: '3840x2160, 16:9, 30fps', icon: Tv, color: 'text-amber-400' },
  { id: 'SHORTS_1080', label: 'Vertical / Shorts', desc: '1080x1920, 9:16, 30fps', icon: Smartphone, color: 'text-emerald-400' },
  { id: 'PREVIEW', label: 'Fast Preview', desc: '854x480, 16:9, 24fps', icon: Monitor, color: 'text-slate-400' },
];

export function RenderStudio({ projectId, project, onRefresh }: RenderStudioProps) {
  const [selectedPreset, setSelectedPreset] = useState('YOUTUBE_1080');
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<string | null>(null);

  const handleRender = async () => {
    try {
      setRendering(true);
      setRenderResult(null);

      const res = await fetch(`/api/projects/${projectId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: selectedPreset,
          burnSubtitles,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRenderResult(data.filePath);
        if (onRefresh) onRefresh();
      } else {
        alert(data.error || 'Render failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRendering(false);
    }
  };

  const renders = [
    ...(project?.assetVersions || []),
    ...(project?.scenes || []).flatMap((scene: any) => scene.assetVersions || []),
  ].filter((asset: any, index: number, all: any[]) =>
    asset.assetType === 'RENDER' && all.findIndex((candidate) => candidate.id === asset.id) === index
  );

  const qualityWarnings = (project?.scenes || []).flatMap((scene: any) => {
    const assets = scene.assetVersions || [];
    const speech = assets.find((asset: any) =>
      asset.isActive && (asset.assetType === 'NARRATION' || asset.assetType === 'DIALOGUE')
    );
    const visual = assets.find((asset: any) => asset.isActive && asset.assetType === 'LIPSYNC') ||
      assets.find((asset: any) => asset.isActive && asset.assetType === 'VIDEO');
    const text = scene.dialogueHindi || scene.narrationHindi || '';
    const wordsPerMinute = speech?.duration && text.trim()
      ? Math.round((text.trim().split(/\s+/).length * 60) / speech.duration)
      : null;
    const warnings: string[] = [];

    if (wordsPerMinute && wordsPerMinute > 180) {
      warnings.push(`Scene ${scene.sceneNumber}: narration is ${wordsPerMinute} WPM; aim for 140–170 WPM for a relaxed Hindi storyteller.`);
    }
    if (visual?.duration && speech?.duration && visual.duration + 0.2 < speech.duration) {
      warnings.push(`Scene ${scene.sceneNumber}: the ${visual.assetType.toLowerCase()} take is ${visual.duration.toFixed(1)}s for ${speech.duration.toFixed(1)}s of speech.`);
    }
    return warnings;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Render Settings */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`rounded-xl border p-5 space-y-3 ${
            qualityWarnings.length
              ? 'border-amber-500/30 bg-amber-950/15'
              : 'border-emerald-500/30 bg-emerald-950/15'
          }`}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {qualityWarnings.length ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              Automated Quality Gate
            </h3>
            {qualityWarnings.length ? (
              <>
                <p className="text-xs text-amber-100/80">
                  {qualityWarnings.length} pacing or sync check{qualityWarnings.length === 1 ? '' : 's'} need attention before client delivery.
                </p>
                <ul className="space-y-1.5 text-[11px] leading-relaxed text-amber-200/90">
                  {qualityWarnings.slice(0, 4).map((warning: string) => <li key={warning}>• {warning}</li>)}
                  {qualityWarnings.length > 4 && <li>• +{qualityWarnings.length - 4} more checks</li>}
                </ul>
              </>
            ) : (
              <p className="text-xs text-emerald-100/80">
                Media timing and speech pace pass the local preflight checks.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              Export Settings
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic FFmpeg assembly. Normalizes frame rates, resolutions, and multi-track audio.
            </p>

            <div className="space-y-3 pt-2">
              <label className="text-[11px] font-semibold text-slate-400">Output Preset:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset.id)}
                      className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/50 shadow-sm'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-200">
                        <Icon className={`w-3.5 h-3.5 ${preset.color}`} />
                        {preset.label}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                <input
                  type="checkbox"
                  checked={burnSubtitles}
                  onChange={(e) => setBurnSubtitles(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-300">Burn Devanagari Subtitles</span>
                  <span className="text-[10px] text-slate-500">Hardcodes .srt over the video track</span>
                </div>
              </label>
            </div>

            <button
              onClick={handleRender}
              disabled={rendering || !project?.scenes?.length}
              className="w-full py-3 mt-4 rounded-lg text-sm font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {rendering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Rendering Master...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  Start Export
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Output Viewer */}
        <div className="lg:col-span-7 space-y-6">
          {renderResult ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Render Complete
                </h3>
                <a
                  href={`/api/media/${renderResult}`}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </div>
              <div className="aspect-video rounded-lg overflow-hidden bg-black border border-slate-800 shadow-xl">
                <video
                  src={`/api/media/${renderResult}`}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-amber-400" />
                Previous Exports
              </h3>

              {renders.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <Monitor className="w-8 h-8 mx-auto text-slate-700" />
                  <p>No exports found for this project.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {renders.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">{r.prompt}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <a
                        href={`/api/media/${r.filePath}`}
                        download
                        className="text-cyan-400 hover:text-cyan-300 p-2"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
