'use client';

import { useState, useCallback } from 'react';
import {
  Brain,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  TrendingUp,
  BookOpen,
  Target,
  Star,
  FileText,
  BarChart3,
  ClipboardCheck,
  Play,
  RefreshCw,
  Layers,
  Search,
  Zap,
  Database,
  Activity,
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { UserMenu } from '@/components/layout/UserMenu';
import { getApiUrl } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────

type ReviewStatus = 'pending_review' | 'approved' | 'revision_requested' | 'rejected';
type KnowledgeType = 'profile' | 'example' | 'pattern' | 'benchmark' | 'best_practice' | 'rule';
type KnowledgeScope = 'restaurant' | 'brand' | 'region' | 'global';
type PageView = 'dashboard' | 'review';

interface KnowledgeEntry {
  id: string;
  restaurant_id: string | null;
  brand_id: number | null;
  region_id: string | null;
  scope: KnowledgeScope;
  knowledge_type: KnowledgeType;
  category: string | null;
  title: string | null;
  content: Record<string, unknown>;
  quality_score: number;
  confidence: number;
  usage_count: number;
  source_type: string;
  source_signal: string | null;
  source_record_id: string | null;
  source_record_type: string | null;
  review_status: ReviewStatus;
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
  depth_level?: string;
}

interface BootstrapStatus {
  running: boolean;
  progress: {
    step: string;
    restaurant?: string;
    processed: number;
    total: number;
    rulesExtracted: number;
    errors: string[];
  };
}

interface ReanalyzeStatus {
  running: boolean;
  processed: number;
  failed: number;
  total: number;
  status: string;
}

// ─── Config ─────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<KnowledgeType, { label: string; icon: typeof Brain; color: string }> = {
  profile: { label: '画像', icon: BookOpen, color: 'bg-blue-50 text-blue-600' },
  example: { label: '示例', icon: FileText, color: 'bg-purple-50 text-purple-600' },
  pattern: { label: '规律', icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
  benchmark: { label: '基准', icon: Target, color: 'bg-emerald-50 text-emerald-600' },
  best_practice: { label: '实践', icon: Star, color: 'bg-orange-50 text-orange-600' },
  rule: { label: '规则', icon: Sparkles, color: 'bg-red-50 text-red-600' },
};

const SCOPE_LABELS: Record<KnowledgeScope, string> = {
  restaurant: '门店',
  brand: '品牌',
  region: '区域',
  global: '全局',
};

// Category groupings for filter tabs
const CATEGORY_GROUPS: { value: string; label: string; categories: string[] }[] = [
  { value: 'ai', label: 'AI 规则', categories: ['general'] },
  { value: 'product', label: '产品', categories: ['dish'] },
  { value: 'customer', label: '客群', categories: ['customer'] },
  { value: 'operation', label: '运营', categories: ['operation', 'best_practice', 'opportunity'] },
  { value: 'service', label: '服务', categories: ['service', 'environment', 'staff'] },
  { value: 'discovery', label: '发现', categories: ['emergent'] },
  { value: 'all', label: '全部', categories: [] },
];

// Source type labels for display
const SOURCE_LABELS: Record<string, string> = {
  visit_extraction: '桌访录音',
  visit_negative_extraction: '负面反馈',
  meeting_extraction: '复盘会决策',
  action_resolution: '行动项经验',
  chat_analysis: '对话分析',
  behavior_analysis: '行为分析',
  bootstrap_proofread: '初始校对',
  bootstrap_labels: '初始标注',
  bootstrap_profile: '初始画像',
};

const DEPTH_LABELS: Record<string, { label: string; desc: string }> = {
  L1: { label: 'L1 原始', desc: '直接从数据提取' },
  L2: { label: 'L2 纵向', desc: '同门店纵向总结' },
  L3: { label: 'L3 横向', desc: '跨门店横向洞察' },
  L4: { label: 'L4 行动', desc: '可执行行动指引' },
};

const STATUS_TABS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已批准' },
  { value: 'revision_requested', label: '待修改' },
  { value: 'rejected', label: '已驳回' },
  { value: 'all', label: '全部' },
];

// ─── Helpers ────────────────────────────────────────────────────────

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

