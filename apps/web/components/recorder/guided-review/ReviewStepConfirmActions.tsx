// Step 3: Confirm Action Items — Review and confirm AI-extracted action items
// v2.0 - Better empty state, allow confirming with 0 items (skip), optimistic UX

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Check, Plus, Trash2, Edit3, X, ListChecks } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';
import { ROLE_OPTIONS, ROLE_LABELS } from './types';
import type { EditableActionItem } from './types';
import type { MeetingRecord } from '@/hooks/useMeetingStore';

interface ReviewStepConfirmActionsProps {
  meeting: MeetingRecord | null;
  restaurantId: string | undefined;
  onConfirmed: (count: number) => void;
}

function meetingItemsToEditable(
  items: Array<{ who: string; what: string; deadline: string }> | undefined,
): EditableActionItem[] {
  if (!items || items.length === 0) return [];
  return items.map((item, idx) => ({
    id: `ai-${idx}`,
    suggestion_text: item.what,
    assigned_role: mapWhoToRole(item.who),
    deadline: item.deadline || '',
  }));
}

function mapWhoToRole(who: string): string {
  if (!who) return 'manager';
  const lower = who.toLowerCase();
  if (lower.includes('厨师') || lower.includes('chef') || lower.includes('后厨')) return 'head_chef';
  if (lower.includes('前厅') || lower.includes('主管') || lower.includes('front')) return 'front_of_house';
  if (lower.includes('全') || lower.includes('all') || lower.includes('大家')) return 'all';
  return 'manager';
}

