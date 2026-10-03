'use client';

import React, { useRef } from 'react';
import {
  Film,
  Volume2,
  Mic,
  Music,
  Wind,
  Zap,
  Subtitles,
  VolumeX,
} from 'lucide-react';
import { TimelineClip, TrackType } from '@/types/timeline';
import { timeToPixels, pixelsToTime, BASE_TIMELINE_PIXELS_PER_SECOND } from '@/lib/timeline/timeline-math';
import { AudioWaveform } from './audio-waveform';

interface TimelineClipViewProps {
  clip: TimelineClip;
  trackType: TrackType;
  trackMuted: boolean;
  zoomLevel: number;
  isSelected: boolean;
  onSelect: (clipId: string) => void;
  onDragStart?: (clip: TimelineClip, startClientX: number) => void;
  onDragUpdate?: (clipId: string, deltaSeconds: number) => void;
  onDragCommit?: (clipId: string, deltaSeconds: number) => void;
  onTrimStart?: (clip: TimelineClip, edge: 'left' | 'right', startClientX: number) => void;
  onTrimUpdate?: (clipId: string, edge: 'left' | 'right', deltaSeconds: number) => void;
  onTrimCommit?: (clipId: string, edge: 'left' | 'right', deltaSeconds: number) => void;
}

const TRACK_STYLES: Record<
  TrackType,
  { bg: string; border: string; text: string; waveformColor: string; icon: any }
> = {
  VIDEO: {
    bg: 'bg-cyan-950/70 hover:bg-cyan-900/80',
    border: 'border-cyan-500/40',
    text: 'text-cyan-200',
    waveformColor: 'rgba(6, 182, 212, 0.4)',
    icon: Film,
  },
  NARRATION: {
    bg: 'bg-amber-950/70 hover:bg-amber-900/80',
    border: 'border-amber-500/40',
    text: 'text-amber-200',
    waveformColor: 'rgba(245, 158, 11, 0.5)',
    icon: Mic,
  },
  DIALOGUE: {
    bg: 'bg-indigo-950/70 hover:bg-indigo-900/80',
    border: 'border-indigo-500/40',
    text: 'text-indigo-200',
    waveformColor: 'rgba(99, 102, 241, 0.5)',
    icon: Volume2,
  },
  AMBIENCE: {
    bg: 'bg-emerald-950/70 hover:bg-emerald-900/80',
    border: 'border-emerald-500/40',
    text: 'text-emerald-200',
    waveformColor: 'rgba(16, 185, 129, 0.5)',
    icon: Wind,
  },
  SFX: {
    bg: 'bg-rose-950/70 hover:bg-rose-900/80',
    border: 'border-rose-500/40',
    text: 'text-rose-200',
    waveformColor: 'rgba(244, 63, 94, 0.5)',
    icon: Zap,
  },
  MUSIC: {
    bg: 'bg-violet-950/70 hover:bg-violet-900/80',
    border: 'border-violet-500/40',
    text: 'text-violet-200',
    waveformColor: 'rgba(139, 92, 246, 0.5)',
    icon: Music,
  },
  SUBTITLE: {
    bg: 'bg-yellow-950/70 hover:bg-yellow-900/80',
    border: 'border-yellow-500/40',
    text: 'text-yellow-200',
    waveformColor: 'rgba(234, 179, 8, 0.5)',
    icon: Subtitles,
  },
};

