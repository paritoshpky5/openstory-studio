'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
  sourceFilePath?: string | null;
  clipDuration: number;
  trimIn?: number;
  color?: string;
  pixelsPerSecond: number;
  className?: string;
}

// In-memory cache for audio peaks (50 peaks per second)
const PEAKS_PER_SECOND = 50;
const peaksCache = new Map<string, Promise<Float32Array | null>>();

async function loadAudioPeaks(sourcePath: string): Promise<Float32Array | null> {
  try {
    const cleanPath = sourcePath.replace(/\\/g, '/');
    const url = `/api/media/${cleanPath}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    const audioContext = new AudioCtx();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Close audio context to free resources
    audioContext.close().catch(() => undefined);

    const channelData = audioBuffer.getChannelData(0);
    const totalDuration = audioBuffer.duration;
    const totalBuckets = Math.max(1, Math.floor(totalDuration * PEAKS_PER_SECOND));
    const bucketSize = Math.max(1, Math.floor(channelData.length / totalBuckets));

    const peaks = new Float32Array(totalBuckets);
    for (let i = 0; i < totalBuckets; i++) {
      let max = 0;
      const start = i * bucketSize;
      const end = Math.min(start + bucketSize, channelData.length);
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks[i] = max;
    }

    return peaks;
  } catch {
    // Fail gracefully on decoding errors or unsupported formats
    return null;
  }
}

function getCachedPeaks(sourcePath: string): Promise<Float32Array | null> {
  const existing = peaksCache.get(sourcePath);
  if (existing) return existing;

  const promise = loadAudioPeaks(sourcePath);
  peaksCache.set(sourcePath, promise);
  return promise;
}

export function AudioWaveform({
  sourceFilePath,
  clipDuration,
  trimIn = 0,
  color = 'rgba(255, 255, 255, 0.4)',
  pixelsPerSecond,
  className = '',
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!sourceFilePath) {
      setPeaks(null);
      return;
    }

    getCachedPeaks(sourceFilePath)
      .then((data) => {
        if (!isCancelled) {
          setPeaks(data);
        }
      })
      .catch(() => {
        if (!isCancelled) setPeaks(null);
      });

  return () => {
    isCancelled = true;
  };
}, [sourceFilePath]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = Math.max(1, Math.round(clipDuration * pixelsPerSecond));
    const height = Math.max(1, canvas.clientHeight || 32);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (!peaks || peaks.length === 0) {
      // Draw subtle flat baseline if peaks are unavailable
      ctx.fillStyle = color;
      ctx.fillRect(0, Math.floor(height / 2), width, 1);
      return;
    }

    const startBucket = Math.floor(trimIn * PEAKS_PER_SECOND);
    const numBuckets = Math.floor(clipDuration * PEAKS_PER_SECOND);

    const barWidth = 2;
    const barGap = 1;
    const barStep = barWidth + barGap;
    const totalBars = Math.floor(width / barStep);

    ctx.fillStyle = color;

    for (let i = 0; i < totalBars; i++) {
      const progress = i / totalBars;
      const bucketIdx = startBucket + Math.floor(progress * numBuckets);
      const amplitude = bucketIdx < peaks.length ? peaks[bucketIdx] : 0;

      const barHeight = Math.max(2, Math.round(amplitude * (height - 4)));
      const x = i * barStep;
      const y = Math.round((height - barHeight) / 2);

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [peaks, clipDuration, trimIn, pixelsPerSecond, color]);

  return (
    <div className={`relative h-full w-full pointer-events-none overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
