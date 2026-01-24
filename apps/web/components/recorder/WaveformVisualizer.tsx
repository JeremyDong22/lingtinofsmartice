// Waveform Visualizer Component - Display audio waveform animation
// v1.0

'use client';

import { useRef, useEffect } from 'react';

interface WaveformVisualizerProps {
  analyserData: Uint8Array | null;
  isRecording: boolean;
  isPaused?: boolean;
}

export function WaveformVisualizer({
  analyserData,
  isRecording,
  isPaused = false,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (!isRecording || !analyserData) {
      // Draw idle state - flat line
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, rect.height / 2);
      ctx.lineTo(rect.width, rect.height / 2);
      ctx.stroke();
      return;
    }

    // Draw waveform bars
    const barCount = 32;
    const barWidth = rect.width / barCount - 4;
    const barGap = 4;
    const maxBarHeight = rect.height * 0.8;
    const centerY = rect.height / 2;

    // Sample analyser data evenly
    const step = Math.floor(analyserData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const dataIndex = i * step;
      const value = analyserData[dataIndex] || 0;
      const normalizedValue = value / 255;

      // Add some minimum height for visual feedback
      const barHeight = Math.max(normalizedValue * maxBarHeight, 4);

      const x = i * (barWidth + barGap);
      const y = centerY - barHeight / 2;

      // Gradient color based on intensity
      const hue = isPaused ? 0 : 0; // Red hue
      const saturation = isPaused ? 20 : 70 + normalizedValue * 30;
      const lightness = isPaused ? 70 : 50 + normalizedValue * 10;

      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  }, [analyserData, isRecording, isPaused]);

  return (
    <div className="relative w-full h-32 bg-gray-50 rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
      {!isRecording && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gray-400 text-sm">等待录音...</span>
        </div>
      )}
      {isRecording && isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <span className="text-gray-500 text-sm">已暂停</span>
        </div>
      )}
    </div>
  );
}
