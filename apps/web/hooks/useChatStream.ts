// Chat Stream Hook - Handle streaming chat with in-memory state persistence
// v4.1 - Network error detection: friendly Chinese message for fetch failures + retry hint
// v4.0 - Module-level store: chat state survives SPA navigation (unmount/remount)
//        Fetch continues in background when user navigates away, results preserved on return
// v3.3 - Version-gated cache: clear stale messages on app update (fixes PWA stuck)
// v3.2 - localStorage + cross-day auto-clear (fixes PWA reopen re-generation)

import { useState, useCallback, useEffect } from 'react';
import { getAuthHeaders, useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';
import { APP_VERSION } from '@/components/layout/UpdatePrompt';
import { tStatic, getLocale } from '@/lib/i18n';

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
  isInitialized: boolean;
  error: string | null;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  stopRequest: () => void;
  clearMessages: () => void;
}

// === localStorage helpers ===

function getStorageKey(roleCode?: string): string {
  return `lingtin_chat_${roleCode || 'default'}`;
}

function getTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

function getStoredMessages(storageKey: string): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as { date: string; version?: string; messages: Message[] };
      if (parsed.date !== getTodayDate() || parsed.version !== APP_VERSION) {
        localStorage.removeItem(storageKey);
        return [];
      }
      return parsed.messages.map(msg => ({ ...msg, isStreaming: false }));
    }
    return [];
  } catch {
    return [];
  }
}

const MAX_PERSISTED_MESSAGES = 100;

function saveMessages(messages: Message[], storageKey: string) {
  if (typeof window === 'undefined') return;
  const trimmed = messages.length > MAX_PERSISTED_MESSAGES
    ? messages.slice(-MAX_PERSISTED_MESSAGES)
    : messages;
  // Clean streaming flags before persisting
  const cleaned = trimmed.map(m => ({ ...m, isStreaming: false, thinkingStatus: undefined }));
  const payload = JSON.stringify({ date: getTodayDate(), version: APP_VERSION, messages: cleaned });
  try {
    localStorage.setItem(storageKey, payload);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      clearStaleStorage();
      try { localStorage.setItem(storageKey, payload); } catch { /* give up */ }
    }
  }
}

function clearStaleStorage() {
  const today = getTodayDate();
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('lingtin_chat_') && key !== 'lingtin-swr-cache') continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed.date && parsed.date !== today) keysToRemove.push(key);
    } catch {
      if (key) keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) localStorage.removeItem(key);
  const swrDate = localStorage.getItem('lingtin-swr-cache-date');
  if (swrDate && swrDate !== today) {
    localStorage.removeItem('lingtin-swr-cache');
    localStorage.removeItem('lingtin-swr-cache-date');
  }
}

// === Module-level chat store ===
// State persists across component mount/unmount (SPA page navigation).
// Lost only on full page refresh (falls back to localStorage).

interface ChatStore {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  abortController: AbortController | null;
  date: string; // auto-reset on new day
}

const stores = new Map<string, ChatStore>();

// React setState setters — registered when component mounted, null when unmounted
type ReactSetters = {
  setMessages: (msgs: Message[]) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
};
const mountedSetters = new Map<string, ReactSetters | null>();

// Get or create store for a storage key; auto-reset on new day
function getStore(key: string): ChatStore {
  const today = getTodayDate();
  const existing = stores.get(key);
  if (existing && existing.date === today) return existing;
  // New day or first access — initialize from localStorage
  const store: ChatStore = {
    messages: getStoredMessages(key),
    isLoading: false,
    error: null,
    abortController: null,
    date: today,
  };
  stores.set(key, store);
  return store;
}

// Update messages in module store + push to React if mounted
function patchMessages(key: string, updater: (prev: Message[]) => Message[]) {
  const s = getStore(key);
  s.messages = updater(s.messages);
  mountedSetters.get(key)?.setMessages(s.messages);
}

function patchLoading(key: string, v: boolean) {
  const s = getStore(key);
  s.isLoading = v;
  mountedSetters.get(key)?.setLoading(v);
}