function formatContent(content: Record<string, unknown>): string {
  if (typeof content === 'string') return content;
  const lines: string[] = [];
  for (const [key, val] of Object.entries(content)) {
    if (typeof val === 'string') {
      lines.push(`${key}: ${val}`);
    } else if (Array.isArray(val)) {
      lines.push(`${key}: ${val.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ')}`);
    } else if (val && typeof val === 'object') {
      lines.push(`${key}: ${JSON.stringify(val, null, 2)}`);
    }
  }
  return lines.join('\n');
}

// ─── API helpers ────────────────────────────────────────────────────

async function reviewAction(
  id: string,
  action: 'approve' | 'revise' | 'reject',
  note?: string,
): Promise<boolean> {
  const res = await fetch(getApiUrl(`/api/knowledge/${id}/${action}`), {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  return res.ok;
}

async function triggerWorker(endpoint: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(getApiUrl(`/api/knowledge/worker/${endpoint}`), {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    return { ok: res.ok, message: json.message || 'Done' };
  } catch {
    return { ok: false, message: '请求失败' };
  }
}

async function triggerReanalysis(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(getApiUrl('/api/audio/reanalyze-all'), {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cutoff_date: new Date().toISOString() }),
    });
    const json = await res.json();
    return { ok: res.ok, message: json.message || 'Done' };
  } catch {
    return { ok: false, message: '请求失败' };
  }
}

