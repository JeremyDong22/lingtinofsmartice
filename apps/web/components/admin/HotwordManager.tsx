// Hotword Manager - Main orchestrator: stats bar + action buttons + table + sync
// v1.0

'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';
import { HotwordTable, type HotwordItem } from './HotwordTable';
import { HotwordAddModal } from './HotwordAddModal';
import { HotwordMenuImport } from './HotwordMenuImport';
import { HotwordAiImport } from './HotwordAiImport';

interface StatsResponse {
  data: {
    total: number;
    enabled: number;
    lastSync: {
      synced_at: string;
      word_count: number;
      status: string;
      error_message: string | null;
    } | null;
  };
}

interface ListResponse {
  data: HotwordItem[];
}

// Shared mutate key
const STATS_KEY = '/api/hotwords/stats';

export function HotwordManager() {
  // Search and filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [showMenuImport, setShowMenuImport] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Build list query key with filters
  const listKey = `/api/hotwords?search=${encodeURIComponent(search)}&category=${categoryFilter}`;

  // Fetch stats and list
  const { data: statsData } = useSWR<StatsResponse>(STATS_KEY);
  const { data: listData, isLoading } = useSWR<ListResponse>(listKey);

  const stats = statsData?.data;
  const hotwords = listData?.data || [];

  // Refresh all data (stats + current list view)
  const refreshAll = useCallback(() => {
    mutate(STATS_KEY);
    mutate(listKey);
  }, [listKey]);

  // Add single hotword
  const handleAdd = async (data: { text: string; weight: number; category: string }) => {
    try {
      const res = await fetch(getApiUrl('api/hotwords'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || '添加失败');
        return;
      }
      refreshAll();
    } catch {
      alert('添加失败');
    }
  };

  // Update hotword
  const handleUpdate = async (id: string, data: { weight?: number; category?: string; is_enabled?: boolean }) => {
    try {
      const res = await fetch(getApiUrl(`api/hotwords/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      refreshAll();
    } catch {
      alert('更新失败');
    }
  };

  // Delete single hotword
  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此热词？')) return;
    try {
      const res = await fetch(getApiUrl(`api/hotwords/${id}`), {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error();
      refreshAll();
    } catch {
      alert('删除失败');
    }
  };

  // Batch delete selected
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确认删除选中的 ${selectedIds.size} 个热词？`)) return;
    try {
      const res = await fetch(getApiUrl('api/hotwords/batch'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      setSelectedIds(new Set());
      refreshAll();
    } catch {
      alert('批量删除失败');
    }
  };

  // Sync to DashScope
  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(getApiUrl('api/hotwords/sync'), {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '同步失败');
      }
      const result = await res.json();
      setSyncMessage({ type: 'success', text: `同步成功：${result.data?.wordCount || 0} 个热词` });
      refreshAll();
    } catch (err) {
      setSyncMessage({ type: 'error', text: err instanceof Error ? err.message : '同步失败' });
    } finally {
      setSyncing(false);
    }
  };

  // Format last sync time
  const formatSyncTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">语音热词</h3>
          <span className="text-xs text-gray-400">DashScope 词表</span>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{stats?.enabled ?? '-'}</span>
              <span className="text-gray-400"> / 500</span> 已启用
            </span>
            <span className="text-gray-400">{stats?.total ?? '-'} 总计</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, ((stats?.enabled || 0) / 500) * 100)}%` }}
            />
          </div>
        </div>

        {/* Last sync info */}
        <div className="text-xs text-gray-400">
          {stats?.lastSync ? (
            <>
              最后同步：{formatSyncTime(stats.lastSync.synced_at)}{' '}
              {stats.lastSync.status === 'success' ? (
                <span className="text-green-600">成功</span>
              ) : (
                <span className="text-red-500">失败</span>
              )}
            </>
          ) : (
            '尚未同步'
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
        >
          + 添加
        </button>
        <button
          onClick={() => setShowMenuImport(true)}
          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
        >
          菜单导入
        </button>
        <button
          onClick={() => setShowAiImport(true)}
          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
        >
          AI 提取
        </button>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBatchDelete}
            className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-100"
          >
            删除选中（{selectedIds.size}）
          </button>
        )}
      </div>

      {/* Hotword table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <HotwordTable
          hotwords={hotwords}
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {/* Sync button */}
      <div className="pt-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {syncing ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              同步中...
            </>
          ) : (
            '同步到 DashScope'
          )}
        </button>

        {/* Sync feedback message */}
        {syncMessage && (
          <p className={`text-center text-xs mt-2 ${syncMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {syncMessage.text}
          </p>
        )}
      </div>

      {/* Modals */}
      <HotwordAddModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      <HotwordMenuImport open={showMenuImport} onClose={() => setShowMenuImport(false)} onImported={refreshAll} />
      <HotwordAiImport open={showAiImport} onClose={() => setShowAiImport(false)} onImported={refreshAll} />
    </div>
  );
}
