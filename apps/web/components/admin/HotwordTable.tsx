// Hotword Table - Searchable/filterable list with inline edit and selection
// v1.0

'use client';

import { useState } from 'react';

export interface HotwordItem {
  id: string;
  text: string;
  weight: number;
  category: string;
  source: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Category display labels
const CATEGORY_LABELS: Record<string, string> = {
  dish_name: '菜品',
  brand: '品牌',
  service_term: '服务',
  other: '其他',
};

const CATEGORY_COLORS: Record<string, string> = {
  dish_name: 'bg-orange-100 text-orange-700',
  brand: 'bg-purple-100 text-purple-700',
  service_term: 'bg-blue-100 text-blue-700',
  other: 'bg-gray-100 text-gray-600',
};

interface HotwordTableProps {
  hotwords: HotwordItem[];
  search: string;
  onSearchChange: (val: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onUpdate: (id: string, data: { weight?: number; category?: string; is_enabled?: boolean }) => void;
  onDelete: (id: string) => void;
}

export function HotwordTable({
  hotwords,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  selectedIds,
  onSelectionChange,
  onUpdate,
  onDelete,
}: HotwordTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<number>(3);
  const [editCategory, setEditCategory] = useState<string>('other');

  // Start inline editing
  const startEdit = (hw: HotwordItem) => {
    setEditingId(hw.id);
    setEditWeight(hw.weight);
    setEditCategory(hw.category);
  };

  // Save inline edit
  const saveEdit = (id: string) => {
    onUpdate(id, { weight: editWeight, category: editCategory });
    setEditingId(null);
  };

  // Toggle all selection
  const toggleAll = () => {
    if (selectedIds.size === hotwords.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(hotwords.map((h) => h.id)));
    }
  };

  // Toggle single selection
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  return (
    <div>
      {/* Search + Filter bar */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="搜索热词..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">全部分类</option>
          <option value="dish_name">菜品</option>
          <option value="brand">品牌</option>
          <option value="service_term">服务</option>
          <option value="other">其他</option>
        </select>
      </div>

      {/* Table */}
      {hotwords.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {search || categoryFilter ? '没有匹配的热词' : '暂无热词，点击上方按钮添加'}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === hotwords.length && hotwords.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">热词</th>
                <th className="w-16 px-2 py-2 text-center font-medium text-gray-600">权重</th>
                <th className="w-16 px-2 py-2 text-center font-medium text-gray-600">分类</th>
                <th className="w-20 px-2 py-2 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hotwords.map((hw) => (
                <tr key={hw.id} className={`${!hw.is_enabled ? 'opacity-50' : ''}`}>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(hw.id)}
                      onChange={() => toggleOne(hw.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900">{hw.text}</span>
                    {!hw.is_enabled && (
                      <span className="ml-1 text-xs text-gray-400">(已禁用)</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {editingId === hw.id ? (
                      <select
                        value={editWeight}
                        onChange={(e) => setEditWeight(Number(e.target.value))}
                        className="w-14 text-xs border rounded px-1 py-0.5"
                      >
                        {[5, 4, 3, 2, 1, -1, -2, -3, -4, -5, -6].map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                        hw.weight >= 4 ? 'bg-green-100 text-green-700' :
                        hw.weight >= 1 ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {hw.weight > 0 ? `+${hw.weight}` : hw.weight}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {editingId === hw.id ? (
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-16 text-xs border rounded px-1 py-0.5"
                      >
                        <option value="dish_name">菜品</option>
                        <option value="brand">品牌</option>
                        <option value="service_term">服务</option>
                        <option value="other">其他</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${CATEGORY_COLORS[hw.category] || CATEGORY_COLORS.other}`}>
                        {CATEGORY_LABELS[hw.category] || hw.category}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {editingId === hw.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => saveEdit(hw.id)}
                          className="text-green-600 hover:text-green-800 text-xs"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onUpdate(hw.id, { is_enabled: !hw.is_enabled })}
                          className={`text-xs ${hw.is_enabled ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
                          title={hw.is_enabled ? '禁用' : '启用'}
                        >
                          {hw.is_enabled ? '禁' : '启'}
                        </button>
                        <button
                          onClick={() => startEdit(hw)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                          title="编辑"
                        >
                          编
                        </button>
                        <button
                          onClick={() => onDelete(hw.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                          title="删除"
                        >
                          删
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
