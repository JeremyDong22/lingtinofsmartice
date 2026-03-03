// Hotword Add Modal - Simple modal to add a single hotword
// v1.0

'use client';

import { useState } from 'react';

interface HotwordAddModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { text: string; weight: number; category: string }) => void;
}

export function HotwordAddModal({ open, onClose, onAdd }: HotwordAddModalProps) {
  const [text, setText] = useState('');
  const [weight, setWeight] = useState(3);
  const [category, setCategory] = useState('dish_name');

  if (!open) return null;

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), weight, category });
    setText('');
    setWeight(3);
    setCategory('dish_name');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">添加热词</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">热词（1-10字）</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={10}
              placeholder="如：酸菜鱼"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">权重</label>
              <select
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={5}>+5（最高增强）</option>
                <option value={4}>+4</option>
                <option value={3}>+3（默认）</option>
                <option value={2}>+2</option>
                <option value={1}>+1</option>
                <option value={-1}>-1（轻度抑制）</option>
                <option value={-2}>-2</option>
                <option value={-3}>-3</option>
                <option value={-4}>-4</option>
                <option value={-5}>-5</option>
                <option value={-6}>-6（最强抑制）</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="dish_name">菜品</option>
                <option value="brand">品牌</option>
                <option value="service_term">服务</option>
                <option value="other">其他</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || text.trim().length > 10}
            className="flex-1 px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}
