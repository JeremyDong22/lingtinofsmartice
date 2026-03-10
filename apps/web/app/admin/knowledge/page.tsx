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
  review_status: ReviewStatus;
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
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
      lines.push(`${key}: ${val.join(', ')}`);
    } else if (val && typeof val === 'object') {
      lines.push(`${key}: ${JSON.stringify(val)}`);
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

// ─── Components ─────────────────────────────────────────────────────

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
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {relativeTime(entry.created_at)}
            </span>
            <span>
              置信度 {Math.round((entry.confidence ?? 0.5) * 100)}%
            </span>
            {entry.version > 1 && <span>v{entry.version}</span>}
            {entry.source_type && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-gray-50 text-gray-400">
                {entry.source_type}
              </span>
            )}
          </div>
          {entry.category && (
            <div className="mt-1 text-xs text-gray-400">
              {entry.category}
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

// ─── Main Page ──────────────────────────────────────────────────────

export default function KnowledgeReviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReviewStatus | 'all'>('pending_review');
  const [typeFilter, setTypeFilter] = useState<KnowledgeType | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const isAuthorized = user?.username === 'hr901027';

  // Build query URL
  const buildUrl = () => {
    if (!isAuthorized) return null;
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
  const { data: res, isLoading } = useSWR<{ data: KnowledgeEntry[]; count?: number }>(
    swrKey,
  );
  const entries = res?.data || [];

  const pendingUrl = isAuthorized
    ? '/api/knowledge/review-queue?status=pending_review'
    : null;
  const { data: pendingRes } = useSWR<{ data: KnowledgeEntry[]; count?: number }>(
    pendingUrl,
  );
  const pendingCount = pendingRes?.data?.length || 0;

  // Access guard
  if (user && !isAuthorized) {
    router.replace('/admin/briefing');
    return null;
  }
  if (!isAuthorized) return null;

  const handleAction = () => {
    mutate(swrKey);
    mutate(pendingUrl);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="island-header glass-nav px-[1.125rem] py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Brain size={20} className="text-gray-600" />
          知识审核
          {pendingCount > 0 && (
            <span className="text-xs font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </h1>
        <UserMenu />
      </header>

      <div className="px-4 space-y-3 island-page-top island-page-bottom">
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

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 text-xs text-gray-500 active:text-gray-700"
        >
          <Filter size={13} />
          筛选
          {typeFilter && (
            <span className="px-1.5 py-0.5 rounded bg-primary-50 text-primary-600 text-[11px]">
              {TYPE_CONFIG[typeFilter]?.label}
            </span>
          )}
        </button>

        {showFilters && (
          <div className="glass-card rounded-xl p-3">
            <div className="text-xs font-medium text-gray-500 mb-2">知识类型</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTypeFilter('')}
                className={`px-2.5 py-1 rounded-lg text-xs ${
                  !typeFilter
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-50 text-gray-500'
                }`}
              >
                全部
              </button>
              {(Object.keys(TYPE_CONFIG) as KnowledgeType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type === typeFilter ? '' : type)}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    typeFilter === type
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {TYPE_CONFIG[type].label}
                </button>
              ))}
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
    </div>
  );
}
