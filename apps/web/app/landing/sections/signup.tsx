'use client';

import { useState, useRef, FormEvent } from 'react';
import { getApiUrl } from '@/lib/api';
import { INITIAL_FORM, STORE_COUNT_OPTIONS, REVENUE_OPTIONS } from '../data';
import type { SignupForm } from '../data';

export function SignupSection({ track }: { track: (type: 'form_start' | 'form_submit', payload?: Record<string, unknown>) => void }) {
  const [form, setForm] = useState<SignupForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const formStartedRef = useRef(false);

  const updateField = (field: keyof SignupForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.brand.trim() || !form.category.trim() || !form.name.trim() ||
        !form.position.trim() || !form.phone.trim() || !form.city.trim()) {
      setError('请填写所有必填项');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) {
      setError('请输入有效的 11 位手机号');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        brand: form.brand.trim(),
        category: form.category.trim(),
        name: form.name.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
      };
      if (form.age) payload.age = Number(form.age);
      if (form.store_count) payload.store_count = form.store_count;
      if (form.annual_revenue) payload.annual_revenue = form.annual_revenue;
      if (form.help_text.trim()) payload.help_text = form.help_text.trim();

      const res = await fetch(getApiUrl('api/beta-signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `提交失败 (${res.status})`);
      }

      setSubmitted(true);
      track('form_submit');
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section id="signup" className="py-20 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="glass-card rounded-2xl p-10">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">申请已提交</h2>
            <p className="text-gray-500 leading-relaxed">
              我们已收到您的信息，技术团队将在 3 个工作日内与您联系，
              <br />
              共同探讨智能化经营的落地方案。
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="signup" className="py-20 px-4 bg-gradient-to-b from-transparent via-primary-50/20 to-transparent">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-semibold tracking-widest text-primary-500 uppercase mb-3">
            Beta Program
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            申请内测合作
          </h2>
          <p className="text-gray-500 text-lg text-justify sm:text-center">
            名额有限，我们将优先邀请与产品方向最匹配的品牌伙伴
          </p>
        </div>

        <form onSubmit={handleSubmit} onFocus={() => {
          if (!formStartedRef.current) {
            formStartedRef.current = true;
            track('form_start');
          }
        }} className="glass-card rounded-2xl p-6 md:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="品牌名称" required value={form.brand} onChange={(v) => updateField('brand', v)} placeholder="例：海底捞" />
            <FormField label="品类" required value={form.category} onChange={(v) => updateField('category', v)} placeholder="例：火锅、川菜" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="姓名" required value={form.name} onChange={(v) => updateField('name', v)} placeholder="您的姓名" />
            <FormField label="职位" required value={form.position} onChange={(v) => updateField('position', v)} placeholder="例：品牌总监" />
            <FormField label="年龄" value={form.age} onChange={(v) => updateField('age', v)} placeholder="选填" type="number" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="手机号" required value={form.phone} onChange={(v) => updateField('phone', v)} placeholder="11 位手机号" type="tel" />
            <FormField label="所在城市" required value={form.city} onChange={(v) => updateField('city', v)} placeholder="例：成都" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField label="门店数量" value={form.store_count} onChange={(v) => updateField('store_count', v)} options={STORE_COUNT_OPTIONS} />
            <SelectField label="年营业收入" value={form.annual_revenue} onChange={(v) => updateField('annual_revenue', v)} options={REVENUE_OPTIONS} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              当前经营中最希望解决的问题？
            </label>
            <textarea
              value={form.help_text}
              onChange={(e) => updateField('help_text', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent text-gray-800 placeholder-gray-400 resize-none"
              rows={3}
              placeholder="例：顾客反馈无法系统化利用、多店管理标准难统一..."
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-medium text-base hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-600/20"
          >
            {submitting ? '提交中...' : '提交申请'}
          </button>

          <p className="text-center text-xs text-gray-400">
            提交即代表您同意我们联系您讨论合作事宜，信息仅用于内测邀请
          </p>
        </form>
      </div>
    </section>
  );
}

// ─── Form Helpers ───

function FormField({
  label, required, value, onChange, placeholder, type = 'text',
}: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent text-gray-800 placeholder-gray-400"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent text-gray-800 appearance-none"
      >
        <option value="">请选择</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
