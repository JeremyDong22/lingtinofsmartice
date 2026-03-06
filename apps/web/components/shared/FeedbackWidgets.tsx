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

// --- Audio playback hook ---
export function useAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingKey(null);
  }, []);

  const handleAudioToggle = useCallback(
    (key: string, audioUrl: string) => {
      if (playingKey === key) {
        stopAudio();
        return;
      }
      stopAudio();
      const audio = new Audio(audioUrl);
      audio.onended = () => { setPlayingKey(null); audioRef.current = null; };
      audio.onerror = () => { setPlayingKey(null); audioRef.current = null; };
      audio.play();
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

  return { playingKey, stopAudio, handleAudioToggle };
}
