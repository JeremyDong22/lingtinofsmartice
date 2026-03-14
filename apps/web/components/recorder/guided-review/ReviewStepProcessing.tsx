// Step (transitional): Processing — Wait for AI to process the recording
// v2.0 - Added retry + skip buttons for error state

'use client';

import { Sparkles, RotateCcw, SkipForward } from 'lucide-react';
import type { MeetingRecord } from '@/hooks/useMeetingStore';

interface ReviewStepProcessingProps {
  meeting: MeetingRecord | null;
  onRetry: () => void;
  onSkip: () => void;
}

const STATUS_MESSAGES: Record<string, string> = {
  saved: '正在上传录音…',
  uploading: '正在上传录音…',
  pending: '排队处理中…',
  processing: 'AI 正在分析会议内容…',
};

export function ReviewStepProcessing({ meeting, onRetry, onSkip }: ReviewStepProcessingProps) {
  const status = meeting?.status ?? 'saved';
  const isError = status === 'error';
  const message = isError ? '处理失败' : (STATUS_MESSAGES[status] || 'AI 正在分析会议内容…');

  const stages = ['saved', 'uploading', 'pending', 'processing'];
  const currentStageIdx = stages.indexOf(status);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)]">
      {/* Animation or error icon */}
      <div className="relative mb-6">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
          isError ? 'bg-red-50' : 'bg-primary-50'
        }`}>
          <Sparkles className={`w-8 h-8 ${isError ? 'text-red-400' : 'text-primary-500'}`} />
        </div>
        {!isError && (
          <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-primary-300 border-t-transparent animate-spin" />
        )}
      </div>

      <p className={`text-base font-medium mb-2 ${isError ? 'text-red-700' : 'text-gray-800'}`}>
        {message}
      </p>

      {isError ? (
        <>
          <p className="text-xs text-gray-400 text-center max-w-xs mb-6">
            {meeting?.errorMessage || '网络问题或服务暂时不可用'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> 重试
            </button>
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <SkipForward className="w-4 h-4" /> 手动填写行动项
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            AI 将从录音中提取讨论的根因和行动项，通常需要 1-3 分钟
          </p>

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-6">
            {stages.map((s, idx) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                  idx <= currentStageIdx ? 'bg-primary-500' : 'bg-gray-200'
                } ${idx === currentStageIdx ? 'animate-pulse' : ''}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
