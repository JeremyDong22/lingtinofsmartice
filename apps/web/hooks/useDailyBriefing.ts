// Daily Briefing Hook - Auto-trigger daily AI briefing on first visit
// v5.0 - DISABLED auto-trigger: 自动发送容易拖累性能，改为仅保留手动触发
// v4.0 - Resilient: retry once on network failure, only mark date after success
// v3.0 - Expose triggerBriefing() for manual invocation
// v2.0 - Once-per-day: localStorage 记录日期，当天只触发一次，清空对话不重复触发
// v1.4 - Cooldown: 5-min sessionStorage guard prevents rapid retries on backend failure

import { useCallback } from 'react';
import type { SendMessageOptions } from './useChatStream';

interface UseDailyBriefingOptions {
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  isLoading?: boolean;
  isInitialized?: boolean;
  messageCount?: number;
  messages?: unknown[];
}

export function useDailyBriefing({ sendMessage }: UseDailyBriefingOptions) {
  // Auto-trigger DISABLED (v5.0): 自动发送容易拖累性能，仅保留手动触发

  /** Manual trigger — user clicks "查看今日汇报" button */
  const triggerBriefing = useCallback(() => {
    sendMessage('__DAILY_BRIEFING__', { hideUserMessage: true });
  }, [sendMessage]);

  return { triggerBriefing };
}
