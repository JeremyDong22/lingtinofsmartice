// Daily Briefing Hook - Auto-trigger daily AI briefing on first visit
// v1.3 - Also re-trigger if cached messages are all errors/empty (fixes PWA stuck)
// v1.2 - Return reset() so clearMessages can re-trigger briefing

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Message, SendMessageOptions } from './useChatStream';

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

    // Skip if there are valid messages (briefing completed or user has history)
    if (messageCount > 0) {
      // But re-trigger if all assistant messages are errors or empty (previous attempt failed)
      const hasValidAssistant = messages.some(
        m => m.role === 'assistant' && !m.isError && !m.isStopped && m.content.length > 10,
      );
      if (hasValidAssistant) return;
    }

    hasSent.current = true;
    sendMessage('__DAILY_BRIEFING__', { hideUserMessage: true });
  }, [isInitialized, isLoading, user, messageCount, messages, sendMessage]);

  // Reset so next render with messageCount=0 will re-trigger briefing
  const reset = useCallback(() => {
    hasSent.current = false;
  }, []);

  return { reset };
}