function patchError(key: string, v: string | null) {
  const s = getStore(key);
  s.error = v;
  mountedSetters.get(key)?.setError(v);
}

// === Hook ===

export function useChatStream(): UseChatStreamReturn {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const roleCode = user?.roleCode;
  const userName = user?.employeeName;
  const employeeId = user?.id;
  const storageKey = getStorageKey(roleCode);

  // Initialize React state from module store (which reads localStorage on first access)
  const store = getStore(storageKey);
  const [messages, setMessagesLocal] = useState<Message[]>(store.messages);
  const [isLoading, setIsLoadingLocal] = useState(store.isLoading);
  const [error, setErrorLocal] = useState<string | null>(store.error);

  // Register React setters on mount; sync latest store state (may have changed while unmounted)
  useEffect(() => {
    mountedSetters.set(storageKey, {
      setMessages: setMessagesLocal,
      setLoading: setIsLoadingLocal,
      setError: setErrorLocal,
    });
    const s = getStore(storageKey);
    setMessagesLocal(s.messages);
    setIsLoadingLocal(s.isLoading);
    setErrorLocal(s.error);
    return () => {
      mountedSetters.set(storageKey, null);
      // DON'T abort — let ongoing fetch continue updating the store
    };
  }, [storageKey]);

  // Persist to localStorage when messages settle (not streaming)
  useEffect(() => {
    const hasStreaming = messages.some(m => m.isStreaming);
    if (hasStreaming) return;
    saveMessages(messages, storageKey);
  }, [messages, storageKey]);

  const sendMessage = useCallback(async (content: string, options?: SendMessageOptions) => {
    if (!content.trim() || getStore(storageKey).isLoading) return;
    const { hideUserMessage = false } = options || {};

    // Cancel any ongoing request
    const s = getStore(storageKey);
    if (s.abortController) s.abortController.abort();

    // Build history from store (avoids stale React state closure)
    const current = getStore(storageKey).messages;
    const prev = current.filter(m => !m.isStreaming && m.content.trim());
    const history = [
      ...prev.slice(-9).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content },
    ];

    const userMsgId = `user-${Date.now()}`;
    const asstMsgId = `assistant-${Date.now()}`;

    if (!hideUserMessage) {
      patchMessages(storageKey, p => [...p, { id: userMsgId, role: 'user' as const, content }]);
    }
    patchLoading(storageKey, true);
    patchError(storageKey, null);
    patchMessages(storageKey, p => [...p, {
      id: asstMsgId, role: 'assistant' as const, content: '', isStreaming: true,
    }]);

    let fullContent = '';
    let flushRaf = 0;
    const flush = () => {
      flushRaf = 0;
      patchMessages(storageKey, p => p.map(m =>
        m.id === asstMsgId ? { ...m, content: fullContent, thinkingStatus: undefined } : m
      ));
    };

    try {
      const ctrl = new AbortController();
      getStore(storageKey).abortController = ctrl;

      const response = await fetch(getApiUrl('api/chat/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          message: content,
          restaurant_id: restaurantId,
          history,
          role_code: roleCode,
          user_name: userName,
          employee_id: employeeId,
          managed_restaurant_ids: user?.managedRestaurantIds || null,
          locale: getLocale(),
        }),
        signal: ctrl.signal,
      });

      if (!response.ok) throw new Error(tStatic('chat.error.requestFailed'));

      const reader = response.body?.getReader();
      if (!reader) throw new Error(tStatic('chat.error.cannotRead'));

      const decoder = new TextDecoder();
      const TIMEOUT_MS = 60_000;
      let timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetTimer();

          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              if (flushRaf) { cancelAnimationFrame(flushRaf); flushRaf = 0; }
              patchMessages(storageKey, p => p.map(m =>
                m.id === asstMsgId
                  ? { ...m, content: fullContent, isStreaming: false, thinkingStatus: undefined }
                  : m
              ));
              continue;
            }

            let parsed: { type: string; content?: string; tool?: string };
            try { parsed = JSON.parse(data); } catch { continue; }

            if (parsed.type === 'heartbeat') continue;

            if (parsed.type === 'thinking') {
              patchMessages(storageKey, p => p.map(m =>
                m.id === asstMsgId ? { ...m, thinkingStatus: parsed.content } : m
              ));
            } else if (parsed.type === 'tool_use') {
              const name = parsed.tool === 'query_database' ? tStatic('chat.tool.queryDb') : parsed.tool;
              patchMessages(storageKey, p => p.map(m =>
                m.id === asstMsgId ? { ...m, thinkingStatus: `${tStatic('chat.tool.thinking')}${name}...` } : m
              ));
            } else if (parsed.type === 'text') {
              fullContent += parsed.content;
              if (!flushRaf) flushRaf = requestAnimationFrame(flush);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.content);
            }
          }
        }
      } finally {
        clearTimeout(timer);
        if (flushRaf) { cancelAnimationFrame(flushRaf); flushRaf = 0; }
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User pressed stop (abortController set to null by stopRequest)
        if (getStore(storageKey).abortController === null) return;
        // Timeout
        const timeoutMsg = tStatic('chat.error.busy');
        patchError(storageKey, timeoutMsg);
        patchMessages(storageKey, p => p.map(m =>
          m.id === asstMsgId
            ? { ...m, content: `${tStatic('chat.error.sorry')}${timeoutMsg}`, isStreaming: false, isError: true, thinkingStatus: undefined, originalQuestion: content }
            : m
        ));
        return;
      }

      const isNetworkError = err instanceof TypeError && /fetch|network|failed/i.test(err.message);
      const errMsg = isNetworkError
        ? '网络连接失败，请检查网络后点击重试'
        : err instanceof Error ? err.message : tStatic('chat.error.unknown');
      patchError(storageKey, errMsg);
      patchMessages(storageKey, p => p.map(m =>
        m.id === asstMsgId
          ? { ...m, content: `${tStatic('chat.error.sorry')}${errMsg}`, isStreaming: false, isError: true, thinkingStatus: undefined, originalQuestion: content }
          : m
      ));
    } finally {
      patchLoading(storageKey, false);
      getStore(storageKey).abortController = null;
      // Persist to localStorage (works even after component unmount)
      saveMessages(getStore(storageKey).messages, storageKey);
    }
  }, [storageKey, restaurantId, roleCode, userName, employeeId, user?.managedRestaurantIds]);

  const clearMessages = useCallback(() => {
    const s = getStore(storageKey);
    if (s.abortController) { s.abortController.abort(); s.abortController = null; }
    patchMessages(storageKey, () => []);
    patchError(storageKey, null);
    patchLoading(storageKey, false);
  }, [storageKey]);

  const stopRequest = useCallback(() => {
    const s = getStore(storageKey);
    if (s.abortController) { s.abortController.abort(); s.abortController = null; }
    patchMessages(storageKey, p => p.map(m =>
      m.isStreaming
        ? { ...m, isStreaming: false, thinkingStatus: undefined, isStopped: true, content: m.content || tStatic('chat.stoppedThinking') }
        : m
    ));
    patchLoading(storageKey, false);
  }, [storageKey]);

  const retryMessage = useCallback(async (messageId: string) => {
    const current = getStore(storageKey);
    const errorMsg = current.messages.find(m => m.id === messageId);
    if (!errorMsg?.originalQuestion || current.isLoading) return;
    const question = errorMsg.originalQuestion;
    patchMessages(storageKey, p => {
      const idx = p.findIndex(m => m.id === messageId);
      if (idx === -1) return p;
      return p.filter((_, i) => i !== idx && i !== idx - 1);
    });
    setTimeout(() => sendMessage(question), 50);
  }, [storageKey, sendMessage]);

  return {
    messages,
    isLoading,
    isInitialized: true,
    error,
    sendMessage,
    retryMessage,
    stopRequest,
    clearMessages,
  };
}