// ─── Dashboard Components ───────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Brain;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-3.5">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={17} />
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
          {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function WorkerButton({ label, desc, icon: Icon, endpoint, onResult }: {
  label: string;
  desc: string;
  icon: typeof Brain;
  endpoint: string;
  onResult: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const result = await triggerWorker(endpoint);
    setLoading(false);
    onResult(result.message);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="glass-card rounded-xl p-3 flex items-center gap-3 w-full text-left active:bg-gray-50 disabled:opacity-50"
    >
      <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Icon size={15} />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 truncate">{desc}</div>
      </div>
    </button>
  );
}

function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>{current}/{total} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DashboardView() {
  const [workerMsg, setWorkerMsg] = useState('');

  // Knowledge stats
  const { data: allKnowledge } = useSWR<{ data: KnowledgeEntry[] }>(
    '/api/knowledge/list?limit=500',
  );
  const entries = allKnowledge?.data || [];

  // Bootstrap status
  const { data: bootstrapRes } = useSWR<{ data: BootstrapStatus }>(
    '/api/knowledge/worker/bootstrap-status',
    { refreshInterval: 5000 },
  );
  const bootstrap = bootstrapRes?.data;

  // Reanalyze status
  const { data: reanalyzeRes } = useSWR<{ data: ReanalyzeStatus }>(
    '/api/audio/reanalyze-status',
    { refreshInterval: 5000 },
  );
  const reanalyze = reanalyzeRes?.data;

  // Compute stats
  const byDepth: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byRestaurant: Record<string, number> = {};
  let pendingReview = 0;

  for (const e of entries) {
    const d = e.depth_level || 'L1';
    byDepth[d] = (byDepth[d] || 0) + 1;
    byType[e.knowledge_type] = (byType[e.knowledge_type] || 0) + 1;
    if (e.restaurant_id) {
      byRestaurant[e.restaurant_id] = (byRestaurant[e.restaurant_id] || 0) + 1;
    }
    if (e.review_status === 'pending_review') pendingReview++;
  }

  const handleReanalysis = async () => {
    const result = await triggerReanalysis();
    setWorkerMsg(result.message);
  };

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="知识总数"
          value={entries.length}
          sub={`${Object.keys(byRestaurant).length} 家门店`}
          icon={Database}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="待审核"
          value={pendingReview}
          icon={ClipboardCheck}
          color={pendingReview > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}
        />
      </div>

      {/* Depth Level Distribution */}
      <div className="glass-card rounded-2xl p-4">
        <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Layers size={15} className="text-gray-500" />
          知识层级分布
        </div>
        <div className="space-y-2">
          {(['L1', 'L2', 'L3', 'L4'] as const).map((level) => {
            const count = byDepth[level] || 0;
            const config = DEPTH_LABELS[level];
            const maxCount = Math.max(...Object.values(byDepth), 1);
            return (
              <div key={level} className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-gray-600 w-6">{level}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600">{config.desc}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        level === 'L1' ? 'bg-blue-400' :
                        level === 'L2' ? 'bg-emerald-400' :
                        level === 'L3' ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Type Distribution */}
      <div className="glass-card rounded-2xl p-4">
        <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <BarChart3 size={15} className="text-gray-500" />
          知识类型分布
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_CONFIG) as KnowledgeType[]).map((type) => {
            const count = byType[type] || 0;
            const config = TYPE_CONFIG[type];
            const TypeIcon = config.icon;
            return (
              <div
                key={type}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${config.color}`}
              >
                <TypeIcon size={13} />
                <span className="text-xs font-medium">{config.label}</span>
                <span className="text-xs font-bold">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Tasks */}
      {(bootstrap?.running || reanalyze?.running) && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Activity size={15} className="text-green-500 animate-pulse" />
            运行中任务
          </div>

          {bootstrap?.running && (
            <div className="bg-blue-50/80 rounded-xl p-3 space-y-2">
              <div className="text-xs font-medium text-blue-700">Bootstrap 知识提取</div>
              <ProgressBar
                current={bootstrap.progress.processed}
                total={bootstrap.progress.total}
                label={bootstrap.progress.restaurant || '处理中...'}
              />
              <div className="text-[10px] text-blue-500">
                已提取 {bootstrap.progress.rulesExtracted} 条知识
              </div>
            </div>
          )}

          {reanalyze?.running && (
            <div className="bg-emerald-50/80 rounded-xl p-3 space-y-2">
              <div className="text-xs font-medium text-emerald-700">知识增强重分析</div>
              <ProgressBar
                current={reanalyze.processed + reanalyze.failed}
                total={reanalyze.total}
                label={`成功 ${reanalyze.processed} / 失败 ${reanalyze.failed}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Worker Actions */}
      <div className="glass-card rounded-2xl p-4">
        <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Zap size={15} className="text-gray-500" />
          引擎操作
        </div>
        <div className="space-y-2">
          <WorkerButton
            label="知识蒸馏"
            desc="L1→L2 纵向总结 → L3 横向洞察 → L4 行动指引"
            icon={Layers}
            endpoint="distill"
            onResult={setWorkerMsg}
          />
          <WorkerButton
            label="探索性发现"
            desc="扫描已有知识，发现跨领域关联"
            icon={Search}
            endpoint="explore"
            onResult={setWorkerMsg}
          />
          <WorkerButton
            label="质量衰减"
            desc="降低过时知识评分 + 自动归档"
            icon={TrendingUp}
            endpoint="decay"
            onResult={setWorkerMsg}
          />
          <WorkerButton
            label="Bootstrap 提取"
            desc="从历史数据提取初始知识"
            icon={Database}
            endpoint="bootstrap"
            onResult={setWorkerMsg}
          />
          <WorkerButton
            label="对话分析"
            desc="分析智库对话，发现知识缺口"
            icon={MessageSquare}
            endpoint="chat-analysis"
            onResult={setWorkerMsg}
          />
          <WorkerButton
            label="行为分析"
            desc="分析用户使用行为，发现管理信号"
            icon={Activity}
            endpoint="behavior-analysis"
            onResult={setWorkerMsg}
          />
          <WorkerButton
            label="效果评估"
            desc="评估已解决行动项的改善效果"
            icon={CheckCircle2}
            endpoint="impact-evaluation"
            onResult={setWorkerMsg}
          />
          <button
            onClick={handleReanalysis}
            disabled={reanalyze?.running}
            className="glass-card rounded-xl p-3 flex items-center gap-3 w-full text-left active:bg-gray-50 disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              {reanalyze?.running ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900">知识增强重分析</div>
              <div className="text-xs text-gray-500 truncate">
                {reanalyze?.running
                  ? `进行中 ${reanalyze.processed}/${reanalyze.total}`
                  : '用知识注入重新分析所有历史录音'}
              </div>
            </div>
          </button>
        </div>

        {workerMsg && (
          <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5">
            {workerMsg}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Review Components ──────────────────────────────────────────────

function KnowledgeCard({
  entry,
  onAction,
}: {
  entry: KnowledgeEntry;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [acting, setActing] = useState(false);
  const TypeIcon = TYPE_CONFIG[entry.knowledge_type]?.icon || Brain;
  const typeConfig = TYPE_CONFIG[entry.knowledge_type];
  const depthLevel = entry.depth_level || 'L1';

  const handleAction = useCallback(
    async (action: 'approve' | 'revise' | 'reject') => {
      if ((action === 'revise' || action === 'reject') && !noteText.trim()) {
        return;
      }
      setActing(true);
      const ok = await reviewAction(entry.id, action, noteText || undefined);
      setActing(false);
      if (ok) {
        setNoteText('');
        onAction();
      }
    },
    [entry.id, noteText, onAction],
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${typeConfig?.color || 'bg-gray-100 text-gray-600'}`}
        >
          <TypeIcon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {entry.title || `${typeConfig?.label || entry.knowledge_type} 知识`}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
              {SCOPE_LABELS[entry.scope]}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {relativeTime(entry.created_at)}
            </span>
            <span className={`font-mono text-[10px] px-1 py-0.5 rounded ${
              depthLevel === 'L1' ? 'bg-blue-50 text-blue-600' :
              depthLevel === 'L2' ? 'bg-emerald-50 text-emerald-600' :
              depthLevel === 'L3' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
            }`}>
              {depthLevel}
            </span>
            <span>
              置信度 {Math.round((entry.confidence ?? 0.5) * 100)}%
            </span>
            {entry.version > 1 && <span>v{entry.version}</span>}
          </div>
          {entry.category && (
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">{entry.category}</span>
              {entry.source_signal && SOURCE_LABELS[entry.source_signal] && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">
                  来自{SOURCE_LABELS[entry.source_signal]}
                  {entry.source_record_id ? ` #${entry.source_record_id.slice(0, 8)}` : ''}
                </span>
              )}
              {Boolean((entry.content as Record<string, unknown>)?.impact_verified) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                  已验证有效 +{Math.round(Number((entry.content as Record<string, unknown>)?.impact_delta) || 0)}分
                </span>
              )}
              {String((entry.content as Record<string, unknown>)?.source_type_tag) === 'experience' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">
                  经验
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 mt-1">
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Knowledge content */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">
              知识内容
            </div>
            <div className="text-sm text-gray-700 bg-gray-50/80 rounded-xl p-3 whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-60 overflow-y-auto">
              {formatContent(entry.content)}
            </div>
          </div>

          {/* Previous reviewer note */}
          {entry.reviewer_note && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">
                审核意见 ({entry.reviewed_by}, {entry.reviewed_at ? relativeTime(entry.reviewed_at) : ''})
              </div>
              <div className="text-sm text-amber-700 bg-amber-50/80 rounded-xl p-3">
                {entry.reviewer_note}
              </div>
            </div>
          )}

          {/* Review actions (only for pending_review or revision_requested) */}
          {(entry.review_status === 'pending_review' ||
            entry.review_status === 'revision_requested') && (
            <div className="space-y-2 pt-1">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="审核意见（驳回/修改时必填）..."
                className="w-full text-sm rounded-xl border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={acting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium active:bg-emerald-600 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  批准
                </button>
                <button
                  onClick={() => handleAction('revise')}
                  disabled={acting || !noteText.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium active:bg-amber-600 disabled:opacity-50"
                >
                  <MessageSquare size={15} />
                  修改
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={acting || !noteText.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 text-white text-sm font-medium active:bg-red-600 disabled:opacity-50"
                >
                  <XCircle size={15} />
                  驳回
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-28 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );
}

function ReviewView() {
  const [activeTab, setActiveTab] = useState<ReviewStatus | 'all'>('pending_review');
  const [typeFilter, setTypeFilter] = useState<KnowledgeType | ''>('');
  const [depthFilter, setDepthFilter] = useState<string>('');
  const [categoryGroup, setCategoryGroup] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Build query URL
  const buildUrl = () => {
    if (activeTab === 'all') {
      const params = new URLSearchParams();
      if (typeFilter) params.set('knowledge_type', typeFilter);
      return `/api/knowledge/list?${params.toString()}`;
    }
    const params = new URLSearchParams({ status: activeTab });
    if (typeFilter) params.set('knowledge_type', typeFilter);
    return `/api/knowledge/review-queue?${params.toString()}`;
  };

  const swrKey = buildUrl();
  const { data: res, isLoading } = useSWR<{ data: KnowledgeEntry[]; count?: number }>(swrKey);
  let entries = res?.data || [];

  // Client-side depth filter (API doesn't support it)
  if (depthFilter) {
    entries = entries.filter(e => (e.depth_level || 'L1') === depthFilter);
  }

  // Client-side category group filter
  if (categoryGroup !== 'all') {
    const group = CATEGORY_GROUPS.find(g => g.value === categoryGroup);
    if (group) {
      entries = entries.filter(e => group.categories.includes(e.category || ''));
    }
  }

  const pendingUrl = '/api/knowledge/review-queue?status=pending_review';
  const { data: pendingRes } = useSWR<{ data: KnowledgeEntry[]; count?: number }>(pendingUrl);
  const pendingCount = pendingRes?.data?.length || 0;

  const handleAction = () => {
    mutate(swrKey);
    mutate(pendingUrl);
  };

  const activeFilterCount = (typeFilter ? 1 : 0) + (depthFilter ? 1 : 0) + (categoryGroup !== 'all' ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Pending badge */}
      {pendingCount > 0 && activeTab !== 'pending_review' && (
        <button
          onClick={() => setActiveTab('pending_review')}
          className="w-full glass-card rounded-xl p-2.5 flex items-center gap-2 text-left"
        >
          <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
            {pendingCount}
          </div>
          <span className="text-xs text-gray-600">条知识待审核</span>
        </button>
      )}

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category Group Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORY_GROUPS.map((group) => (
          <button
            key={group.value}
            onClick={() => setCategoryGroup(group.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              categoryGroup === group.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            {group.label}
          </button>
        ))}
      </div>

      {/* Filters toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-1.5 text-xs text-gray-500 active:text-gray-700"
      >
        <Filter size={13} />
        筛选
        {activeFilterCount > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-primary-50 text-primary-600 text-[11px]">
            {activeFilterCount}
          </span>
        )}
      </button>

      {showFilters && (
        <div className="glass-card rounded-xl p-3 space-y-3">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">知识类型</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTypeFilter('')}
                className={`px-2.5 py-1 rounded-lg text-xs ${
                  !typeFilter ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-500'
                }`}
              >
                全部
              </button>
              {(Object.keys(TYPE_CONFIG) as KnowledgeType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type === typeFilter ? '' : type)}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    typeFilter === type ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">知识层级</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setDepthFilter('')}
                className={`px-2.5 py-1 rounded-lg text-xs ${
                  !depthFilter ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-500'
                }`}
              >
                全部
              </button>
              {Object.entries(DEPTH_LABELS).map(([level, config]) => (
                <button
                  key={level}
                  onClick={() => setDepthFilter(level === depthFilter ? '' : level)}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    depthFilter === level ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Knowledge entries */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map((entry) => (
            <KnowledgeCard
              key={entry.id}
              entry={entry}
              onAction={handleAction}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Brain className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <div className="text-sm text-gray-400">
            {activeTab === 'pending_review'
              ? '暂无待审核的知识'
              : '暂无知识条目'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function KnowledgeReviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<PageView>('dashboard');

  const isAuthorized = ['hr901027', 'Jeremy', 'hengwu', 'liuyun', 'yangxue', 'chenhua', 'xuguangquan', 'fanshucen', 'geyi'].includes(user?.username ?? '');

  // Access guard
  if (user && !isAuthorized) {
    router.replace('/admin/briefing');
    return null;
  }
  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="island-header glass-nav px-[1.125rem] py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Brain size={20} className="text-gray-600" />
          知识引擎
        </h1>
        <UserMenu />
      </header>

      <div className="px-4 space-y-3 island-page-top island-page-bottom">
        {/* View Tabs */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === 'dashboard'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            <BarChart3 size={14} />
            总览
          </button>
          <button
            onClick={() => setView('review')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === 'review'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            <ClipboardCheck size={14} />
            审核
          </button>
        </div>

        {/* View Content */}
        {view === 'dashboard' ? <DashboardView /> : <ReviewView />}
      </div>
    </div>
  );
}
