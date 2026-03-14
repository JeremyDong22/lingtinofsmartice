// Post-stop confirmation: save or discard recording
// Shows duration, save/discard buttons, and 30s auto-save countdown

'use client';

import { useEffect, useRef } from 'react';

interface RecordingConfirmationProps {
  duration: number;
  onSave: () => void;
  onDiscard: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingConfirmation({ duration, onSave, onDiscard }: RecordingConfirmationProps) {
  const countdownRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let remaining = 30;
    const timer = setInterval(() => {
      remaining--;
      if (countdownRef.current) {
        countdownRef.current.textContent = `${remaining}`;
      }
      if (remaining <= 0) {
        onSave();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [onSave]);

  return (
    <div className="glass-card rounded-2xl p-5 mb-4">
      <p className="text-center text-sm text-gray-500 mb-1">录音已停止</p>
      <p className="text-center text-3xl font-mono text-gray-800 mb-4">{formatDuration(duration)}</p>
      <div className="flex gap-3">
        <button
          onClick={onDiscard}
          className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
        >
          丢弃
        </button>
        <button
          onClick={onSave}
          className="flex-[2] py-3 rounded-xl text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm"
        >
          保存
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-3">
        <span ref={countdownRef}>30</span>秒后自动保存
      </p>
    </div>
  );
}
