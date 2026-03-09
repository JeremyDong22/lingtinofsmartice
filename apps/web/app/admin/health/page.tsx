// Admin Health Dashboard - System health monitoring
// Restricted to username 'hr901027'

'use client';

import { useState } from 'react';
import { HeartPulse, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Clock, Wifi, MessageSquareText } from 'lucide-react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { UserMenu } from '@/components/layout/UserMenu';

// --- Types ---
interface HealthCheck {
  id: string;
  checked_at: string;
  check_type: string;
  role_code: string;
  endpoint: string;
  status: string;
  response_ms: number;
  http_status: number | null;
  error_message: string | null;
  batch_id: string;
}

interface LatestData {
  batch_id: string | null;
  checked_at: string | null;
  checks: HealthCheck[];
  summary: { total: number; ok: number; fail: number; timeout: number };
}

interface StatusItem {
  endpoint: string;
  status: string;
  last_checked_at: string;
  last_changed_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
}

interface HistoryBatch {
  batch_id: string;
  checked_at: string;
  total: number;
  ok: number;
  fail: number;
  timeout: number;
  checks: HealthCheck[];
}

interface DigestPriority {
  title: string;
  description: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  feedback_ids: string[];
}

interface FeedbackDigest {
  id: string;
  created_at: string;
  trigger_feedback_id: string | null;
  total_pending: number;
  summary: string;
  priorities: DigestPriority[];
}

// --- Role display config ---
const ROLE_ORDER = ['system', 'administrator', 'manager', 'chef'];
const ROLE_LABELS: Record<string, string> = {
  system: '系统',
  administrator: '管理层',
  manager: '店长',
  chef: '厨师长',
};
const ROLE_COLORS: Record<string, string> = {
  system: 'bg-gray-100 text-gray-600',
  administrator: 'bg-blue-50 text-blue-600',
  manager: 'bg-amber-50 text-amber-600',
  chef: 'bg-emerald-50 text-emerald-600',
};

// --- Helpers ---
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  if (status === 'ok') return <CheckCircle2 size={size} className="text-emerald-500" />;
  if (status === 'fail') return <XCircle size={size} className="text-red-500" />;
  if (status === 'timeout') return <AlertTriangle size={size} className="text-amber-500" />;
  return <AlertTriangle size={size} className="text-gray-400" />;
}

function ResponseTimeBadge({ ms }: { ms: number }) {
  const color = ms < 500 ? 'text-emerald-600' : ms < 2000 ? 'text-amber-600' : 'text-red-600';
  return <span className={`text-xs font-mono ${color}`}>{ms}ms</span>;
}

function groupChecksByRole(checks: HealthCheck[]): { role: string; checks: HealthCheck[] }[] {
  const groups = new Map<string, HealthCheck[]>();
  for (const check of checks) {
    const role = check.role_code || 'system';
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role)!.push(check);
  }
  return ROLE_ORDER
    .filter((role) => groups.has(role))
    .map((role) => ({ role, checks: groups.get(role)! }))
    .concat(
      Array.from(groups.entries())
        .filter(([role]) => !ROLE_ORDER.includes(role))
        .map(([role, checks]) => ({ role, checks }))
    );
}

// --- Skeleton components ---
function BannerSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-32 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-card rounded-xl p-3 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
          <div className="h-3 w-16 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4 animate-pulse space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-gray-200" />
          <div className="flex-1 h-3 bg-gray-200 rounded" />
          <div className="w-12 h-3 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// --- Main Page ---
