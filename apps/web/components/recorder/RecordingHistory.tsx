// Recording History Component - Display list of recordings with status
// v1.7 - Replaced emoji icons with lucide-react SVG icons

'use client';

import { useState, useRef, useEffect } from 'react';
import { Recording, RecordingStatus } from '@/hooks/useRecordingStore';
import { SmilePlus, Meh, Frown, CheckCircle, Loader, XCircle } from 'lucide-react';
import { useAudioPlayback, AudioPlayerInline } from '@/components/shared/FeedbackWidgets';

interface RecordingHistoryProps {
  recordings: Recording[];
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  title?: string;
}

// Format timestamp to HH:MM
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format duration to MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Status badge component
// v1.2 - Added pending and processed status types for database sync
function StatusBadge({ status }: { status: RecordingStatus }) {
  const config: Record<RecordingStatus, { text: string; className: string }> = {
    saved: { text: '已保存', className: 'bg-gray-100 text-gray-600' },
    uploading: { text: '上传中...', className: 'bg-primary-100 text-primary-600' },
    pending: { text: '待处理', className: 'bg-gray-100 text-gray-600' },
    processing: { text: '处理中...', className: 'bg-yellow-100 text-yellow-600' },
    processed: { text: '已完成', className: 'bg-green-100 text-green-600' },
    completed: { text: '已完成', className: 'bg-green-100 text-green-600' },
    error: { text: '失败', className: 'bg-red-100 text-red-600' },
  };

  const { text, className } = config[status];

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {status === 'uploading' || status === 'processing' ? (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-current rounded-full animate-pulse" />
          {text}
        </span>
      ) : (
        text
      )}
    </span>
  );
}

// Satisfaction icon based on score (0-100)
function SatisfactionIcon({ score }: { score?: number }) {
  if (score == null) return null;

  if (score >= 70) return <SmilePlus className="w-5 h-5 text-green-500" />;
  if (score >= 50) return <Meh className="w-5 h-5 text-gray-400" />;
  return <Frown className="w-5 h-5 text-red-500" />;
}

// Mini waveform visualization (static)
function MiniWaveform() {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="w-0.5 bg-gray-300 rounded-full"
          style={{ height: `${Math.random() * 100}%` }}
        />
      ))}
    </div>
  );
}

// Audio play button component
interface PlayButtonProps {
  audioUrl?: string;
  audioData?: string;
  isPlaying: boolean;
  onToggle: () => void;
}

