// Chat Stream Hook - Handle streaming chat responses with localStorage persistence
// v3.2 - localStorage + cross-day auto-clear (fixes PWA reopen re-generation)
// v3.1 - Streaming timeout + reader error recovery (fixes "正在思考" stuck forever)
// v3.0 - Added hideUserMessage option, role-based STORAGE_KEY, removed static welcome message

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAuthHeaders, useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  thinkingStatus?: string;  // 显示思考步骤，如 "正在查询数据库..."
  isError?: boolean;        // 标记错误消息，显示重试按钮
  isStopped?: boolean;      // 标记被用户停止的消息，显示灰色
  originalQuestion?: string; // 保存原始问题用于重试
}

export interface SendMessageOptions {
  hideUserMessage?: boolean; // 不显示用户消息气泡（用于 briefing 触发）
}

interface UseChatStreamReturn {
  messages: Message[];
  isLoading: boolean;
  isInitialized: boolean;  // True when messages have been loaded from storage
  error: string | null;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  stopRequest: () => void;
  clearMessages: () => void;
}

// Build role-based storage key
function getStorageKey(roleCode?: string): string {
  return `lingtin_chat_${roleCode || 'default'}`;
}

// Get today's date string in YYYY-MM-DD (China time)
function getTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

// Load messages from localStorage (cross-day auto-clear)
function getStoredMessages(storageKey: string): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as { date: string; messages: Message[] };
      // Cross-day: discard stale messages so briefing regenerates
      if (parsed.date !== getTodayDate()) {
        localStorage.removeItem(storageKey);
        return [];
      }
      // Clear any streaming state from previous session
      return parsed.messages.map(msg => ({ ...msg, isStreaming: false }));
    }
    return [];
  } catch {
    return [];
  }
}

// Max messages to persist (prevents unbounded growth)
const MAX_PERSISTED_MESSAGES = 100;

// Save messages to localStorage with today's date
function saveMessages(messages: Message[], storageKey: string) {
  if (typeof window === 'undefined') return;
  // Keep only the latest messages to limit storage usage
  const trimmed = messages.length > MAX_PERSISTED_MESSAGES
    ? messages.slice(-MAX_PERSISTED_MESSAGES)
    : messages;
  const payload = JSON.stringify({ date: getTodayDate(), messages: trimmed });
  try {
    localStorage.setItem(storageKey, payload);
  } catch (e) {
    // QuotaExceededError: clear stale lingtin keys and retry once
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      clearStaleStorage();
      try {
        localStorage.setItem(storageKey, payload);
      } catch {
        // Still full — give up silently, data will regenerate on next visit
      }
    }
  }
}

// Remove expired lingtin_* keys to free space when quota is exceeded
function clearStaleStorage() {
  const today = getTodayDate();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith('lingtin_chat_') && key !== 'lingtin-swr-cache') continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      // Chat keys have { date, messages }; SWR cache date tracked separately
      if (parsed.date && parsed.date !== today) {
        localStorage.removeItem(key);
      }
    } catch {
      // Corrupt entry — safe to remove
      if (key) localStorage.removeItem(key);
    }
  }
  // Also clear SWR cache if its date is stale
  const swrDate = localStorage.getItem('lingtin-swr-cache-date');
  if (swrDate && swrDate !== today) {
    localStorage.removeItem('lingtin-swr-cache');
    localStorage.removeItem('lingtin-swr-cache-date');
  }
}

