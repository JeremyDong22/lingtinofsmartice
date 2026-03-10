// User Menu Component - Display user avatar with dropdown menu
// v1.7 - Added unread reply badge for feedback auto-resolve notifications

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/lib/i18n';
import { APP_VERSION } from './UpdatePrompt';
import useSWR from 'swr';
import {
  ClipboardList, Map, BarChart3, Settings,
  MessageSquare, FileText, BookOpen, Languages,
  Activity, HeartPulse, Brain,
} from 'lucide-react';

const GUIDE_SEEN_KEY = 'lingtin_guide_seen_version';

export function UserMenu() {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useT();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnreadGuide, setHasUnreadGuide] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Poll for unread feedback replies (60s interval, all roles)
  const isAdmin = user?.roleCode === 'administrator';
  const { data: feedbackData } = useSWR<{ data: Array<{ admin_reply: string | null; reply_read_at: string | null }> }>(
    user ? `/api/feedback/mine?employee_id=${user.id}` : null,
    { refreshInterval: 60_000 },
  );
  const hasUnreadReply = feedbackData?.data?.some(
    f => f.admin_reply && !f.reply_read_at,
  ) ?? false;

  // Combined unread state
  const hasUnread = hasUnreadGuide || hasUnreadReply;

  // Get first character of employee name (e.g., "梁店长" -> "梁")
  const avatarChar = user?.employeeName?.charAt(0) || '?';

  // Check for unread guide updates
  useEffect(() => {
    try {
      const seen = localStorage.getItem(GUIDE_SEEN_KEY);
      setHasUnreadGuide(seen !== APP_VERSION);
    } catch {
      setHasUnreadGuide(false);
    }

    const handleGuideSeen = () => setHasUnreadGuide(false);
    window.addEventListener('lingtin-guide-seen', handleGuideSeen);
    return () => window.removeEventListener('lingtin-guide-seen', handleGuideSeen);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <span className="text-xs text-gray-500 hidden sm:inline">
          {user.restaurantName}
        </span>
        <div className="relative w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-primary-600 text-sm font-medium">
            {avatarChar}
          </span>
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">
              {user.employeeName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {user.restaurantName}
            </p>
          </div>

          {/* Language Switch (admin only) */}
          {isAdmin && (
            <button
              onClick={() => {
                setLocale(locale === 'zh-CN' ? 'en' : 'zh-CN');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Languages className="w-4 h-4 text-gray-400" />
              {t('menu.switchLang')}
            </button>
          )}

          {/* Question Templates Management (admin only) */}
          {isAdmin && (
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/admin/question-templates/manage');
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4 text-gray-400" />
              {t('menu.questionTemplates')}
            </button>
          )}

          {/* Region Management (super admin only) */}
          {user.isSuperAdmin && (
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/admin/regions');
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Map className="w-4 h-4 text-gray-400" />
              {t('menu.regions')}
            </button>
          )}

          {/* Product Insights (super admin only) */}
          {user.isSuperAdmin && (
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/admin/insights?tab=product');
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4 text-gray-400" />
              {t('menu.productInsights')}
            </button>
          )}

          {/* Hotword Management (admin only) */}
          {isAdmin && (
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/admin/settings');
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-gray-400" />
              {t('menu.hotwords')}
            </button>
          )}

          {/* User Activity (hr901027 only) */}
          {user.username === 'hr901027' && (
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/admin/activity');
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Activity className="w-4 h-4 text-gray-400" />
              用户活动
            </button>
          )}

          {/* System Health (hr901027 only) */}
          {user.username === 'hr901027' && (
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/admin/health');
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <HeartPulse className="w-4 h-4 text-gray-400" />
              系统健康
            </button>
          )}

          {/* Knowledge Engine (hr901027 only) */}
          {user.username === 'hr901027' && (
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/admin/knowledge');
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Brain className="w-4 h-4 text-gray-400" />
              知识引擎
            </button>
          )}

          {/* Submit Feedback (all roles) */}
          <button
            onClick={() => {
              setIsOpen(false);
              router.push('/feedback');
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-gray-400" />
            {t('menu.submitFeedback')}
          </button>

          {/* My Feedback History (all roles) */}
          <button
            onClick={() => {
              setIsOpen(false);
              router.push('/feedback/history');
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="flex-1">{t('menu.myFeedback')}</span>
            {hasUnreadReply && (
              <span className="w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          {/* Guide */}
          <button
            onClick={() => {
              setIsOpen(false);
              router.push('/guide');
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4 text-gray-400" />
            <span className="flex-1">{t('menu.guide')}</span>
            {hasUnreadGuide && (
              <span className="w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            {t('menu.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