function PlayButton({ audioUrl, audioData, isPlaying, onToggle }: PlayButtonProps) {
  const hasAudio = audioUrl || audioData;

  if (!hasAudio) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-100 hover:bg-primary-200 transition-colors"
      title={isPlaying ? '暂停' : '播放'}
    >
      {isPlaying ? (
        <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}

// Swipeable row with delete action
interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const DELETE_THRESHOLD = -80; // Pixels to swipe to trigger delete button
  const DELETE_BUTTON_WIDTH = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startXRef.current;
    const newTranslateX = Math.min(0, Math.max(-DELETE_BUTTON_WIDTH, currentXRef.current + diff));
    setTranslateX(newTranslateX);
  };

  const handleTouchEnd = () => {
    // Snap to show delete button or hide it
    if (translateX < DELETE_THRESHOLD / 2) {
      setTranslateX(-DELETE_BUTTON_WIDTH);
    } else {
      setTranslateX(0);
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    // Animate out then delete
    setTimeout(() => {
      onDelete();
    }, 200);
  };

  const resetSwipe = () => {
    setTranslateX(0);
  };

  return (
    <div
      className={`relative overflow-hidden transition-all duration-200 ${isDeleting ? 'h-0 opacity-0' : ''}`}
    >
      {/* Delete button background */}
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
        <button
          onClick={handleDelete}
          className="w-full h-full flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Swipeable content */}
      <div
        ref={rowRef}
        className="relative bg-white transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={translateX < 0 ? resetSwipe : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function RecordingHistory({
  recordings,
  onRetry,
  onDelete,
  title = '今日录音',
}: RecordingHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { playingKey: playingId, currentTime, duration, isBuffering, handleAudioToggle, seekTo } = useAudioPlayback();

  if (recordings.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center">
        <p className="text-gray-400 text-sm">暂无录音</p>
      </div>
    );
  }

  // Status counts for summary bar
  const completedCount = recordings.filter(r => r.status === 'processed' || r.status === 'completed').length;
  const processingCount = recordings.filter(r => r.status === 'processing' || r.status === 'uploading' || r.status === 'pending').length;
  const failedCount = recordings.filter(r => r.status === 'error').length;

  // Sort: failed first, then by timestamp descending
  const sorted = [...recordings].sort((a, b) => {
    if (a.status === 'error' && b.status !== 'error') return -1;
    if (a.status !== 'error' && b.status === 'error') return 1;
    return b.timestamp - a.timestamp;
  });

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">
          {title} ({recordings.length})
        </h3>
        {/* Status summary bar */}
        <div className="flex items-center gap-3 mt-1.5 text-xs">
          {completedCount > 0 && (
            <span className="text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3.5 h-3.5" /> {completedCount}条完成</span>
          )}
          {processingCount > 0 && (
            <span className="text-yellow-600 flex items-center gap-0.5"><Loader className="w-3.5 h-3.5 animate-spin" /> {processingCount}条处理中</span>
          )}
          {failedCount > 0 && (
            <button
              onClick={() => {
                // Scroll to first failed item or trigger retry
                const firstFailed = sorted.find(r => r.status === 'error');
                if (firstFailed && onRetry) onRetry(firstFailed.id);
              }}
              className="text-red-600 hover:text-red-700"
            >
              <span className="flex items-center gap-0.5"><XCircle className="w-3.5 h-3.5" /> {failedCount}条失败（点击重试）</span>
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {sorted.map((recording) => (
          <SwipeableRow
            key={recording.id}
            onDelete={() => onDelete?.(recording.id)}
          >
            <div
              className={`px-4 py-3 transition-colors ${
                recording.correctedTranscript ? 'cursor-pointer hover:bg-gray-50' : ''
              }`}
              onClick={() => {
                if (recording.correctedTranscript) {
                  setExpandedId(expandedId === recording.id ? null : recording.id);
                }
              }}
            >
            <div className="flex items-start justify-between gap-3">
              {/* Left: Table ID and time */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <span className="text-primary-600 font-bold text-sm">
                    {recording.tableId}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatTime(recording.timestamp)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDuration(recording.duration)}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    {(recording.audioUrl || recording.audioData) ? (
                      <AudioPlayerInline
                        audioKey={recording.id}
                        audioUrl={recording.audioUrl || recording.audioData || ''}
                        playingKey={playingId}
                        currentTime={currentTime}
                        duration={duration}
                        onToggle={handleAudioToggle}
                        onSeek={seekTo}
                        isBuffering={isBuffering}
                      />
                    ) : (
                      <MiniWaveform />
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Status and sentiment */}
              <div className="flex items-center gap-2">
                <SatisfactionIcon score={recording.sentimentScore} />
                <StatusBadge status={recording.status} />
                {/* Expand indicator */}
                {recording.correctedTranscript && (
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      expandedId === recording.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            </div>

            {/* Summary text */}
            {recording.aiSummary && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-1 ml-13">
                "{recording.aiSummary}"
              </p>
            )}

            {/* Expanded transcript */}
            {expandedId === recording.id && recording.correctedTranscript && (
              <div className="mt-3 ml-13 p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">录音全文</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {recording.correctedTranscript}
                </p>
              </div>
            )}

            {/* Error message with retry */}
            {recording.status === 'error' && (
              <div className="mt-2 flex items-center justify-between ml-13">
                <span className="text-xs text-red-500">
                  {recording.errorMessage || '处理失败'}
                </span>
                {onRetry && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(recording.id);
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    重试
                  </button>
                )}
              </div>
            )}
            </div>
          </SwipeableRow>
        ))}
      </div>
    </div>
  );
}
