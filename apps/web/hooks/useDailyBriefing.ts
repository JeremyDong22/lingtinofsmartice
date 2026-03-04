// Daily Briefing Hook - Auto-trigger daily AI briefing on first visit
// v3.0 - Expose triggerBriefing() for manual invocation
// v2.0 - Once-per-day: localStorage 记录日期，当天只触发一次，清空对话不重复触发
// v1.4 - Cooldown: 5-min sessionStorage guard prevents rapid retries on backend failure

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Message, SendMessageOptions } from './useChatStream';

const BRIEFING_DATE_KEY = 'lingtin_briefing_date';
const COOLDOWN_KEY = 'lingtin_briefing_cooldown';
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/** 获取今天日期字符串 YYYY-MM-DD */
function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface UseDailyBriefingOptions {
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  isLoading: boolean;
  isInitialized: boolean;
  messageCount: number;
  messages: Message[];
}

export function useDailyBriefing({
  sendMessage,
  isLoading,
  isInitialized,
  messageCount,
  messages,
}: UseDailyBriefingOptions) {
  const { user } = useAuth();
  const hasSent = useRef(false);

  useEffect(() => {
    if (!isInitialized || isLoading || hasSent.current || !user) return;

    // Once-per-day: 当天已成功触发过简报，不再自动触发
    const lastBriefingDate = localStorage.getItem(BRIEFING_DATE_KEY);
    if (lastBriefingDate === getTodayStr()) return;

    // Skip if there are valid messages (briefing completed or user has history)
    if (messageCount > 0) {
      const hasValidAssistant = messages.some(
        m => m.role === 'assistant' && !m.isError && !m.isStopped && m.content.length > 10,
      );
      if (hasValidAssistant) {
        localStorage.setItem(BRIEFING_DATE_KEY, getTodayStr());
        return;
      }
    }

    // Cooldown: don't retry within 5 minutes of a previous attempt
    const lastAttempt = sessionStorage.getItem(COOLDOWN_KEY);
    if (lastAttempt && Date.now() - Number(lastAttempt) < COOLDOWN_MS) {
      return;
    }

    hasSent.current = true;
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    localStorage.setItem(BRIEFING_DATE_KEY, getTodayStr());
    sendMessage('__DAILY_BRIEFING__', { hideUserMessage: true });
  }, [isInitialized, isLoading, user, messageCount, messages, sendMessage]);

  /** Manual trigger — always fires regardless of once-per-day guard */
  const triggerBriefing = useCallback(() => {
    sendMessage('__DAILY_BRIEFING__', { hideUserMessage: true });
  }, [sendMessage]);

  return { triggerBriefing };
}
