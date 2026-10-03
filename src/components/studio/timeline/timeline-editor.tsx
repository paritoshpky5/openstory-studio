'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { TimelineComposition, TimelineClip } from '@/types/timeline';
import {
  formatTimecode,
  buildSnapPoints,
  resolveTimelineSnap,
  getSnapThresholdInSeconds,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
  SnapPoint,
} from '@/lib/timeline/timeline-math';
import {
  TimelineHistoryManager,
  moveClip,
  trimClip,
  deleteClip,
  toggleTrackMute,
  setClipVolume,
} from '@/lib/timeline/timeline-commands';
import { TimelineRuler } from './timeline-ruler';
import { TimelineTrackRow } from './timeline-track';

interface TimelineEditorProps {
  projectId: string;
  project?: any;
  onTimelineChange?: () => void;
}

type SaveState = 'saved' | 'saving' | 'error';

export function TimelineEditor({
  projectId,
  project,
  onTimelineChange,
}: TimelineEditorProps) {
  void project;
  const [composition, setComposition] = useState<TimelineComposition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const [snapIndicatorTime, setSnapIndicatorTime] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');

  // Undo/Redo manager ref
  const historyRef = useRef<TimelineHistoryManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Active drag/trim tracking
  const activeDragRef = useRef<{
    clip: TimelineClip;
    initialStartTime: number;
    initialDuration: number;
    initialTrimIn: number;
    initialTrimOut: number;
    snapPoints: SnapPoint[];
  } | null>(null);

  // Horizontal scroll synchronization ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update undo/redo availability
  const updateHistoryState = useCallback(() => {
    if (historyRef.current) {
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }, []);

  // Fetch or initialize timeline
  const fetchTimeline = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await fetch(`/api/projects/${projectId}/timeline`);
      if (!res.ok) {
        throw new Error('Failed to load project timeline');
      }
      const data = await res.json();
      if (data.success && data.timeline) {
        setComposition(data.timeline);
        historyRef.current = new TimelineHistoryManager(data.timeline);
        updateHistoryState();
      } else {
        throw new Error(data.error || 'Timeline data missing');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Error loading timeline');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, updateHistoryState]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Debounced auto-save
  const scheduleSave = useCallback(
    (newComp: TimelineComposition) => {
      setSaveState('saving');
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}/timeline`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newComp),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to save timeline edits');
          }

          setSaveState('saved');
          if (onTimelineChange) onTimelineChange();
        } catch (err) {
          console.error('[TimelineEditor] Auto-save error:', err);
          setSaveState('error');
        }
      }, 700);
    },
    [projectId, onTimelineChange]
  );

  // Commit composition update with history tracking
  const commitComposition = useCallback(
    (nextComp: TimelineComposition) => {
      if (!historyRef.current) return;
      historyRef.current.push(nextComp);
      setComposition(nextComp);
      updateHistoryState();
      scheduleSave(nextComp);
    },
    [scheduleSave, updateHistoryState]
  );

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (!historyRef.current || !historyRef.current.canUndo()) return;
    const previous = historyRef.current.undo();
    setComposition(previous);
    updateHistoryState();
    scheduleSave(previous);
  }, [scheduleSave, updateHistoryState]);

  const handleRedo = useCallback(() => {
    if (!historyRef.current || !historyRef.current.canRedo()) return;
    const next = historyRef.current.redo();
    setComposition(next);
    updateHistoryState();
    scheduleSave(next);
  }, [scheduleSave, updateHistoryState]);

  // Reset to default
  const handleResetTimeline = async () => {
    if (
      !confirm(
        'Reset timeline layout to current project assets? Any manual clip movements will be restored to defaults.'
      )
    ) {
      return;
    }

    try {
      setSaveState('saving');
      const res = await fetch(`/api/projects/${projectId}/timeline/reset`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.timeline) {
        setComposition(data.timeline);
        historyRef.current = new TimelineHistoryManager(data.timeline);
        updateHistoryState();
        setSaveState('saved');
        if (onTimelineChange) onTimelineChange();
      } else {
        alert(data.error || 'Failed to reset timeline');
        setSaveState('error');
      }
    } catch (err: any) {
      alert(err.message || 'Error resetting timeline');
      setSaveState('error');
    }
  };

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying) return;

    let lastTimestamp = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const deltaSec = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      setPlayheadTime((prev) => {
        const next = prev + deltaSec;
        const total = composition?.totalDuration || 10;
        if (next >= total) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, composition?.totalDuration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedClipId &&
        composition
      ) {
        e.preventDefault();
        const updated = deleteClip(composition, { clipId: selectedClipId });
        setSelectedClipId(null);
        commitComposition(updated);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedClipId, composition, commitComposition]);

  // Sync horizontal scrolling between tracks and ruler
  const handleScroll = () => {
    if (scrollContainerRef.current && rulerScrollRef.current) {
      rulerScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    }
  };

  // Zoom helpers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(MAX_TIMELINE_ZOOM, z * 1.25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(MIN_TIMELINE_ZOOM, z / 1.25));
  const handleFitToView = () => {
    if (!scrollContainerRef.current || !composition) return;
    const viewWidth = scrollContainerRef.current.clientWidth - 240;
    if (viewWidth > 0 && composition.totalDuration > 0) {
      const neededZoom = viewWidth / (composition.totalDuration * 60);
      setZoomLevel(Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, neededZoom)));
    }
  };

  // Clip Drag handlers
  const handleClipDragStart = (clip: TimelineClip) => {
    if (!composition) return;
    const snapPoints = buildSnapPoints({
      tracks: composition.tracks,
      playheadTime,
      excludeClipId: clip.id,
    });

    activeDragRef.current = {
      clip,
      initialStartTime: clip.startTime,
      initialDuration: clip.duration,
      initialTrimIn: clip.trimIn || 0,
      initialTrimOut: clip.trimOut || 0,
      snapPoints,
    };
  };

  const handleClipDragUpdate = (clipId: string, deltaSeconds: number) => {
    if (!activeDragRef.current || !composition) return;
    const { initialStartTime, snapPoints } = activeDragRef.current;
    const rawTarget = Math.max(0, initialStartTime + deltaSeconds);

    const threshold = getSnapThresholdInSeconds({ zoomLevel });
    const snapResult = resolveTimelineSnap({
      targetTime: rawTarget,
      snapPoints,
      maxSnapDistance: threshold,
    });

    const resolvedTime = snapResult.snappedTime;
    setSnapIndicatorTime(snapResult.snapPoint ? snapResult.snappedTime : null);

    // Apply transient move
    const updated = moveClip(composition, {
      clipId,
      newStartTime: resolvedTime,
    });
    setComposition(updated);
  };

  const handleClipDragCommit = (clipId: string, deltaSeconds: number) => {
    setSnapIndicatorTime(null);
    if (!activeDragRef.current || !composition) return;
    const { initialStartTime, snapPoints } = activeDragRef.current;
    const rawTarget = Math.max(0, initialStartTime + deltaSeconds);

    const threshold = getSnapThresholdInSeconds({ zoomLevel });
    const snapResult = resolveTimelineSnap({
      targetTime: rawTarget,
      snapPoints,
      maxSnapDistance: threshold,
    });

    const resolvedTime = snapResult.snappedTime;
    activeDragRef.current = null;

    const updated = moveClip(composition, {
      clipId,
      newStartTime: resolvedTime,
    });
    commitComposition(updated);
  };

  // Clip Trim handlers
  const handleClipTrimStart = (
    clip: TimelineClip,
    _edge: 'left' | 'right'
  ) => {
    void _edge;
    if (!composition) return;
    const snapPoints = buildSnapPoints({
      tracks: composition.tracks,
      playheadTime,
      excludeClipId: clip.id,
    });

    activeDragRef.current = {
      clip,
      initialStartTime: clip.startTime,
      initialDuration: clip.duration,
      initialTrimIn: clip.trimIn || 0,
      initialTrimOut: clip.trimOut || 0,
      snapPoints,
    };
  };

  const handleClipTrimUpdate = (
    clipId: string,
    edge: 'left' | 'right',
    deltaSeconds: number
  ) => {
    if (!activeDragRef.current || !composition) return;
    const { initialStartTime, initialDuration, initialTrimIn, initialTrimOut, snapPoints } =
      activeDragRef.current;
    const threshold = getSnapThresholdInSeconds({ zoomLevel });

    if (edge === 'left') {
      const rawNewStart = Math.max(0, initialStartTime + deltaSeconds);
      const snapResult = resolveTimelineSnap({
        targetTime: rawNewStart,
        snapPoints,
        maxSnapDistance: threshold,
      });

      const effectiveDelta = snapResult.snappedTime - initialStartTime;
      const newDuration = Math.max(0.2, initialDuration - effectiveDelta);
      const newTrimIn = Math.max(0, initialTrimIn + effectiveDelta);

      setSnapIndicatorTime(snapResult.snapPoint ? snapResult.snappedTime : null);

      const updated = trimClip(composition, {
        clipId,
        newStartTime: snapResult.snappedTime,
        newDuration,
        newTrimIn,
        newTrimOut: initialTrimOut,
      });
      setComposition(updated);
    } else {
      const rawNewEnd = initialStartTime + initialDuration + deltaSeconds;
      const snapResult = resolveTimelineSnap({
        targetTime: rawNewEnd,
        snapPoints,
        maxSnapDistance: threshold,
      });

      const newDuration = Math.max(0.2, snapResult.snappedTime - initialStartTime);
      setSnapIndicatorTime(snapResult.snapPoint ? snapResult.snappedTime : null);

      const updated = trimClip(composition, {
        clipId,
        newStartTime: initialStartTime,
        newDuration,
        newTrimIn: initialTrimIn,
        newTrimOut: Math.max(0, initialTrimOut - deltaSeconds),
      });
      setComposition(updated);
    }
  };

  const handleClipTrimCommit = (
    clipId: string,
    edge: 'left' | 'right',
    deltaSeconds: number
  ) => {
    setSnapIndicatorTime(null);
    if (!activeDragRef.current || !composition) return;
    const { initialStartTime, initialDuration, initialTrimIn, initialTrimOut, snapPoints } =
      activeDragRef.current;
    const threshold = getSnapThresholdInSeconds({ zoomLevel });

    let finalStart = initialStartTime;
    let finalDuration = initialDuration;
    let finalTrimIn = initialTrimIn;
    let finalTrimOut = initialTrimOut;

    if (edge === 'left') {
      const rawNewStart = Math.max(0, initialStartTime + deltaSeconds);
      const snapResult = resolveTimelineSnap({
        targetTime: rawNewStart,
        snapPoints,
        maxSnapDistance: threshold,
      });
      const effectiveDelta = snapResult.snappedTime - initialStartTime;
      finalStart = snapResult.snappedTime;
      finalDuration = Math.max(0.2, initialDuration - effectiveDelta);
      finalTrimIn = Math.max(0, initialTrimIn + effectiveDelta);
    } else {
      const rawNewEnd = initialStartTime + initialDuration + deltaSeconds;
      const snapResult = resolveTimelineSnap({
        targetTime: rawNewEnd,
        snapPoints,
        maxSnapDistance: threshold,
      });
      finalDuration = Math.max(0.2, snapResult.snappedTime - initialStartTime);
      finalTrimOut = Math.max(0, initialTrimOut - deltaSeconds);
    }

    activeDragRef.current = null;

    const updated = trimClip(composition, {
      clipId,
      newStartTime: finalStart,
      newDuration: finalDuration,
      newTrimIn: finalTrimIn,
      newTrimOut: finalTrimOut,
    });
    commitComposition(updated);
  };

  const handleToggleMute = (trackId: string) => {
    if (!composition) return;
    const updated = toggleTrackMute(composition, { trackId });
    commitComposition(updated);
  };

  // Find currently selected clip object
  let selectedClip: TimelineClip | null = null;
  if (selectedClipId && composition) {
    for (const track of composition.tracks) {
      const found = track.clips.find((c) => c.id === selectedClipId);
      if (found) {
        selectedClip = found;
        break;
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
        <span className="text-xs text-slate-400">Loading timeline composition...</span>
      </div>
    );
  }

  if (loadError || !composition) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 border border-red-500/30 rounded-xl space-y-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <span className="text-sm font-semibold text-red-200">{loadError || 'Failed to load timeline'}</span>
        <button
          onClick={fetchTimeline}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const totalDuration = composition.totalDuration || 5.0;

  return (
    <div className="space-y-3">
      {/* TOP CONTROL TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl shadow-inner">
        {/* Playback & Transport */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className={`p-2 rounded-lg font-bold transition-colors flex items-center justify-center ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Timecode display */}
          <div className="flex items-center font-mono text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
            <span className="text-cyan-400 font-bold">{formatTimecode(playheadTime)}</span>
            <span className="text-slate-500 mx-1.5">/</span>
            <span className="text-slate-400">{formatTimecode(totalDuration)}</span>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={MIN_TIMELINE_ZOOM}
            max={MAX_TIMELINE_ZOOM}
            step={0.1}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="w-24 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
          />

          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleFitToView}
            title="Fit to Screen"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Save Status & Actions */}
        <div className="flex items-center gap-3">
          {saveState === 'saving' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {saveState === 'saved' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Saved</span>
            </div>
          )}
          {saveState === 'error' && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Save error</span>
            </div>
          )}

          <button
            onClick={handleResetTimeline}
            title="Rebuild timeline from project scenes & assets"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            Reset Layout
          </button>
        </div>
      </div>

      {/* SELECTED CLIP INSPECTOR PANEL */}
      {selectedClip && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-900/90 border border-cyan-500/30 rounded-xl text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Selected Clip:
            </span>
            <input
              type="text"
              value={selectedClip.label}
              onChange={(e) => {
                const nextComp = JSON.parse(JSON.stringify(composition));
                for (const t of nextComp.tracks) {
                  const c = t.clips.find((clip: any) => clip.id === selectedClip!.id);
                  if (c) {
                    c.label = e.target.value;
                    break;
                  }
                }
                commitComposition(nextComp);
              }}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-medium w-48 text-xs focus:outline-none focus:border-cyan-500"
            />
            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
              <span>Start: <strong className="text-slate-200">{selectedClip.startTime.toFixed(2)}s</strong></span>
              <span>Duration: <strong className="text-slate-200">{selectedClip.duration.toFixed(2)}s</strong></span>
              {selectedClip.trimIn > 0 && (
                <span>Trim In: <strong className="text-amber-300">{selectedClip.trimIn.toFixed(2)}s</strong></span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Clip volume slider */}
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-[11px]">Volume:</span>
              <input
                type="range"
                min={0}
                max={2.0}
                step={0.05}
                value={selectedClip.volume}
                onChange={(e) => {
                  const updated = setClipVolume(composition, {
                    clipId: selectedClip!.id,
                    volume: parseFloat(e.target.value),
                  });
                  commitComposition(updated);
                }}
                className="w-20 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
              />
              <span className="font-mono text-[11px] w-9">
                {Math.round(selectedClip.volume * 100)}%
              </span>
            </div>

            <button
              onClick={() => {
                const updated = deleteClip(composition, { clipId: selectedClip!.id });
                setSelectedClipId(null);
                commitComposition(updated);
              }}
              className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
              title="Delete Clip (Delete/Backspace)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MULTI-TRACK TIMELINE CONTAINER */}
      <div className="border border-slate-800 rounded-xl bg-slate-950 overflow-hidden shadow-2xl">
        {/* Synchronized Ruler Header */}
        <div className="flex border-b border-slate-800 bg-slate-950">
          <div className="w-52 shrink-0 border-r border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>TRACKS</span>
            <span className="text-[10px] font-mono text-slate-600">{composition.tracks.length} Tracks</span>
          </div>
          <div
            ref={rulerScrollRef}
            className="flex-1 overflow-x-hidden pointer-events-auto"
          >
            <TimelineRuler
              totalDuration={totalDuration}
              playheadTime={playheadTime}
              zoomLevel={zoomLevel}
              fps={composition.fps}
              onSeek={setPlayheadTime}
              snapIndicatorTime={snapIndicatorTime}
            />
          </div>
        </div>

        {/* Scrollable Track Rows */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="max-h-[460px] overflow-x-auto overflow-y-auto"
        >
          {composition.tracks.map((track) => (
            <TimelineTrackRow
              key={track.id}
              track={track}
              zoomLevel={zoomLevel}
              totalDuration={totalDuration}
              selectedClipId={selectedClipId}
              playheadTime={playheadTime}
              snapIndicatorTime={snapIndicatorTime}
              onSelectClip={setSelectedClipId}
              onToggleMute={handleToggleMute}
              onDragStart={handleClipDragStart}
              onDragUpdate={handleClipDragUpdate}
              onDragCommit={handleClipDragCommit}
              onTrimStart={handleClipTrimStart}
              onTrimUpdate={handleClipTrimUpdate}
              onTrimCommit={handleClipTrimCommit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