export function ReviewStepConfirmActions({
  meeting,
  restaurantId,
  onConfirmed,
}: ReviewStepConfirmActionsProps) {
  const [items, setItems] = useState<EditableActionItem[]>(() =>
    meetingItemsToEditable(meeting?.actionItems)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ suggestion_text: '', assigned_role: 'manager', deadline: '' });

  const activeItems = useMemo(() => items.filter(i => !i.isDeleted), [items]);
  const hasAiItems = items.some(i => !i.isNew);

  const handleEdit = useCallback((id: string, field: keyof EditableActionItem, value: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, isDeleted: true } : item
    ));
  }, []);

  const handleRestore = useCallback((id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, isDeleted: false } : item
    ));
  }, []);

  const handleAddNew = useCallback(() => {
    if (!newItem.suggestion_text.trim()) return;
    setItems(prev => [...prev, {
      id: `new-${Date.now()}`,
      suggestion_text: newItem.suggestion_text.trim(),
      assigned_role: newItem.assigned_role,
      deadline: newItem.deadline,
      isNew: true,
    }]);
    setNewItem({ suggestion_text: '', assigned_role: 'manager', deadline: '' });
    setShowAddForm(false);
  }, [newItem]);

  const handleConfirm = useCallback(async () => {
    if (!restaurantId) return;
    setSubmitting(true);

    try {
      if (activeItems.length > 0) {
        // Single batch request instead of N individual POSTs
        const res = await fetch(getApiUrl('api/action-items/batch-create'), {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurant_id: restaurantId,
            source_meeting_id: meeting?.id || null,
            items: activeItems.map(item => ({
              suggestion_text: item.suggestion_text,
              assigned_role: item.assigned_role || null,
              deadline: item.deadline || null,
            })),
          }),
        });
        if (res.ok) {
          const result = await res.json();
          onConfirmed(result.count ?? activeItems.length);
        } else {
          // API error — still move forward, report 0
          onConfirmed(0);
        }
      } else {
        onConfirmed(0);
      }
    } catch {
      // Network failure — report 0, not fake success
      onConfirmed(0);
    } finally {
      setSubmitting(false);
    }
  }, [restaurantId, activeItems, meeting?.id, onConfirmed]);

  // Auto-show add form when AI extracted nothing
  const showEmptyState = items.length === 0;

  return (
    <div className="flex flex-col min-h-[calc(100vh-160px)]">
      <div className="flex-1">
        {/* Title */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">确认行动项</h2>
          </div>
          {activeItems.length > 0 && (
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full font-medium">
              {activeItems.length}项
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          {hasAiItems
            ? 'AI 从讨论中提取了以下行动项，确认无误后提交'
            : '可以手动添加会议中讨论的行动项'}
        </p>

        {/* Empty state — prominent add button */}
        {showEmptyState ? (
          <div className="glass-card rounded-2xl p-6 text-center mb-3">
            <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-1">AI 未提取到行动项</p>
            <p className="text-xs text-gray-400">
              可能是录音时间太短或内容不够清晰
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> 手动添加
            </button>
          </div>
        ) : (
          /* Action items list */
          <div className="space-y-2">
            {items.map(item => {
              const isEditing = editingId === item.id;

              if (item.isDeleted) {
                return (
                  <div key={item.id} className="glass-card rounded-xl p-3 opacity-40 flex items-center justify-between">
                    <span className="text-sm text-gray-400 line-through flex-1">{item.suggestion_text}</span>
                    <button
                      onClick={() => handleRestore(item.id)}
                      className="text-xs text-primary-500 hover:text-primary-700 px-2 py-1"
                    >
                      撤销
                    </button>
                  </div>
                );
              }

              if (isEditing) {
                return (
                  <div key={item.id} className="glass-card rounded-xl p-3 border-2 border-primary-200 space-y-2">
                    <textarea
                      value={item.suggestion_text}
                      onChange={(e) => handleEdit(item.id, 'suggestion_text', e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-primary-300"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <select
                        value={item.assigned_role}
                        onChange={(e) => handleEdit(item.id, 'assigned_role', e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary-300"
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={item.deadline}
                        onChange={(e) => handleEdit(item.id, 'deadline', e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary-300"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs bg-primary-500 text-white px-3 py-1 rounded-lg hover:bg-primary-600"
                      >
                        完成
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.id} className="glass-card rounded-xl p-3 flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{item.suggestion_text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        {ROLE_LABELS[item.assigned_role] || item.assigned_role}
                      </span>
                      {item.deadline && (
                        <span className="text-xs text-gray-400">截止 {item.deadline}</span>
                      )}
                      {item.isNew && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">手动</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingId(item.id)}
                      className="p-1.5 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-primary-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new item form/button */}
        {showAddForm ? (
          <div className={`${showEmptyState ? '' : 'mt-3'} glass-card rounded-xl p-3 border-2 border-dashed border-primary-200 space-y-2`}>
            <textarea
              value={newItem.suggestion_text}
              onChange={(e) => setNewItem(prev => ({ ...prev, suggestion_text: e.target.value }))}
              placeholder="输入行动项内容…"
              className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-primary-300"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <select
                value={newItem.assigned_role}
                onChange={(e) => setNewItem(prev => ({ ...prev, assigned_role: e.target.value }))}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={newItem.deadline}
                onChange={(e) => setNewItem(prev => ({ ...prev, deadline: e.target.value }))}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddForm(false); setNewItem({ suggestion_text: '', assigned_role: 'manager', deadline: '' }); }}
                className="text-xs text-gray-500 px-3 py-1 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddNew}
                disabled={!newItem.suggestion_text.trim()}
                className="text-xs bg-primary-500 text-white px-3 py-1 rounded-lg hover:bg-primary-600 disabled:opacity-40"
              >
                添加
              </button>
            </div>
          </div>
        ) : !showEmptyState ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:text-primary-500 hover:border-primary-200 transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> 手动添加行动项
          </button>
        ) : null}
      </div>

      {/* Bottom buttons */}
      <div className="mt-4">
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-1 ${
            submitting ? 'bg-gray-300 text-gray-500' : 'bg-primary-500 text-white hover:bg-primary-600'
          }`}
        >
          {submitting ? '提交中…' : activeItems.length > 0 ? (
            <><Check className="w-4 h-4" /> 确认提交 ({activeItems.length}项)</>
          ) : (
            '无需行动，完成复盘'
          )}
        </button>
      </div>
    </div>
  );
}
