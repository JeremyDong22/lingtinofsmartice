// Record Button Component - Long press to record
// v1.0

'use client';

import { useCallback, useRef, useState } from 'react';

interface RecordButtonProps {
  isRecording: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RecordButton({
  isRecording,
  disabled = false,
  onStart,
  onStop,
}: RecordButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePressStart = useCallback(() => {
    if (disabled) return;

    setIsPressed(true);

    // Start recording after a short delay to confirm long press
    longPressTimerRef.current = setTimeout(() => {
      if (!isRecording) {
        onStart();
      }
    }, 150);
  }, [disabled, isRecording, onStart]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);

    // Clear the timer if released before long press threshold
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Stop recording if currently recording
    if (isRecording) {
      onStop();
    }
  }, [isRecording, onStop]);

  const handleClick = useCallback(() => {
    // Toggle recording on click (alternative to long press)
    if (disabled) return;

    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  }, [disabled, isRecording, onStart, onStop]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Pulsing ring animation */}
      <div className="relative">
        {isRecording && (
          <>
            <div className="absolute inset-0 w-28 h-28 bg-primary-400 rounded-full animate-pulse-ring" />
            <div
              className="absolute inset-0 w-28 h-28 bg-primary-300 rounded-full animate-pulse-ring"
              style={{ animationDelay: '0.5s' }}
            />
          </>
        )}

        {/* Main button */}
        <button
          onClick={handleClick}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          disabled={disabled}
          className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
            isRecording
              ? 'bg-primary-700 scale-110'
              : isPressed
                ? 'bg-primary-700 scale-95'
                : 'bg-primary-600 hover:bg-primary-700'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
        >
          {isRecording ? (
            // Stop icon (square)
            <div className="w-8 h-8 bg-white rounded-sm" />
          ) : (
            // Microphone icon
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Help text */}
      <p className="text-gray-500 text-sm">
        {isRecording ? '点击停止录音' : '点击开始录音'}
      </p>
    </div>
  );
}
