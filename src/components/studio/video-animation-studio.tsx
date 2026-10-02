'use client';

import React, { useState, useEffect } from 'react';
import {
  Film,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Camera,
  Compass,
  Clock,
  Sliders,
  DollarSign,
  Maximize2,
  Upload,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { AVAILABLE_VIDEO_MODELS } from '@/lib/providers/video/models';

interface VideoAnimationStudioProps {
  projectId: string;
  project: any;
  onRefresh?: () => void;
}

const CAMERA_MOVEMENTS = [
  { id: 'LOCKED', label: 'Locked (Tripod)' },
  { id: 'SLOW_DOLLY_IN', label: 'Slow Dolly In (Dramatic)' },
  { id: 'SLOW_DOLLY_OUT', label: 'Slow Dolly Out (Reveal)' },
  { id: 'PAN_LEFT', label: 'Pan Left' },
  { id: 'PAN_RIGHT', label: 'Pan Right' },
  { id: 'TILT_UP', label: 'Tilt Up' },
  { id: 'TILT_DOWN', label: 'Tilt Down' },
  { id: 'ARC_LEFT', label: 'Arc Left (Orbit)' },
  { id: 'TRACKING_FORWARD', label: 'Tracking Forward (Follow)' },
];

const MOTION_PRESETS = [
  { id: 'STATIC_PLUS', label: 'Subtle Breath & Blink' },
  { id: 'VERY_SUBTLE', label: 'Very Subtle (Slow Cinema)' },
  { id: 'NATURAL', label: 'Natural Character Acting' },
  { id: 'MODERATE', label: 'Moderate Dynamics' },
  { id: 'DYNAMIC', label: 'Dynamic Action & Walking' },
];

export function VideoAnimationStudio({ projectId, project, onRefresh }: VideoAnimationStudioProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`active_scene_${projectId}_video`);
      if (saved && project.scenes?.some((s: any) => s.id === saved)) {
        return saved;
      }
    }
    return project.scenes?.[0]?.id || '';
  });

  useEffect(() => {
    if (selectedSceneId) {
      sessionStorage.setItem(`active_scene_${projectId}_video`, selectedSceneId);
    }
  }, [selectedSceneId, projectId]);

  const [selectedModel, setSelectedModel] = useState<string>('kling-v1');
  const [motionPrompt, setMotionPrompt] = useState<string>('');
  const [cameraMove, setCameraMove] = useState<string>('SLOW_DOLLY_IN');
  const [motionPreset, setMotionPreset] = useState<string>('NATURAL');
  const [duration, setDuration] = useState<number>(5);

  // Job & Polling states
  const [activeJobs, setActiveJobs] = useState<Record<string, any>>({});
  const [submittingSceneId, setSubmittingSceneId] = useState<string | null>(null);
  const [reviewingAssetId, setReviewingAssetId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [copiedMotionPrompt, setCopiedMotionPrompt] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const handleGenerateAllMissing = async () => {
    if (!confirm('Are you sure you want to generate videos for ALL scenes missing an active video? This will consume significant API credits.')) return;
    setIsGeneratingAll(true);
    let generatedCount = 0;
    try {
      for (const scene of project.scenes || []) {
        const hasActiveVideo = scene.assetVersions?.some((a: any) => a.assetType === 'VIDEO' && a.isActive);
        if (hasActiveVideo) continue;

        // Find approved image for reference
        const approvedImage = scene.assetVersions?.find((a: any) => a.assetType === 'PRODUCTION_IMAGE' && a.approvalStatus === 'APPROVED' && a.isActive);
        if (!approvedImage) continue; // Skip if no approved image

        const modelMeta = AVAILABLE_VIDEO_MODELS.find((m) => m.id === selectedModel);
        const res = await fetch(`/api/projects/${projectId}/video/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneId: scene.id,
            imageAssetId: approvedImage.id,
            provider: modelMeta?.provider || 'KLING',
            modelId: selectedModel,
            motionPrompt: scene.summary || undefined,
            cameraMovement: scene.cameraMovement || 'SLOW_DOLLY_IN',
            motionPreset: scene.motionPreset || 'NATURAL',
            durationSeconds: 5,
            forceRegeneration: false,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          let errMsg = errText;
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errText;
          } catch {}
          throw new Error(`Scene #${scene.sceneNumber} failed: ${errMsg}`);
        }

        const data = await res.json();
        if (data.success) generatedCount++;
      }

      if (generatedCount > 0) {
        alert(`Successfully submitted ${generatedCount} missing videos to the queue!`);
        onRefresh?.();
      } else {
        alert('All scenes already have active videos or are missing approved reference images.');
      }
    } catch (err: any) {
      alert(`Batch generation error: ${err.message}`);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const selectedScene = project?.scenes?.find((s: any) => s.id === selectedSceneId);

  const handleCopyMotionPrompt = () => {
    if (!selectedScene) return;
    const promptText = `Camera: ${cameraMove.replace(/_/g, ' ')}. Character motion: ${motionPreset.replace(/_/g, ' ')}. ${motionPrompt || selectedScene.summary}. Smooth natural 3D cinematic animation. Keep consistent Indian character face, skin tone, hair, and clothing from the input reference frame.`;
    navigator.clipboard.writeText(promptText);
    setCopiedMotionPrompt(true);
    setTimeout(() => setCopiedMotionPrompt(false), 2500);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedScene) return;

    try {
      setUploadingVideo(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sceneId', selectedScene.id);
      formData.append('assetType', 'VIDEO');
      formData.append('prompt', `Imported ${file.name} from free web video generation`);

      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh?.();
      } else {
        alert(data.error || 'Video upload failed');
      }
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setUploadingVideo(false);
      e.target.value = '';
    }
  };

  // Find the anchor frame for this scene
  const approvedAnchorFrame = selectedScene?.assetVersions?.find(
    (a: any) => a.isActive && (a.assetType === 'PRODUCTION_IMAGE' || a.assetType === 'STORYBOARD')
  ) || selectedScene?.assetVersions?.find(
    (a: any) => a.approvalStatus === 'APPROVED' && (a.assetType === 'PRODUCTION_IMAGE' || a.assetType === 'STORYBOARD')
  );

  // Find generated video versions for this scene
  const videoVersions = selectedScene?.assetVersions?.filter(
    (a: any) => a.assetType === 'VIDEO'
  ) || [];

  // Poll active jobs
  useEffect(() => {
    const jobIds = Object.keys(activeJobs);
    if (jobIds.length === 0) return;

    const interval = setInterval(async () => {
      let hasChanges = false;
      const updated = { ...activeJobs };

      for (const jId of jobIds) {
        try {
          const res = await fetch(`/api/jobs/${jId}/status`);
          const data = await res.json();
          if (data.success && data.job) {
            updated[jId] = data.job;
            if (data.job.status === 'COMPLETED' || data.job.status === 'FAILED') {
              hasChanges = true;
              delete updated[jId];
            }
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }

      setActiveJobs(updated);
      if (hasChanges && onRefresh) {
        onRefresh?.();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeJobs, onRefresh]);

  // Submit video generation
  const handleGenerateVideo = async () => {
    if (!selectedScene) return;
    if (!approvedAnchorFrame) {
      alert('You must have an approved production frame before generating video.');
      return;
    }

    try {
      setSubmittingSceneId(selectedScene.id);
      const modelMeta = AVAILABLE_VIDEO_MODELS.find((m) => m.id === selectedModel);

      const res = await fetch(`/api/projects/${projectId}/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: selectedScene.id,
          imageAssetId: approvedAnchorFrame.id,
          provider: modelMeta?.provider || 'KLING',
          modelId: selectedModel,
          motionPrompt: motionPrompt || undefined,
          cameraMovement: cameraMove,
          motionPreset: motionPreset,
          durationSeconds: duration,
          forceRegeneration: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.job) {
        setActiveJobs((prev) => ({ ...prev, [data.job.id]: data.job }));
        if (onRefresh) onRefresh?.();
      } else {
        alert(data.error || 'Failed to submit video generation');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingSceneId(null);
    }
  };

  // Approve video take
  const handleApproveVideo = async (assetId: string) => {
    try {
      setActionLoading(assetId);
      const res = await fetch(`/api/projects/${projectId}/assets/${assetId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', makeActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh?.();
      } else {
        alert(data.error || 'Approval failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Film className="w-6 h-6 text-amber-400" />
            Image-to-Video Animation Studio
          </h2>
          <p className="text-xs text-slate-400">
            Turn approved production frames into cinematic 3-8 second video shots using Kling & Seedance.
          </p>
        </div>
        <button
          onClick={handleGenerateAllMissing}
          disabled={isGeneratingAll}
          className="text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {isGeneratingAll ? 'Submitting to Queue...' : 'Gen All Missing Videos'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Scene Selector Pill Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 max-w-xl">
          {project?.scenes?.map((scene: any) => {
            const isSelected = scene.id === selectedSceneId;
            const hasVideo = scene.assetVersions?.some((a: any) => a.assetType === 'VIDEO');

            return (
              <button
                key={scene.id}
                onClick={() => setSelectedSceneId(scene.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>#{scene.sceneNumber}</span>
                {hasVideo && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {selectedScene && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: THE ANCHOR FRAME & MOTION SETTINGS (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Anchor Frame Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  Anchor Production Frame
                </span>
                {approvedAnchorFrame ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Approved Frame
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    No Approved Frame
                  </span>
                )}
              </div>

              {approvedAnchorFrame ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-950 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/media/${approvedAnchorFrame.filePath}`}
                    alt="Anchor frame"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-medium truncate">{selectedScene.title}</span>
                    <a
                      href={`/api/media/${approvedAnchorFrame.filePath}`}
                      download={`scene_${selectedScene.sceneNumber}_anchor.png`}
                      title="Download image to upload into Kling or Hailuo Web"
                      className="px-2 py-1 rounded bg-slate-900/90 hover:bg-slate-800 text-[10px] font-bold text-amber-400 border border-amber-500/30 flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Save Frame for Web
                    </a>
                  </div>
                </div>
              ) : (
                <div className="aspect-video rounded-lg border border-dashed border-slate-800 bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500 space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-500/60" />
                  <p>You must generate and approve a production image in the Image Studio first.</p>
                </div>
              )}
            </div>

            {/* Motion Controls Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Motion & Camera Directives
              </h3>

              {/* Free Web Generation Helper Box */}
              <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Free Web Workflow (Kling / Hailuo)
                  </span>
                  <button
                    onClick={handleCopyMotionPrompt}
                    className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-[10px] font-bold text-indigo-300 border border-indigo-500/40 flex items-center gap-1 transition-colors"
                  >
                    {copiedMotionPrompt ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Prompt Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Motion Prompt
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Download the anchor frame above, open any free generator, paste your prompt, then upload the MP4 below:
                </p>

                {/* Free Quota Video Platforms */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <a
                    href="https://klingai.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-[11px] font-bold text-slate-200">Kling AI Web ↗</span>
                    <span className="text-[9px] font-mono text-emerald-400">66 Free/Day</span>
                  </a>

                  <a
                    href="https://hailuoai.video"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-[11px] font-bold text-slate-200">Hailuo AI ↗</span>
                    <span className="text-[9px] font-mono text-emerald-400">Top Motion</span>
                  </a>

                  <a
                    href="https://lumalabs.ai/dream-machine"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-[11px] font-bold text-slate-200">Luma Dream ↗</span>
                    <span className="text-[9px] font-mono text-cyan-400">Free Tier</span>
                  </a>

                  <a
                    href="https://pixverse.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-[11px] font-bold text-slate-200">PixVerse AI ↗</span>
                    <span className="text-[9px] font-mono text-amber-400">Daily Bonus</span>
                  </a>
                </div>

                <label className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-indigo-600/30 border border-indigo-500/50 text-indigo-200 hover:bg-indigo-600/40 transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{uploadingVideo ? 'Uploading Video...' : 'Upload Generated Video (MP4)'}</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    disabled={uploadingVideo}
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Model Choice (API Mode) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-400">Paid API Video Engine:</label>
                  <span className="text-[10px] font-mono text-slate-500">Direct API</span>
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {AVAILABLE_VIDEO_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.costPerSec})
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Movement */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Camera Movement:</label>
                  <select
                    value={cameraMove}
                    onChange={(e) => setCameraMove(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {CAMERA_MOVEMENTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Character Motion:</label>
                  <select
                    value={motionPreset}
                    onChange={(e) => setMotionPreset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {MOTION_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>Shot Duration:</span>
                  <span className="text-amber-400 font-mono">{duration} Seconds</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="8"
                  step="1"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Custom Prompt */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400">
                  Custom Motion Prompt (Optional):
                </label>
                <textarea
                  rows={2}
                  value={motionPrompt}
                  onChange={(e) => setMotionPrompt(e.target.value)}
                  placeholder="e.g. He slowly turns his head, eyes widening with fierce determination..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleGenerateVideo}
                disabled={!approvedAnchorFrame || submittingSceneId === selectedScene.id}
                className="w-full py-2.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {submittingSceneId === selectedScene.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Submitting Video Job...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Animate Shot (Image → Video)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: RENDER TAKES & REVIEW PLAYER (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active Polling Jobs for this scene */}
            {Object.values(activeJobs).some((j: any) => j.sceneId === selectedScene.id) && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    Rendering Shot in Progress...
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    Live Polling
                  </span>
                </div>
                {Object.values(activeJobs)
                  .filter((j: any) => j.sceneId === selectedScene.id)
                  .map((j: any) => (
                    <div key={j.id} className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-300">
                        <span>Provider: {j.provider} ({j.modelId})</span>
                        <span className="font-mono">{Math.round((j.progress || 0.05) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-cyan-500 h-full transition-all duration-500"
                          style={{ width: `${Math.round((j.progress || 0.05) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Video Takes Gallery */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  Generated Video Takes ({videoVersions.length})
                </h3>
                <span className="text-[10px] font-mono text-slate-500">
                  Shot #{selectedScene.sceneNumber}
                </span>
              </div>

              {videoVersions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <Film className="w-8 h-8 mx-auto text-slate-700" />
                  <p>No video takes generated yet for this shot.</p>
                  <p className="text-[11px] text-slate-600">
                    Click &quot;Animate Shot&quot; on the left to start the first motion pass.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {videoVersions.map((take: any) => {
                    const isApproved = take.approvalStatus === 'APPROVED';
                    const isReviewing = actionLoading === take.id;

                    return (
                      <div
                        key={take.id}
                        className={`rounded-xl border p-4 space-y-3 ${
                          isApproved
                            ? 'border-emerald-500/60 bg-emerald-500/5'
                            : 'border-slate-800 bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {take.provider} — {take.modelId}
                            </span>
                            {isApproved && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Approved Production Video
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {take.duration || 5}s
                          </span>
                        </div>

                        {/* Video Player */}
                        <div className="aspect-video rounded-lg overflow-hidden bg-black border border-slate-800">
                          <video
                            src={`/api/media/${take.filePath}`}
                            controls
                            className="w-full h-full object-contain"
                          />
                        </div>

                        {/* Actions Strip */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                            &quot;{take.prompt}&quot;
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            {!isApproved && (
                              <button
                                onClick={() => handleApproveVideo(take.id)}
                                disabled={isReviewing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve Shot
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
          </div>
        </div>
      )}
    </div>
  );
}
