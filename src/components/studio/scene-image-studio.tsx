'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Layers,
  Image as ImageIcon,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Check,
  Upload,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface SceneImageStudioProps {
  projectId: string;
  project: any;
  onRefresh: () => void;
}

export function SceneImageStudio({ projectId, project, onRefresh }: SceneImageStudioProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`active_scene_${projectId}_image`);
      if (saved && project.scenes?.some((s: any) => s.id === saved)) {
        return saved;
      }
    }
    return project.scenes?.[0]?.id || '';
  });

  useEffect(() => {
    if (selectedSceneId) {
      sessionStorage.setItem(`active_scene_${projectId}_image`, selectedSceneId);
    }
  }, [selectedSceneId, projectId]);

  const [assets, setAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showFreeTools, setShowFreeTools] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'FLUX' | 'GEMINI' | 'OPENAI'>('FLUX');
  const [selectedAssetType, setSelectedAssetType] = useState<'STORYBOARD' | 'PRODUCTION_IMAGE'>('PRODUCTION_IMAGE');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const handleGenerateAllMissing = async () => {
    if (!confirm('Are you sure you want to generate images for ALL scenes missing an active image? This will consume API credits.')) return;
    setIsGeneratingAll(true);
    let generatedCount = 0;
    try {
      for (const scene of project.scenes || []) {
        const hasActiveImage = scene.assetVersions?.some((a: any) => a.assetType === selectedAssetType && a.isActive);
        if (hasActiveImage) continue;

        const res = await fetch(`/api/projects/${projectId}/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneId: scene.id, assetType: selectedAssetType, provider: selectedProvider, forceRegeneration: false }),
        });

        if (!res.ok) {
          const errText = await res.text();
          let errMsg = errText;
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errText;
          } catch {}
          throw new Error(`Shot #${scene.sceneNumber} failed: ${errMsg}`);
        }

        const data = await res.json();
        if (data.success) generatedCount++;
      }
      if (generatedCount > 0) {
        alert(`Successfully generated ${generatedCount} missing images!`);
        await fetchAssets();
        onRefresh?.();
      } else {
        alert('All scenes already have images.');
      }
    } catch (err: any) {
      alert(`Batch generation error: ${err.message}`);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const selectedScene = project.scenes?.find((s: any) => s.id === selectedSceneId);

  const fetchAssets = async () => {
    if (!selectedSceneId) return;
    try {
      setLoadingAssets(true);
      const res = await fetch(`/api/projects/${projectId}/assets?sceneId=${selectedSceneId}`);
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets);
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [selectedSceneId]);

  const handleGenerate = async (forceRegeneration: boolean = false) => {
    if (!selectedSceneId) return;
    try {
      setGenerating(true);
      const res = await fetch(`/api/projects/${projectId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: selectedSceneId,
          assetType: selectedAssetType,
          provider: selectedProvider,
          forceRegeneration,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAssets();
        onRefresh?.();
      } else {
        alert(data.error || 'Generation failed');
      }
    } catch (err: any) {
      alert(err.message || 'Generation error');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (assetId: string) => {
    try {
      setActionInProgress(assetId);
      const res = await fetch(`/api/projects/${projectId}/assets/${assetId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', makeActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAssets();
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (assetId: string) => {
    try {
      setActionInProgress(assetId);
      const res = await fetch(`/api/projects/${projectId}/assets/${assetId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          rejectionReasons: ['STYLE_OR_CHARACTER_ADJUSTMENT'],
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAssets();
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCopyPrompt = async () => {
    if (!selectedScene) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/compile-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId: selectedSceneId, provider: selectedProvider, type: 'IMAGE' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Prompt compilation failed');
      const referenceNote = data.compiled.referenceImagePaths?.length
        ? `\n\nREFERENCE IMAGES: Upload the ${data.compiled.referenceImagePaths.length} approved character reference image(s) shown in OpenStory Studio to the web generator.`
        : '';
      const promptText = `${data.compiled.positivePrompt}\n\nNEGATIVE PROMPT: ${data.compiled.negativePrompt}${referenceNote}`;
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch (error: any) {
      alert(error.message || 'Could not copy prompt');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSceneId) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sceneId', selectedSceneId);
      formData.append('assetType', selectedAssetType);
      formData.append('prompt', `Imported ${file.name} from free web generation`);

      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        await fetchAssets();
        onRefresh?.();
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setUploading(false);
      // Reset input value
      e.target.value = '';
    }
  };

  const imageAssets = assets.filter(
    (a) => a.assetType === 'PRODUCTION_IMAGE' || a.assetType === 'STORYBOARD'
  );

  const activeAsset =
    imageAssets.find((a) => a.isActive && a.assetType === selectedAssetType) ||
    imageAssets.find((a) => a.isActive) ||
    imageAssets[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Scene Selector Sidebar */}
      <div className="lg:col-span-1 space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono uppercase text-slate-400 font-bold">
            Select Shot ({project.scenes?.length || 0})
          </h3>
          <button
            onClick={handleGenerateAllMissing}
            disabled={isGeneratingAll}
            className="text-[10px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2 py-1 rounded transition-colors disabled:opacity-50"
          >
            {isGeneratingAll ? 'Generating...' : 'Gen All Missing'}
          </button>
        </div>
        <div className="space-y-1.5 max-h-[700px] overflow-y-auto pr-1">
          {project.scenes?.map((scene: any) => {
            const isSelected = scene.id === selectedSceneId;
            return (
              <button
                key={scene.id}
                onClick={() => setSelectedSceneId(scene.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold">SHOT #{scene.sceneNumber}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      scene.status === 'IMAGE_APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : scene.status === 'PRODUCTION_IMAGE'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : scene.status === 'STORYBOARD_APPROVED'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {scene.status}
                  </span>
                </div>
                <span className="text-xs font-semibold line-clamp-1 text-white">
                  {scene.title}
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  {scene.location} • {scene.durationSeconds}s
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Center */}
      <div className="lg:col-span-3 space-y-6">
        {selectedScene ? (
          <>
            {/* Shot Header & Status */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                    SHOT #{selectedScene.sceneNumber}
                  </span>
                  <h2 className="text-lg font-bold text-white">{selectedScene.title}</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedScene.location} • {selectedScene.timeOfDay} • {selectedScene.lighting}
                </p>
              </div>

              {/* Action Controls Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Mode Picker */}
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                  <button
                    onClick={() => setSelectedAssetType('STORYBOARD')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      selectedAssetType === 'STORYBOARD'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Storyboard
                  </button>
                  <button
                    onClick={() => setSelectedAssetType('PRODUCTION_IMAGE')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      selectedAssetType === 'PRODUCTION_IMAGE'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Production Frame
                  </button>
                </div>

                {/* Provider Picker */}
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="FLUX">FLUX.1 [dev]</option>
                  <option value="GEMINI">Google Imagen 3</option>
                  <option value="OPENAI">OpenAI GPT Image</option>
                </select>

                {/* Copy Prompt for Free Web */}
                <button
                  onClick={handleCopyPrompt}
                  title="Copy compiled prompt to paste into Google ImageFX, Copilot, or SeaArt"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Prompt Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Prompt for Web</span>
                    </>
                  )}
                </button>

                {/* Upload Image (Free Web Import) */}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {/* Free Quota Web Alternatives Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFreeTools(!showFreeTools)}
                    title="Open free quota web image generators"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-amber-300 hover:bg-slate-800 transition-colors"
                  >
                    <span>Free Web Tools ↗</span>
                  </button>

                  {showFreeTools && (
                    <div className="absolute right-0 mt-1 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 space-y-1 font-sans">
                      <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase font-bold border-b border-slate-800">
                        Free Image Generators
                      </div>
                      <a
                        href="https://aitestkitchen.withgoogle.com/tools/image-fx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                      >
                        <span className="font-semibold">Google ImageFX</span>
                        <span className="text-[10px] text-emerald-400 font-mono">100% Free</span>
                      </a>
                      <a
                        href="https://copilot.microsoft.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                      >
                        <span className="font-semibold">Microsoft Copilot</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Free Daily</span>
                      </a>
                      <a
                        href="https://www.seaart.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                      >
                        <span className="font-semibold">SeaArt (Flux.1)</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Daily Credits</span>
                      </a>
                      <a
                        href="https://leonardo.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                      >
                        <span className="font-semibold">Leonardo.ai</span>
                        <span className="text-[10px] text-emerald-400 font-mono">150 Free/day</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Generate Button (API) */}
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Take (API)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active Production Frame Viewport */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden relative group">
              {activeAsset ? (
                <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center">
                  <img
                    src={`/api/media/${activeAsset.filePath}`}
                    alt={selectedScene.title}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-slate-950/80 backdrop-blur border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      ACTIVE APPROVED TAKE
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-950/80 backdrop-blur border border-slate-700 text-[10px] font-mono text-slate-300">
                      {activeAsset.provider} • {activeAsset.modelId}
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-950/80 backdrop-blur border border-slate-700 text-[10px] font-mono text-amber-300">
                      ${activeAsset.actualCost?.toFixed(3) || '0.030'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="aspect-video w-full flex flex-col items-center justify-center p-8 text-center bg-slate-950 border border-dashed border-slate-800 rounded-xl space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="max-w-sm space-y-1">
                    <p className="text-sm font-semibold text-slate-300">No Approved Frame Yet</p>
                    <p className="text-xs text-slate-500">
                      Click &quot;Generate Take&quot; to compile this shot&apos;s style and character traits into a candidate frame.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Takes Gallery Shelf */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Candidate Takes ({imageAssets.length})
                </h3>
                {imageAssets.length > 0 && (
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={generating}
                    className="text-[11px] font-mono text-amber-400 hover:underline flex items-center gap-1"
                  >
                    + Force New Take (Bypass Cache)
                  </button>
                )}
              </div>

              {loadingAssets ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  Loading takes...
                </div>
              ) : imageAssets.length === 0 ? (
                <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800/80 text-center text-xs text-slate-500">
                  No generation takes generated for this shot.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {imageAssets.map((asset) => {
                    const isTakeActive = asset.isActive;
                    const isApproved = asset.approvalStatus === 'APPROVED';
                    const isRejected = asset.approvalStatus === 'REJECTED';

                    return (
                      <div
                        key={asset.id}
                        className={`rounded-lg border p-2.5 space-y-2 bg-slate-900/80 transition-all ${
                          isTakeActive
                            ? 'border-emerald-500/50 ring-1 ring-emerald-500/30'
                            : isRejected
                            ? 'border-red-500/30 opacity-70'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Thumbnail View */}
                        <div className="aspect-video w-full rounded bg-slate-950 overflow-hidden relative border border-slate-800">
                          <img
                            src={`/api/media/${asset.filePath}`}
                            alt="Candidate Take"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1.5 left-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-mono text-slate-300">
                              {asset.assetType}
                            </span>
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>{asset.provider}</span>
                          <span>${asset.actualCost?.toFixed(3) || '0.00'}</span>
                        </div>

                        {/* Status & Actions */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isRejected
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {asset.approvalStatus}
                          </span>

                          <div className="flex items-center gap-1">
                            {!isApproved && (
                              <button
                                onClick={() => handleApprove(asset.id)}
                                disabled={actionInProgress === asset.id}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                              >
                                Approve Take
                              </button>
                            )}

                            {!isRejected && (
                              <button
                                onClick={() => handleReject(asset.id)}
                                disabled={actionInProgress === asset.id}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 transition-colors"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            No scenes available in this project.
          </div>
        )}
      </div>
    </div>
  );
}
