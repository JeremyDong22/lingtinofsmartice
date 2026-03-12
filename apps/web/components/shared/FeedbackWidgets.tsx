// Shared feedback widgets extracted from CustomerInsights
// Used by both admin CustomerInsights and store manager dashboard

'use client';

import { useRef, useState, useCallback, useEffect, Fragment } from 'react';
import { useT } from '@/lib/i18n';

// --- Inline Q&A conversation renderer ---
export function QAConversation({ questions, answers }: { questions: string[]; answers: string[] }) {
  const { t } = useT();
  const maxLen = Math.max(questions.length, answers.length);
  if (maxLen === 0) return null;
  return (
    <div className="space-y-1.5">
      {Array.from({ length: maxLen }).map((_, j) => (
        <Fragment key={j}>
          {questions[j] && (
            <div className="flex gap-2">
              <span className="text-[10px] text-gray-400 mt-0.5 flex-shrink-0 w-7 text-right">{t('insights.manager')}</span>
              <p className="text-xs text-gray-500 flex-1">{questions[j]}</p>
            </div>
          )}
          {answers[j] && (
            <div className="flex gap-2">
              <span className="text-[10px] text-primary-500 mt-0.5 flex-shrink-0 w-7 text-right">{t('insights.customer')}</span>
              <p className="text-xs text-gray-800 flex-1">{answers[j]}</p>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

// --- Audio play button ---
export function AudioButton({ audioKey, audioUrl, playingKey, onToggle }: {
  audioKey: string;
  audioUrl: string;
  playingKey: string | null;
  onToggle: (key: string, url: string) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(audioKey, audioUrl); }}
      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
        playingKey === audioKey ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600 hover:text-primary-600 hover:bg-primary-50'
      }`}
    >
      {playingKey === audioKey ? (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
      ) : (
        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
      )}
    </button>
  );
}

// --- Chevron icon ---
export function ChevronDown({ expanded, className = '' }: { expanded: boolean; className?: string }) {
  return (
    <svg className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// --- Audio playback hook (with progress tracking + buffering resilience) ---
export function useAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current.ondurationchange = null;
      audioRef.current.onwaiting = null;
      audioRef.current.onplaying = null;
      audioRef.current = null;
    }
    setPlayingKey(null);
    setCurrentTime(0);
    setDuration(0);
    setIsBuffering(false);
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleAudioToggle = useCallback(
    (key: string, audioUrl: string) => {
      if (playingKey === key) {
        stopAudio();
        return;
      }
      stopAudio();
      const audio = new Audio(audioUrl);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.onloadedmetadata = () => {
        if (isFinite(audio.duration)) setDuration(audio.duration);
      };
      // Some streaming sources update duration progressively
      audio.ondurationchange = () => {
        if (isFinite(audio.duration)) setDuration(audio.duration);
      };
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onwaiting = () => setIsBuffering(true);
      audio.onplaying = () => setIsBuffering(false);
      audio.onended = () => { setPlayingKey(null); setCurrentTime(0); setDuration(0); setIsBuffering(false); audioRef.current = null; };
      audio.onerror = () => { setPlayingKey(null); setCurrentTime(0); setDuration(0); setIsBuffering(false); audioRef.current = null; };
      audio.play().catch(() => { setPlayingKey(null); audioRef.current = null; });
      audioRef.current = audio;
      setPlayingKey(key);
    },
    [playingKey, stopAudio],
  );

  // Cleanup on unmount — stop playing audio to prevent memory leak
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { playingKey, currentTime, duration, isBuffering, stopAudio, handleAudioToggle, seekTo };
}

// --- Inline audio player with progress bar ---
function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function AudioPlayerInline({ audioKey, audioUrl, playingKey, currentTime, duration, onToggle, onSeek, isBuffering }: {
  audioKey: string;
  audioUrl: string;
  playingKey: string | null;
  currentTime: number;
  duration: number;
  onToggle: (key: string, url: string) => void;
  onSeek: (time: number) => void;
  isBuffering?: boolean;
}) {
  const isPlaying = playingKey === audioKey;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 w-full">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(audioKey, audioUrl); }}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isPlaying ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600 hover:text-primary-600 hover:bg-primary-50'
        }`}
      >
        {isBuffering && isPlaying ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        ) : isPlaying ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={isPlaying ? currentTime : 0}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={!isPlaying}
          className="w-full h-1 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500 disabled:cursor-default disabled:opacity-50 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:appearance-none"
          style={{ touchAction: 'none', ...(isPlaying ? { background: `linear-gradient(to right, rgb(var(--color-primary-500)) ${progress}%, #e5e7eb ${progress}%)` } : {}) }}
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>{isPlaying ? formatTime(currentTime) : '0:00'}</span>
          <span>{isPlaying && duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
}
