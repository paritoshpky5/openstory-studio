'use client';

import React from 'react';
import {
  Film,
  Mic,
  Volume2,
  Wind,
  Zap,
  Music,
  Subtitles,
  VolumeX,
} from 'lucide-react';
import { TimelineTrack as TimelineTrackType, TimelineClip } from '@/types/timeline';
import { TimelineClipView } from './timeline-clip-view';
import { timeToPixels } from '@/lib/timeline/timeline-math';

interface TimelineTrackProps {
  track: TimelineTrackType;
  zoomLevel: number;
  totalDuration: number;
  selectedClipId: string | null;
  playheadTime: number;
  snapIndicatorTime: number | null;
  onSelectClip: (clipId: string) => void;
  onToggleMute: (trackId: string) => void;
  onDragStart?: (clip: TimelineClip, startClientX: number) => void;
  onDragUpdate?: (clipId: string, deltaSeconds: number) => void;
  onDragCommit?: (clipId: string, deltaSeconds: number) => void;
  onTrimStart?: (clip: TimelineClip, edge: 'left' | 'right', startClientX: number) => void;
  onTrimUpdate?: (clipId: string, edge: 'left' | 'right', deltaSeconds: number) => void;
  onTrimCommit?: (clipId: string, edge: 'left' | 'right', deltaSeconds: number) => void;
}

const TRACK_ICONS = {
  VIDEO: Film,
  NARRATION: Mic,
  DIALOGUE: Volume2,
  AMBIENCE: Wind,
  SFX: Zap,
  MUSIC: Music,
  SUBTITLE: Subtitles,
};

export function TimelineTrackRow({
  track,
  zoomLevel,
  totalDuration,
  selectedClipId,
  playheadTime,
  snapIndicatorTime,
  onSelectClip,
  onToggleMute,
  onDragStart,
  onDragUpdate,
  onDragCommit,
  onTrimStart,
  onTrimUpdate,
  onTrimCommit,
}: TimelineTrackProps) {
  const Icon = TRACK_ICONS[track.type] || Film;
  const laneWidth = Math.max(1200, timeToPixels(totalDuration + 5, zoomLevel));
  const playheadPx = timeToPixels(playheadTime, zoomLevel);
  const snapPx = snapIndicatorTime != null ? timeToPixels(snapIndicatorTime, zoomLevel) : null;

  return (
    <div className="flex h-14 border-b border-slate-800/80 bg-slate-950/40 hover:bg-slate-900/30 transition-colors">
      {/* Left Track Header */}
      <div className="w-52 shrink-0 border-r border-slate-800 bg-slate-950 px-3 py-2 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1.5 rounded ${
              track.muted
                ? 'bg-slate-800 text-slate-500'
                : 'bg-slate-850 text-cyan-400'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-200 block truncate leading-tight">
              {track.name}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {track.clips.length} clip{track.clips.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Mute button */}
        <button
          onClick={() => onToggleMute(track.id)}
          title={track.muted ? 'Unmute Track' : 'Mute Track'}
          className={`p-1.5 rounded transition-colors ${
            track.muted
              ? 'text-red-400 bg-red-950/50 hover:bg-red-900/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          {track.muted ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Right Track Lane */}
      <div
        style={{ width: `${laneWidth}px` }}
        className="relative h-full shrink-0 overflow-hidden select-none"
      >
        {/* Snap Indicator Line */}
        {snapPx !== null && (
          <div
            style={{ left: `${snapPx}px` }}
            className="absolute top-0 bottom-0 w-[2px] bg-amber-400 pointer-events-none z-20 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
          />
        )}

        {/* Playhead Line */}
        <div
          style={{ left: `${playheadPx}px` }}
          className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 pointer-events-none z-30"
        />

        {/* Clips */}
        {track.clips.map((clip) => (
          <TimelineClipView
            key={clip.id}
            clip={clip}
            trackType={track.type}
            trackMuted={track.muted}
            zoomLevel={zoomLevel}
            isSelected={selectedClipId === clip.id}
            onSelect={onSelectClip}
            onDragStart={onDragStart}
            onDragUpdate={onDragUpdate}
            onDragCommit={onDragCommit}
            onTrimStart={onTrimStart}
            onTrimUpdate={onTrimUpdate}
            onTrimCommit={onTrimCommit}
          />
        ))}
      </div>
    </div>
  );
}