export default function HealthPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const isAuthorized = user?.username === 'hr901027';

  // SWR queries
  const { data: latestRes, isLoading: latestLoading } = useSWR<{ data: LatestData }>(
    isAuthorized ? '/api/health/latest' : null,
  );
  const { data: statusRes, isLoading: statusLoading } = useSWR<{ data: StatusItem[] }>(
    isAuthorized ? '/api/health/status' : null,
  );
  const { data: historyRes, isLoading: historyLoading } = useSWR<{ data: HistoryBatch[] }>(
    isAuthorized ? '/api/health/history?days=7' : null,
  );
  const { data: digestRes, isLoading: digestLoading } = useSWR<{ data: FeedbackDigest | null }>(
    isAuthorized ? '/api/health/feedback-digest/latest' : null,
  );
  const { data: digestHistoryRes } = useSWR<{ data: FeedbackDigest[] }>(
    isAuthorized ? '/api/health/feedback-digest/history?days=7' : null,
  );

  const latest = latestRes?.data;
  const statuses = statusRes?.data;
  const history = historyRes?.data;
  const latestDigest = digestRes?.data;
  const digestHistory = digestHistoryRes?.data;

  // Access guard
  if (user && !isAuthorized) {
    router.replace('/admin/briefing');
    return null;
  }
  if (!isAuthorized) return null;

  const allOk = latest?.summary && latest.summary.fail === 0 && latest.summary.timeout === 0;
  const checksGrouped = latest?.checks ? groupChecksByRole(latest.checks) : [];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="island-header glass-nav px-[1.125rem] py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <HeartPulse size={20} className="text-gray-600" />
          系统健康
        </h1>
        <UserMenu />
      </header>

      <div className="px-4 space-y-3 island-page-top island-page-bottom">
        {/* Section 1: Latest Patrol Status Banner */}
        {latestLoading ? (
          <BannerSkeleton />
        ) : latest?.batch_id ? (
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${allOk ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  {allOk ? (
                    <CheckCircle2 size={22} className="text-emerald-500" />
                  ) : (
                    <XCircle size={22} className="text-red-500" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {allOk ? '全部正常' : '有异常'}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={11} />
                    {latest.checked_at ? relativeTime(latest.checked_at) : '未知'}
                  </div>
                </div>
              </div>
              <div className={`text-xs font-semibold px-3 py-1.5 rounded-full ${allOk ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {latest.summary.ok}/{latest.summary.total} 通过
                {latest.summary.fail > 0 && `, ${latest.summary.fail} 失败`}
                {latest.summary.timeout > 0 && `, ${latest.summary.timeout} 超时`}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-4 text-center">
            <Wifi className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <div className="text-sm text-gray-400">暂无巡检数据</div>
          </div>
        )}

        {/* Section 2: Heartbeat Status Cards */}
        <div>
          <div className="text-xs font-semibold text-gray-400 px-1 mb-1.5">端点状态</div>
          {statusLoading ? (
            <CardsSkeleton />
          ) : statuses && statuses.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {statuses.map((s) => (
                <div key={s.endpoint} className="glass-card rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.status === 'ok' ? 'bg-emerald-400' : s.status === 'timeout' ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <span className="text-xs font-medium text-gray-900 truncate">
                      {s.endpoint.replace(/^\/api\//, '')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={10} />
                    {s.last_checked_at ? relativeTime(s.last_checked_at) : '--'}
                  </div>
                  {s.consecutive_failures > 0 && (
                    <div className="mt-1 text-[11px] font-medium text-red-500">
                      连续失败 {s.consecutive_failures} 次
                    </div>
                  )}
                  {s.last_error && (
                    <div className="mt-1 text-[11px] text-red-400 truncate" title={s.last_error}>
                      {s.last_error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="text-sm text-gray-400">暂无端点监控数据</div>
            </div>
          )}
        </div>

        {/* Section 3: Latest Patrol Check Details */}
        <div>
          <div className="text-xs font-semibold text-gray-400 px-1 mb-1.5">最新巡检详情</div>
          {latestLoading ? (
            <TableSkeleton />
          ) : checksGrouped.length > 0 ? (
            <div className="space-y-2">
              {checksGrouped.map(({ role, checks }) => (
                <div key={role}>
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[role] || role}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {checks.filter((c) => c.status === 'ok').length}/{checks.length}
                    </span>
                  </div>
                  <div className="glass-card rounded-2xl overflow-hidden divide-y divide-gray-50">
                    {checks.map((check) => (
                      <div key={check.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                        <StatusIcon status={check.status} size={15} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate font-mono">
                            {check.endpoint}
                          </div>
                          {check.error_message && (
                            <div className="text-[11px] text-red-400 truncate mt-0.5">
                              {check.error_message}
                            </div>
                          )}
                        </div>
                        <ResponseTimeBadge ms={check.response_ms} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="text-sm text-gray-400">暂无巡检记录</div>
            </div>
          )}
        </div>

        {/* Section 4: History */}
        <div>
          <div className="text-xs font-semibold text-gray-400 px-1 mb-1.5">巡检历史 (近 7 天)</div>
          {historyLoading ? (
            <TableSkeleton />
          ) : history && history.length > 0 ? (
            <div className="space-y-2">
              {history.map((batch) => {
                const batchOk = batch.fail === 0 && batch.timeout === 0;
                const isExpanded = expandedBatch === batch.batch_id;
                const batchGroups = isExpanded ? groupChecksByRole(batch.checks) : [];

                return (
                  <div key={batch.batch_id} className="glass-card rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedBatch(isExpanded ? null : batch.batch_id)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 active:bg-gray-50"
                    >
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${batchOk ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <div className="flex-1 text-left">
                        <div className="text-sm text-gray-900">
                          {formatTime(batch.checked_at)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {batch.ok}/{batch.total} 通过
                          {batch.fail > 0 && <span className="text-red-500"> {batch.fail} 失败</span>}
                          {batch.timeout > 0 && <span className="text-amber-500"> {batch.timeout} 超时</span>}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </button>

                    {isExpanded && batchGroups.length > 0 && (
                      <div className="border-t border-gray-100 px-3.5 py-2.5 space-y-2">
                        {batchGroups.map(({ role, checks }) => (
                          <div key={role}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'}`}>
                                {ROLE_LABELS[role] || role}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {checks.map((check) => (
                                <div key={check.id} className="flex items-center gap-2 py-1">
                                  <StatusIcon status={check.status} size={13} />
                                  <span className="text-xs text-gray-700 truncate flex-1 font-mono">
                                    {check.endpoint}
                                  </span>
                                  <ResponseTimeBadge ms={check.response_ms} />
                                  {check.error_message && (
                                    <span className="text-[10px] text-red-400 max-w-[100px] truncate" title={check.error_message}>
                                      {check.error_message}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="text-sm text-gray-400">暂无历史记录</div>
            </div>
          )}
        </div>

        {/* Section 5: Feedback Digest */}
        <div>
          <div className="text-xs font-semibold text-gray-400 px-1 mb-1.5 flex items-center gap-1.5">
            <MessageSquareText size={12} />
            反馈分析
          </div>
          {digestLoading ? (
            <TableSkeleton />
          ) : latestDigest ? (
            <div className="space-y-2">
              {/* Latest digest summary */}
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-gray-900">最新分析</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={10} />
                    {relativeTime(latestDigest.created_at)}
                  </div>
                </div>
                <div className="text-sm text-gray-700 mb-3">{latestDigest.summary}</div>
                <div className="text-xs text-gray-500 mb-2">
                  待处理 {latestDigest.total_pending} 条 · {latestDigest.priorities.length} 项建议
                </div>
                {/* Priority list */}
                <div className="space-y-2">
                  {latestDigest.priorities.map((p, i) => (
                    <div key={i} className="rounded-xl bg-gray-50/80 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                          p.severity === 'high' ? 'bg-red-50 text-red-600' :
                          p.severity === 'medium' ? 'bg-amber-50 text-amber-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {p.severity === 'high' ? '高' : p.severity === 'medium' ? '中' : '低'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{p.title}</span>
                        <span className="text-[11px] text-gray-400 ml-auto">{p.category}</span>
                      </div>
                      <div className="text-xs text-gray-600 leading-relaxed">{p.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Digest history */}
              {digestHistory && digestHistory.length > 1 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="px-3.5 py-2.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                    历史分析 (近 7 天)
                  </div>
                  <div className="divide-y divide-gray-50">
                    {digestHistory.slice(1).map((d) => (
                      <div key={d.id} className="px-3.5 py-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-gray-500">{formatTime(d.created_at)}</div>
                          <div className="text-[11px] text-gray-400">
                            {d.total_pending} 条 · {d.priorities.length} 项
                          </div>
                        </div>
                        <div className="text-xs text-gray-700 line-clamp-2">{d.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center">
              <MessageSquareText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-sm text-gray-400">暂无反馈分析</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
