// Step 7: Complete — Summary of the review meeting
// Shows meeting duration, completed pending items, and new action items count

'use client';

import { CheckCircle2, Clock, ListChecks, ArrowRight, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ReviewStepCompleteProps {
  meetingDuration: number;
  completedPendingCount: number;
  confirmedActionCount: number;
  meetingId: string | null;
  onExit: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}秒`;
  return `${mins}分${secs > 0 ? `${secs}秒` : ''}`;
}

export function ReviewStepComplete({
  meetingDuration,
  completedPendingCount,
  confirmedActionCount,
  meetingId,
  onExit,
}: ReviewStepCompleteProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-160px)]">
      {/* Success icon */}
      <div className="mt-8 mb-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-2">复盘完成</h2>
      <p className="text-sm text-gray-500 mb-8">会议记录和行动项已保存</p>

      {/* Summary cards */}
      <div className="w-full space-y-3 mb-8">
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">会议时长</p>
            <p className="text-base font-semibold text-gray-900">{formatDuration(meetingDuration)}</p>
          </div>
        </div>

        {completedPendingCount > 0 && (
          <div className="glass-card rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">回顾完成</p>
              <p className="text-base font-semibold text-gray-900">
                {completedPendingCount} 项待办已完成
              </p>
            </div>
          </div>
        )}

        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">新增行动</p>
            <p className="text-base font-semibold text-gray-900">
              {confirmedActionCount} 项待跟进
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full space-y-2 mt-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-1"
        >
          查看看板 <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onExit}
          className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          返回录音页
        </button>
      </div>
    </div>
  );
}
