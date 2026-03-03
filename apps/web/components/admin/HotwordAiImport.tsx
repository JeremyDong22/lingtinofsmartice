// Hotword AI Import Panel - Extract hotwords from text using AI (menu/general modes)
// v1.0

'use client';

import { useState } from 'react';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';

interface ExtractedWord {
  text: string;
  weight: number;
  category: string;
}

interface HotwordAiImportProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function HotwordAiImport({ open, onClose, onImported }: HotwordAiImportProps) {
  const [mode, setMode] = useState<'menu' | 'general'>('menu');
  const [inputText, setInputText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [results, setResults] = useState<ExtractedWord[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  // AI extract
  const handleExtract = async () => {
    if (!inputText.trim()) return;
    setExtracting(true);
    setResults([]);
    setSelected(new Set());

    try {
      const res = await fetch(getApiUrl('api/hotwords/ai-extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ text: inputText.trim(), mode }),
      });
      if (!res.ok) throw new Error('提取失败');
      const data = await res.json();
      const words: ExtractedWord[] = data.data || [];
      setResults(words);
      // Auto-select all
      setSelected(new Set(words.map((_, i) => i)));
    } catch {
      alert('AI 提取失败，请重试');
    } finally {
      setExtracting(false);
    }
  };

  // Toggle selection
  const toggle = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  };

  // Batch import selected
  const handleImport = async () => {
    const items = results
      .filter((_, i) => selected.has(i))
      .map((w) => ({
        text: w.text,
        weight: w.weight,
        category: w.category,
        source: 'ai_import',
      }));
    if (items.length === 0) return;

    setImporting(true);
    try {
      const res = await fetch(getApiUrl('api/hotwords/batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('导入失败');
      onImported();
      setResults([]);
      setInputText('');
      onClose();
    } catch {
      alert('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  const CATEGORY_LABELS: Record<string, string> = {
    dish_name: '菜品',
    brand: '品牌',
    service_term: '服务',
    other: '其他',
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">AI 提取热词</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex px-4 pt-3 gap-2">
          <button
            onClick={() => setMode('menu')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              mode === 'menu' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            菜单文本
          </button>
          <button
            onClick={() => setMode('general')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              mode === 'general' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            通用文本
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Text input */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {mode === 'menu' ? '粘贴菜单内容' : '粘贴任意文本'}
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={5}
              placeholder={mode === 'menu'
                ? '酸菜鱼 68元\n红烧肉 48元\n宫保鸡丁 38元...'
                : '巴奴毛肚火锅的招牌毛肚，鲜鸭血也值得推荐...'
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <button
            onClick={handleExtract}
            disabled={!inputText.trim() || extracting}
            className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700"
          >
            {extracting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                AI 分析中...
              </span>
            ) : (
              'AI 提取'
            )}
          </button>

          {/* Results */}
          {results.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">
                  提取结果（{results.length}）
                </h4>
                <button
                  onClick={() => setSelected(new Set(results.map((_, i) => i)))}
                  className="text-xs text-primary-600 hover:underline"
                >
                  全选
                </button>
              </div>
              <div className="space-y-1">
                {results.map((word, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggle(idx)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selected.has(idx) ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      readOnly
                      className="rounded"
                    />
                    <span className="flex-1 text-sm font-medium text-gray-900">{word.text}</span>
                    <span className="text-xs text-gray-500">
                      {CATEGORY_LABELS[word.category] || word.category}
                    </span>
                    <span className="text-xs text-blue-600 font-mono">
                      {word.weight > 0 ? `+${word.weight}` : word.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700"
            >
              {importing ? '导入中...' : `添加选中（${selected.size}）`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