export function useChatStream(): UseChatStreamReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Use ref to always get latest messages in callbacks (fixes stale closure bug)
  const messagesRef = useRef<Message[]>(messages);

  // Get user's restaurant ID from auth context
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const roleCode = user?.roleCode;
  const userName = user?.employeeName;
  const employeeId = user?.id;
  const storageKey = getStorageKey(roleCode);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load messages from sessionStorage on mount
  useEffect(() => {
    const stored = getStoredMessages(storageKey);
    setMessages(stored);
    setIsInitialized(true);
  }, [storageKey]);

  // Save messages to sessionStorage when they change
  useEffect(() => {
    if (isInitialized) {
      saveMessages(messages, storageKey);
    }
  }, [messages, isInitialized, storageKey]);

  const sendMessage = useCallback(async (content: string, options?: SendMessageOptions) => {
    if (!content.trim() || isLoading) {
      return;
    }

    const { hideUserMessage = false } = options || {};

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Build conversation history BEFORE adding new messages (to avoid async state issues)
    // Include all previous messages plus the current user message
    const previousMessages = messagesRef.current.filter(
      msg => !msg.isStreaming && msg.content.trim()
    );
    const historyMessages = [
      ...previousMessages.slice(-9).map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content }  // Include current message
    ];

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // Add user message (optionally hidden)
    if (!hideUserMessage) {
      setMessages(prev => [...prev, {
        id: userMessageId,
        role: 'user',
        content,
      }]);
    }

    setIsLoading(true);
    setError(null);

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }]);

    let fullContent = '';

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch(getApiUrl('api/chat/message'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message: content,
          restaurant_id: restaurantId,
          history: historyMessages,
          role_code: roleCode,
          user_name: userName,
          employee_id: employeeId,
          managed_restaurant_ids: user?.managedRestaurantIds || null,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('请求失败，请稍后重试');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应');
      }

      const decoder = new TextDecoder();

      // Streaming timeout: if no data for 60s, abort
      const STREAM_TIMEOUT_MS = 60_000;
      let streamTimer = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, STREAM_TIMEOUT_MS);

      const resetStreamTimer = () => {
        clearTimeout(streamTimer);
        streamTimer = setTimeout(() => {
          abortControllerRef.current?.abort();
        }, STREAM_TIMEOUT_MS);
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          resetStreamTimer();

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, isStreaming: false }
                    : msg
                ));
                continue;
              }

              let parsed: { type: string; content?: string; tool?: string };
              try {
                parsed = JSON.parse(data);
              } catch {
                // Skip invalid JSON lines
                continue;
              }

              if (parsed.type === 'thinking') {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, thinkingStatus: parsed.content }
                    : msg
                ));
              } else if (parsed.type === 'tool_use') {
                const toolName = parsed.tool === 'query_database' ? '查询数据库' : parsed.tool;
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, thinkingStatus: `正在${toolName}...` }
                    : msg
                ));
              } else if (parsed.type === 'text') {
                fullContent += parsed.content;
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: fullContent, thinkingStatus: undefined }
                    : msg
                ));
              } else if (parsed.type === 'error') {
                throw new Error(parsed.content);
              }
            }
          }
        }
      } finally {
        clearTimeout(streamTimer);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Distinguish user-initiated stop (abortControllerRef already null) from timeout
        if (abortControllerRef.current === null) {
          // User pressed stop — handled by stopRequest()
          return;
        }
        // Timeout — show friendly message with retry
        const timeoutMsg = '当前访问人数较多，请稍后重试';
        setError(timeoutMsg);
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `抱歉，${timeoutMsg}`,
                isStreaming: false,
                isError: true,
                originalQuestion: content,
              }
            : msg
        ));
        return;
      }

      const errorMessage = err instanceof Error ? err.message : '发生未知错误';
      setError(errorMessage);

      // Update assistant message with error and store original question for retry
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: `抱歉，${errorMessage}`,
              isStreaming: false,
              isError: true,
              originalQuestion: content,
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading, restaurantId, roleCode, userName, employeeId]);

  const clearMessages = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  // Stop ongoing request without clearing messages
  const stopRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Mark any streaming message as stopped and clear thinking status
    setMessages(prev => prev.map(msg =>
      msg.isStreaming
        ? { ...msg, isStreaming: false, thinkingStatus: undefined, isStopped: true, content: msg.content || '停止了思考。' }
        : msg
    ));
    setIsLoading(false);
  }, []);

  // Retry a failed message - removes the error message and its user question, then resends
  const retryMessage = useCallback(async (messageId: string) => {
    const errorMsg = messagesRef.current.find(m => m.id === messageId);
    if (!errorMsg?.originalQuestion || isLoading) return;

    const question = errorMsg.originalQuestion;

    // Remove the failed assistant message and its preceding user message
    setMessages(prev => {
      const errorIndex = prev.findIndex(m => m.id === messageId);
      if (errorIndex === -1) return prev;
      // Remove both the user message (errorIndex - 1) and the error message (errorIndex)
      return prev.filter((_, i) => i !== errorIndex && i !== errorIndex - 1);
    });

    // Wait for state update, then resend
    setTimeout(() => {
      sendMessage(question);
    }, 50);
  }, [isLoading, sendMessage]);

  return {
    messages,
    isLoading,
    isInitialized,
    error,
    sendMessage,
    retryMessage,
    stopRequest,
    clearMessages,
  };
}