export function TimelineClipView({
  clip,
  trackType,
  trackMuted,
  zoomLevel,
  isSelected,
  onSelect,
  onDragStart,
  onDragUpdate,
  onDragCommit,
  onTrimStart,
  onTrimUpdate,
  onTrimCommit,
}: TimelineClipViewProps) {
  const styleConfig = TRACK_STYLES[trackType] || TRACK_STYLES.VIDEO;
  const Icon = styleConfig.icon;

  const left = timeToPixels(clip.startTime, zoomLevel);
  const width = Math.max(16, timeToPixels(clip.duration, zoomLevel));
  const pixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND * zoomLevel;

  const isAudioTrack =
    trackType === 'NARRATION' ||
    trackType === 'DIALOGUE' ||
    trackType === 'AMBIENCE' ||
    trackType === 'SFX' ||
    trackType === 'MUSIC';

  const pointerStartX = useRef<number>(0);
  const dragType = useRef<'move' | 'trim-left' | 'trim-right' | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect(clip.id);

    pointerStartX.current = e.clientX;
    dragType.current = 'move';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (onDragStart) {
      onDragStart(clip, e.clientX);
    }
  };

  const handleTrimPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    edge: 'left' | 'right'
  ) => {
    e.stopPropagation();
    onSelect(clip.id);

    pointerStartX.current = e.clientX;
    dragType.current = edge === 'left' ? 'trim-left' : 'trim-right';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (onTrimStart) {
      onTrimStart(clip, edge, e.clientX);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragType.current) return;
    const deltaPx = e.clientX - pointerStartX.current;
    const deltaSeconds = pixelsToTime(deltaPx, zoomLevel);

    if (dragType.current === 'move' && onDragUpdate) {
      onDragUpdate(clip.id, deltaSeconds);
    } else if (
      (dragType.current === 'trim-left' || dragType.current === 'trim-right') &&
      onTrimUpdate
    ) {
      onTrimUpdate(
        clip.id,
        dragType.current === 'trim-left' ? 'left' : 'right',
        deltaSeconds
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragType.current) return;
    const deltaPx = e.clientX - pointerStartX.current;
    const deltaSeconds = pixelsToTime(deltaPx, zoomLevel);

    if (dragType.current === 'move' && onDragCommit) {
      onDragCommit(clip.id, deltaSeconds);
    } else if (
      (dragType.current === 'trim-left' || dragType.current === 'trim-right') &&
      onTrimCommit
    ) {
      onTrimCommit(
        clip.id,
        dragType.current === 'trim-left' ? 'left' : 'right',
        deltaSeconds
      );
    }

    dragType.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const isMuted = clip.muted || trackMuted;

  return (
    <div
      style={{
        left: `${left}px`,
        width: `${width}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`group absolute top-1 bottom-1 rounded border select-none cursor-grab active:cursor-grabbing flex flex-col justify-between overflow-hidden transition-shadow ${
        styleConfig.bg
      } ${styleConfig.border} ${
        isSelected ? 'ring-2 ring-cyan-400 shadow-md shadow-cyan-500/20 z-10' : 'z-0'
      } ${isMuted ? 'opacity-40 grayscale' : 'opacity-100'}`}
    >
      {/* Left Trim Handle */}
      <div
        onPointerDown={(e) => handleTrimPointerDown(e, 'left')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Trim Start"
        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/40 active:bg-white/60 z-20 transition-colors"
      >
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/40 rounded" />
      </div>

      {/* Header Info */}
      <div className="flex items-center justify-between px-2 pt-1 pointer-events-none z-10">
        <div className="flex items-center gap-1 min-w-0">
          <Icon className={`w-3 h-3 shrink-0 ${styleConfig.text}`} />
          <span className={`text-[10px] font-bold truncate ${styleConfig.text}`}>
            {clip.label}
          </span>
          {isMuted && <VolumeX className="w-2.5 h-2.5 text-red-400 shrink-0" />}
        </div>
        <span className="text-[9px] font-mono text-slate-400 shrink-0 ml-1">
          {clip.duration.toFixed(1)}s
        </span>
      </div>

      {/* Audio Waveform Visualization */}
      {isAudioTrack && (
        <div className="absolute inset-0 pointer-events-none opacity-80 pt-3">
          <AudioWaveform
            sourceFilePath={clip.sourceFilePath}
            clipDuration={clip.duration}
            trimIn={clip.trimIn}
            color={styleConfig.waveformColor}
            pixelsPerSecond={pixelsPerSecond}
          />
        </div>
      )}

      {/* Subtitle text preview */}
      {trackType === 'SUBTITLE' && clip.metadata?.text && (
        <div className="px-2 pb-1 text-[9px] text-yellow-100/90 truncate pointer-events-none">
          {clip.metadata.text}
        </div>
      )}

      {/* Right Trim Handle */}
      <div
        onPointerDown={(e) => handleTrimPointerDown(e, 'right')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Trim End"
        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/40 active:bg-white/60 z-20 transition-colors"
      >
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/40 rounded" />
      </div>
    </div>
  );
}
