// ChefIssuesSection - 厨师长厨房问题趋势视图
// 只展示厨房相关的聚合问题，支持三种操作 + 语音输入

'use client';

import { useState, useRef, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { getCacheConfig } from '@/contexts/SWRProvider';
import { classifyIssue, markReplyRead } from '@/lib/feedback-issues-api';
import type { FeedbackIssue, FeedbackIssuesResponse } from '@/lib/feedback-issues-api';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';
import { useAudioPlayback, AudioButton, DailyCountsSparkline, getWeekCount, daysSince } from '@/components/shared/FeedbackWidgets';

const CLS_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  unclassified: { icon: '⚪', label: '新发现', color: 'text-gray-600' },
  todo: { icon: '📌', label: '待办', color: 'text-amber-700' },
  resolved: { icon: '✅', label: '已处理', color: 'text-green-700' },
  dismissed: { icon: '💤', label: '已忽略', color: 'text-gray-400' },
};

interface ChefIssuesSectionProps {
  restaurantId: string;
  userName?: string;
}

export function ChefIssuesSection({ restaurantId, userName }: ChefIssuesSectionProps) {
  const swrKey = `/api/feedback-issues?restaurant_id=${restaurantId}&category=dish_quality,service_speed&role=head_chef`;
  const { data, isLoading } = useSWR<FeedbackIssuesResponse>(
    swrKey,
    { ...getCacheConfig('statistics') },
  );
  const { mutate } = useSWRConfig();
  const { playingKey, handleAudioToggle } = useAudioPlayback();

  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'resolved' | 'todo' | 'dismissed' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Voice recording for action notes
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream?.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0) {
          setIsTranscribing(true);
          try {
            const formData = new FormData();
            formData.append('file', blob, 'voice-note.webm');
            const res = await fetch(getApiUrl('api/audio/quick-transcribe'), {
              method: 'POST',
              headers: getAuthHeaders(),
              body: formData,
            });
            if (res.ok) {
              const data = await res.json();
              if (data.transcript) {
                setActionNote(prev => prev ? `${prev} ${data.transcript}` : data.transcript);
              }
            }
          } catch (err) {
            console.error('Quick-transcribe failed:', err);
          } finally {
            setIsTranscribing(false);
          }
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      stream?.getTracks().forEach(t => t.stop());
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const handleClassify = useCallback(async (
    issueId: string,
    classification: 'resolved' | 'todo' | 'dismissed',
    note?: string,
  ) => {
    setSubmitting(true);
    try {
      await classifyIssue(issueId, 'head_chef', classification, note, userName);
      await mutate(swrKey);
      setActionId(null);
      setActionType(null);
      setActionNote('');
    } catch (e) {
      console.error('Failed to classify:', e);
    } finally {
      setSubmitting(false);
    }
  }, [userName, swrKey, mutate]);

  const handleMarkRead = useCallback(async (issueId: string) => {
    try {
      await markReplyRead(issueId, 'head_chef');
      await mutate(swrKey);
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  }, [swrKey, mutate]);

  const issues = data?.issues || [];

  if (isLoading && !issues.length) {
    return (
      <div className="glass-card rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
      </div>
    );
  }

  if (!issues.length) return null;

  // Quick stats
  const activeCount = issues.filter(i => i.classification !== 'resolved' && i.classification !== 'dismissed').length;
  const newThisWeek = issues.filter(i => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(i.first_seen_at) >= weekAgo;
  }).length;
  const trendDown = issues.filter(i => {
    const dc = i.daily_counts || [];
    if (dc.length < 2) return false;
    const recent = dc.slice(-3).reduce((s, d) => s + d.count, 0);
    const earlier = dc.slice(-7, -3).reduce((s, d) => s + d.count, 0);
    return recent < earlier;
  }).length;

  // Sort: unclassified and todo first
  const sorted = [...issues].sort((a, b) => {
    const order: Record<string, number> = { unclassified: 0, todo: 1, resolved: 2, dismissed: 3 };
    return (order[a.classification] ?? 0) - (order[b.classification] ?? 0);
  });

  return (
    <div className="space-y-3">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{activeCount}</div>
          <div className="text-xs text-gray-500 mt-1">活跃问题</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{newThisWeek}</div>
          <div className="text-xs text-gray-500 mt-1">本周新增</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{trendDown}</div>
          <div className="text-xs text-gray-500 mt-1">趋势下降</div>
        </div>
      </div>

      {/* Issues list */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">厨房问题趋势</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">顾客反馈自动聚合，持续跟踪改善效果</p>
        </div>

        <div className="divide-y divide-gray-50">
          {sorted.map((issue) => {
            const cls = CLS_CONFIG[issue.classification] || CLS_CONFIG.unclassified;
            const weekCount = getWeekCount(issue.daily_counts || []);
            const isActionOpen = actionId === issue.id;
            const todoDays = issue.classification === 'todo' ? daysSince(issue.chef_action_at) : null;
            const hasUnreadReply = issue.management_reply && !issue.management_reply_read_by_chef;

            // Latest evidence for "听原声"
            const latestEvidence = (issue.evidence as Array<{
              feedback_text: string;
              table_id: string | null;
              date: string;
              audio_url: string | null;
            }>)?.slice(-1)[0];

            return (
              <div key={issue.id} className="px-4 py-3">
                {/* Header row */}
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5 flex-shrink-0">{cls.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800 font-medium">{issue.topic}</span>
                    {todoDays !== null && todoDays > 0 && (
                      <span className={`ml-2 text-[10px] font-medium ${
                        todoDays >= 7 ? 'text-red-500' : todoDays >= 3 ? 'text-amber-500' : 'text-gray-500'
                      }`}>
                        待办 {todoDays}天
                      </span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-500">本周 {weekCount} 次</div>
                    <DailyCountsSparkline dailyCounts={issue.daily_counts || []} />
                  </div>
                </div>

                {/* Latest evidence */}
                {latestEvidence && (
                  <div className="mt-1.5 ml-6 flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">
                      最近：{latestEvidence.date} {latestEvidence.table_id || ''} &ldquo;{latestEvidence.feedback_text}&rdquo;
                    </span>
                    {latestEvidence.audio_url && (
                      <AudioButton
                        audioKey={`chef-ev-${issue.id}`}
                        audioUrl={latestEvidence.audio_url}
                        playingKey={playingKey}
                        onToggle={handleAudioToggle}
                      />
                    )}
                  </div>
                )}

                {/* Manager's action (cross-role visibility) */}
                {issue.manager_classification && (
                  <div className="mt-1 ml-6 text-[10px] text-gray-400">
                    店长标记：{CLS_CONFIG[issue.manager_classification]?.icon} {CLS_CONFIG[issue.manager_classification]?.label}
                    {issue.manager_action_note && ` — "${issue.manager_action_note}"`}
                  </div>
                )}

                {/* Chef's own action note */}
                {(issue.classification === 'resolved' || issue.classification === 'dismissed') && issue.chef_action_note && (
                  <div className={`mt-1 ml-6 text-xs ${cls.color}`}>
                    &ldquo;{issue.chef_action_note}&rdquo;
                    {issue.chef_action_by && (
                      <span className="text-gray-400">
                        {' — '}{issue.chef_action_by}{' '}
                        {issue.chef_action_at && new Date(issue.chef_action_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}

                {/* Management reply */}
                {issue.management_reply && (
                  <div
                    className="mt-2 ml-6 p-2 rounded-lg bg-blue-50/70 border border-blue-100"
                    onClick={() => { if (hasUnreadReply) handleMarkRead(issue.id); }}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-blue-600 font-medium">💬 管理层回复</span>
                      {hasUnreadReply && (
                        <span className="text-[10px] text-red-500 font-medium">🔴 新</span>
                      )}
                    </div>
                    <p className="text-xs text-blue-800">{issue.management_reply}</p>
                    {issue.management_reply_by && (
                      <p className="text-[10px] text-blue-400 mt-0.5">
                        — {issue.management_reply_by}{' '}
                        {issue.management_reply_at && new Date(issue.management_reply_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {(issue.classification === 'unclassified' || issue.classification === 'todo') && !isActionOpen && (
                  <div className="flex gap-2 mt-2 ml-6">
                    <button
                      onClick={() => { setActionId(issue.id); setActionType('resolved'); }}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 active:bg-green-100"
                    >
                      已处理
                    </button>
                    <button
                      onClick={() => handleClassify(issue.id, 'todo')}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 active:bg-amber-100"
                    >
                      待办
                    </button>
                    <button
                      onClick={() => { setActionId(issue.id); setActionType('dismissed'); }}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200 active:bg-gray-100"
                    >
                      忽略
                    </button>
                  </div>
                )}

                {/* Action note input with voice */}
                {isActionOpen && (
                  <div className="mt-2 ml-6">
                    <div className="relative">
                      <textarea
                        className="w-full text-sm border border-gray-200 rounded-xl p-2.5 pr-12 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
                        rows={2}
                        placeholder={actionType === 'resolved' ? '简述处理措施...' : '原因（可选）...'}
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isTranscribing}
                        className={`absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isRecording ? 'bg-red-500 text-white animate-pulse' :
                          isTranscribing ? 'bg-gray-200 text-gray-400' :
                          'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isTranscribing ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
                        )}
                      </button>
                    </div>
                    {isRecording && (
                      <div className="text-xs text-red-500 text-center mt-1 animate-pulse">录音中...</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleClassify(issue.id, actionType!, actionNote || undefined)}
                        disabled={submitting || (actionType === 'resolved' && !actionNote.trim())}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-blue-500 text-white disabled:opacity-50"
                      >
                        {submitting ? '提交中...' : '确认'}
                      </button>
                      <button
                        onClick={() => { setActionId(null); setActionType(null); setActionNote(''); }}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-gray-100 text-gray-600"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
