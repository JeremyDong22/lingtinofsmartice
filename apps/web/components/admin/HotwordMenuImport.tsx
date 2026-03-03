// Hotword Menu Import Panel - Import dish names from menu with diff preview
// v1.0

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';

interface MenuDiffResponse {
  data: {
    newDishes: string[];
    existing: string[];
    removed: string[];
  };
}

interface HotwordMenuImportProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function HotwordMenuImport({ open, onClose, onImported }: HotwordMenuImportProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Fetch menu diff when panel is open
  const { data, isLoading } = useSWR<MenuDiffResponse>(
    open ? '/api/hotwords/menu-diff' : null,
  );

  if (!open) return null;

  const diff = data?.data;
  const newDishes = diff?.newDishes || [];
  const existing = diff?.existing || [];
  const removed = diff?.removed || [];

  // Toggle selection
  const toggle = (dish: string) => {
    const next = new Set(selected);
    if (next.has(dish)) next.delete(dish);
    else next.add(dish);
    setSelected(next);
  };

  // Select all new dishes
  const selectAllNew = () => {
    setSelected(new Set(newDishes));
  };

  // Import selected dishes
  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const res = await fetch(getApiUrl('api/hotwords/menu-import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ dishes: Array.from(selected) }),
      });
      if (!res.ok) throw new Error('导入失败');
      onImported();
      setSelected(new Set());
      onClose();
    } catch {
      alert('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">菜单导入</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* New dishes */}
              {newDishes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-green-700">
                      新增菜品（{newDishes.length}）
                    </h4>
                    <button onClick={selectAllNew} className="text-xs text-primary-600 hover:underline">
                      全选
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {newDishes.map((dish) => (
                      <button
                        key={dish}
                        onClick={() => toggle(dish)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          selected.has(dish)
                            ? 'bg-green-100 border-green-400 text-green-800'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-green-300'
                        }`}
                      >
                        {selected.has(dish) && '+ '}{dish}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Already existing */}
              {existing.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">
                    已存在（{existing.length}）
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {existing.map((dish) => (
                      <span key={dish} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-400">
                        {dish}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Removed from menu */}
              {removed.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2">
                    已下架（{removed.length}）
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {removed.map((dish) => (
                      <span key={dish} className="px-2.5 py-1 rounded-full text-xs bg-red-50 text-red-400 line-through">
                        {dish}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {newDishes.length === 0 && existing.length === 0 && removed.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">暂无菜单数据</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700"
          >
            {importing ? '导入中...' : `导入选中（${selected.size}）`}
          </button>
        </div>
      </div>
    </div>
  );
}
