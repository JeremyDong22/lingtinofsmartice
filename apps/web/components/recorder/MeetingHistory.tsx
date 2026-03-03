// Meeting History - Display list of meeting recordings with status and summaries
// v1.1 - Replaced emoji icons with lucide-react SVG icons

'use client';

import { useState, type ReactNode } from 'react';
import { MeetingRecord, MeetingStatus, MeetingType } from '@/hooks/useMeetingStore';
import {
  UtensilsCrossed, ClipboardList, CalendarDays,
  ChefHat, Building2, UserRound,
} from 'lucide-react';

interface MeetingHistoryProps {
  meetings: MeetingRecord[];
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  onViewDetail?: (meeting: MeetingRecord) => void;
  title?: string;
}

const MEETING_TYPE_LABELS: Record<MeetingType, { label: string; icon: ReactNode }> = {
  pre_meal: { label: '餐前会', icon: <UtensilsCrossed className="w-5 h-5 text-primary-600" /> },
  daily_review: { label: '每日复盘', icon: <ClipboardList className="w-5 h-5 text-primary-600" /> },
  weekly: { label: '周例会', icon: <CalendarDays className="w-5 h-5 text-primary-600" /> },
  kitchen_meeting: { label: '厨房会议', icon: <ChefHat className="w-5 h-5 text-primary-600" /> },
  cross_store_review: { label: '经营会', icon: <Building2 className="w-5 h-5 text-primary-600" /> },
  one_on_one: { label: '店长沟通', icon: <UserRound className="w-5 h-5 text-primary-600" /> },
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
  }
  return `${seconds}秒`;
}

function StatusBadge({ status }: { status: MeetingStatus }) {
  const config: Record<MeetingStatus, { text: string; className: string }> = {
    saved: { text: '已保存', className: 'bg-gray-100 text-gray-600' },
    uploading: { text: '上传中...', className: 'bg-primary-100 text-primary-600' },
    pending: { text: '待处理', className: 'bg-gray-100 text-gray-600' },
    processing: { text: '分析中...', className: 'bg-yellow-100 text-yellow-600' },
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

export function MeetingHistory({
  meetings,
  onRetry,
  onDelete,
  onViewDetail,
  title = '今日例会',
}: MeetingHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (meetings.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
        <p className="text-gray-400 text-sm">暂无例会录音</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">
          {title} ({meetings.length})
        </h3>
      </div>

      <div className="divide-y divide-gray-50">
        {meetings.map((meeting) => {
          const typeInfo = MEETING_TYPE_LABELS[meeting.meetingType];
          const isExpanded = expandedId === meeting.id;
          const isCompleted = meeting.status === 'completed' || meeting.status === 'processed';
          const isProcessing = meeting.status === 'processing' || meeting.status === 'uploading';
          const actionCount = meeting.actionItems?.length || 0;

          return (
            <div key={meeting.id} className="px-4 py-3">
              {/* Main row - always visible */}
              <div
                className={`flex items-start justify-between gap-3 ${
                  isCompleted ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (isCompleted) {
                    setExpandedId(isExpanded ? null : meeting.id);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                    {typeInfo.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {typeInfo.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(meeting.timestamp)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDuration(meeting.duration)}
                      </span>
                    </div>
                    {isProcessing && (
                      <p className="text-xs text-yellow-600 mt-0.5">
                        AI分析中...
                      </p>
                    )}
                    {isCompleted && meeting.aiSummary && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {meeting.aiSummary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isCompleted && actionCount > 0 && (
                    <span className="text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                      {actionCount}项待办
                    </span>
                  )}
                  <StatusBadge status={meeting.status} />
                  {isCompleted && (
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
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

              {/* Expanded content */}
              {isExpanded && isCompleted && (
                <div className="mt-3 ml-[3.25rem] space-y-3">
                  {/* Action items */}
                  {meeting.actionItems && meeting.actionItems.length > 0 && (
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <div className="text-xs font-medium text-orange-700 mb-2">行动待办</div>
                      <ul className="space-y-1.5">
                        {meeting.actionItems.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <span className="w-4 h-4 mt-0.5 rounded border border-orange-300 flex-shrink-0" />
                            <div>
                              <span className="text-gray-800">{item.what}</span>
                              {item.who && item.who !== '待定' && (
                                <span className="text-orange-600 ml-1">@{item.who}</span>
                              )}
                              {item.deadline && (
                                <span className="text-gray-400 ml-1 text-xs">({item.deadline})</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* View full detail button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetail?.(meeting);
                    }}
                    className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    查看完整纪要
                  </button>
                </div>
              )}

              {/* Error with retry */}
              {meeting.status === 'error' && (
                <div className="mt-2 flex items-center justify-between ml-[3.25rem]">
                  <span className="text-xs text-red-500">
                    {meeting.errorMessage || '处理失败'}
                  </span>
                  <div className="flex gap-2">
                    {onRetry && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(meeting.id);
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        重试
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(meeting.id);
                        }}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
