// Step 2: Recording — Record the review meeting with agenda visible as reference
// v2.0 - Fixed: uses useEffect for blob detection instead of render-time side effect

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, Mic, Square } from 'lucide-react';
import { WaveformVisualizer } from '@/components/recorder/WaveformVisualizer';
import type { AgendaItem } from './types';
import { SEVERITY_CONFIG, CATEGORY_LABELS } from './types';
import type { AudioRecorderState, AudioRecorderActions } from '@/hooks/useAudioRecorder';

interface ReviewStepRecordingProps {
  agendaItems: AgendaItem[];
  recorderState: AudioRecorderState;
  recorderActions: AudioRecorderActions;
  onRecordingComplete: (duration: number, audioBlob: Blob) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ReviewStepRecording({
  agendaItems,
  recorderState,
  recorderActions,
  onRecordingComplete,
}: ReviewStepRecordingProps) {
  const { isRecording, duration, audioBlob, analyserData } = recorderState;
  const { startRecording, stopRecording } = recorderActions;
  const [agendaCollapsed, setAgendaCollapsed] = useState(true);
  const stoppedRef = useRef(false);
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const handleStart = useCallback(async () => {
    stoppedRef.current = false;
    await startRecording();
  }, [startRecording]);

  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    stopRecording();
  }, [stopRecording]);

  // Detect when audioBlob becomes available after user stopped recording
  useEffect(() => {
    if (stoppedRef.current && audioBlob && !isRecording) {
      stoppedRef.current = false;
      onRecordingComplete(durationRef.current, audioBlob);
    }
  }, [audioBlob, isRecording, onRecordingComplete]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-160px)]">
      <div className="flex-1 flex flex-col items-center justify-center">
        {isRecording ? (
          <>
            {/* Waveform */}
            <div className="w-full glass-card rounded-2xl p-4 mb-6">
              <WaveformVisualizer
                analyserData={analyserData}
                isRecording={isRecording}
              />
              <p className="text-center text-3xl font-mono text-gray-700 mt-3">
                {formatDuration(duration)}
              </p>
            </div>

            {/* Recording indicator */}
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-gray-600">正在录音，请自由讨论</span>
            </div>

            {/* Stop button */}
            <button
              onClick={handleStop}
              className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
            >
              <Square className="w-6 h-6" fill="currentColor" />
            </button>
          </>
        ) : (
          <>
            {/* Pre-recording state */}
            <div className="text-center mb-8">
              <Mic className="w-12 h-12 text-primary-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">准备好后点击开始录音</p>
              <p className="text-xs text-gray-400 mt-1">录音期间可查看议程作为参考</p>
            </div>

            <button
              onClick={handleStart}
              className="w-20 h-20 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors"
            >
              <Mic className="w-8 h-8" />
            </button>
          </>
        )}
      </div>

      {/* Collapsible agenda reference */}
      {agendaItems.length > 0 && (
        <div className="mt-4 glass-card rounded-xl overflow-hidden">
          <button
            onClick={() => setAgendaCollapsed(!agendaCollapsed)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-sm"
          >
            <span className="text-gray-600 font-medium">议题参考 ({agendaItems.length})</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${agendaCollapsed ? '' : 'rotate-180'}`} />
          </button>
          {!agendaCollapsed && (
            <div className="px-4 pb-3 space-y-1.5">
              {agendaItems.map((item, idx) => {
                const config = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.low;
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
                    <span className="text-gray-500">{CATEGORY_LABELS[item.category] || item.category}</span>
                    <span className="text-gray-700">{item.title}</span>
                    <span className="text-gray-400 ml-auto">{item.evidenceCount}桌</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
