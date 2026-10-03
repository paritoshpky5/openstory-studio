'use client';

import React, { useRef } from 'react';
import {
  timeToPixels,
  pixelsToTime,
  getRulerConfig,
  formatRulerLabel,
} from '@/lib/timeline/timeline-math';

interface TimelineRulerProps {
  totalDuration: number;
  playheadTime: number;
  zoomLevel: number;
  fps?: number;
  onSeek: (timeSeconds: number) => void;
  snapIndicatorTime?: number | null;
}

export function TimelineRuler({
  totalDuration,
  playheadTime,
  zoomLevel,
  fps = 24,
  onSeek,
  snapIndicatorTime,
}: TimelineRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const { labelIntervalSeconds, tickIntervalSeconds } = getRulerConfig({
    zoomLevel,
    fps,
  });

  const totalWidth = Math.max(1200, timeToPixels(totalDuration + 5, zoomLevel));
  const playheadPx = timeToPixels(playheadTime, zoomLevel);
  const snapPx = snapIndicatorTime != null ? timeToPixels(snapIndicatorTime, zoomLevel) : null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekTime = pixelsToTime(clickX, zoomLevel);
    onSeek(Math.max(0, Math.min(totalDuration, seekTime)));

    isDraggingRef.current = true;
    rulerRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekTime = pixelsToTime(clickX, zoomLevel);
    onSeek(Math.max(0, Math.min(totalDuration, seekTime)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current && rulerRef.current) {
      isDraggingRef.current = false;
      try {
        rulerRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Generate ruler markers
  const markers: React.ReactNode[] = [];
  const maxTime = totalDuration + 5;
  const numTicks = Math.ceil(maxTime / tickIntervalSeconds);

  for (let i = 0; i <= numTicks; i++) {
    const time = i * tickIntervalSeconds;
    const x = timeToPixels(time, zoomLevel);
    const isMajor = Math.abs(time % labelIntervalSeconds) < 0.001;

    markers.push(
      <div
        key={`tick_${i}`}
        className="absolute bottom-0 flex flex-col items-center pointer-events-none"
        style={{ left: `${x}px` }}
      >
        {isMajor && (
          <span className="text-[10px] text-slate-400 font-mono select-none -translate-x-1/2 mb-1.5 whitespace-nowrap">
            {formatRulerLabel(time)}
          </span>
        )}
        <div
          className={`w-[1px] ${
            isMajor ? 'h-3.5 bg-slate-500' : 'h-1.5 bg-slate-700'
          }`}
        />
      </div>
    );
  }

  return (
    <div
      ref={rulerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ width: `${totalWidth}px` }}
      className="relative h-8 bg-slate-950 border-b border-slate-800 cursor-pointer select-none overflow-hidden"
    >
      {/* Ruler ticks and timecodes */}
      {markers}

      {/* Snap Indicator Line */}
      {snapPx !== null && (
        <div
          style={{ left: `${snapPx}px` }}
          className="absolute top-0 bottom-0 w-[2px] bg-amber-400 z-20 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.8)]"
        />
      )}

      {/* Playhead Head */}
      <div
        style={{ left: `${playheadPx}px` }}
        className="absolute top-0 bottom-0 z-30 pointer-events-none -translate-x-1/2 flex flex-col items-center"
      >
        <div className="w-3.5 h-3 bg-red-500 rounded-b-sm shadow-md" />
        <div className="w-[1.5px] h-full bg-red-500" />
      </div>
    </div>
  );
}
