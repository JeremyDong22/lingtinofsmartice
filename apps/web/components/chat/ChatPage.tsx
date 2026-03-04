// ChatPage - Unified chat page component for all roles
// v2.0 - textarea auto-resize, copy button, welcome message, manual briefing, remove clear button

'use client';

import { useState, useRef, useEffect, useCallback, memo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useChatStream } from '@/hooks/useChatStream';
import type { Message } from '@/hooks/useChatStream';
import { useDailyBriefing } from '@/hooks/useDailyBriefing';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator';
import { UserMenu } from '@/components/layout/UserMenu';
import {
  Copy, Check, Bot, Sparkles,
  Search, ListTodo, CheckCircle,
  BarChart3, AlertTriangle,
} from 'lucide-react';

// Icon lookup for welcome capabilities
const iconMap = {
  Search,
  ListTodo,
  CheckCircle,
  BarChart3,
  AlertTriangle,
} as const;

export type WelcomeIconName = keyof typeof iconMap;

export interface WelcomeMessage {
  title: string;
  subtitle: string;
  capabilities: { icon: WelcomeIconName; text: string }[];
}

export interface ChatPageConfig {
  role: 'manager' | 'admin' | 'chef';
  headerTitle: string;
  placeholder: string;
  fallbackQuickQuestions: string[];
  chatBasePath: string;
  actionLinks?: { label: string; path: string }[];
  welcomeMessage?: WelcomeMessage;
}

interface ChatPageProps {
  config: ChatPageConfig;
}

// --- Copy button for assistant messages ---
function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
    const cleanText = content.replace(/:::quick-questions:::\n[\s\S]*?:::/g, '').trim();
    try {
      await navigator.clipboard.writeText(cleanText);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Mobile browsers may block clipboard API in non-secure contexts
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="mt-1 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      title="复制"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

// --- Memoized message bubble ---
interface MessageBubbleProps {
  msg: Message;
  onQuickQuestion: (q: string) => void;
  onRetry: (id: string) => void;
  retryDisabled: boolean;
  isBriefing?: boolean;
  actionLinks?: { label: string; path: string }[];
  onNavigate?: (path: string) => void;
}

const MessageBubble = memo(function MessageBubble({
  msg,
  onQuickQuestion,
  onRetry,
  retryDisabled,
  isBriefing,
  actionLinks,
  onNavigate,
}: MessageBubbleProps) {
  const showCopy = msg.role === 'assistant' && !msg.isError && !msg.isStreaming && !msg.thinkingStatus && !msg.isStopped && msg.content;

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          msg.role === 'user'
            ? 'bg-primary-600 text-white'
            : 'bg-white shadow-sm text-gray-900'
        }`}
      >
        {msg.role === 'user' ? (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        ) : msg.isError ? (
          <div className="space-y-2">
            <div className="text-red-600">{msg.content}</div>
            <button
              onClick={() => onRetry(msg.id)}
              disabled={retryDisabled}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
            >
              重试
            </button>
          </div>
        ) : msg.thinkingStatus ? (
          <ThinkingIndicator status={msg.thinkingStatus} />
        ) : msg.isStopped ? (
          <div className="text-gray-500 text-sm">{msg.content}</div>
        ) : msg.isStreaming && msg.content ? (
          <div className="whitespace-pre-wrap leading-relaxed">
            {msg.content}
            <span className="streaming-cursor" />
          </div>
        ) : msg.content ? (
          <>
            <MarkdownRenderer
              content={msg.content}
              onQuickQuestion={onQuickQuestion}
            />
            {isBriefing && !msg.isStreaming && actionLinks && actionLinks.length > 0 && onNavigate && (
              <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100">
                {actionLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => onNavigate(link.path)}
                    className="lingtin-action-btn px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : msg.isStreaming ? (
          <ThinkingIndicator status="思考中" />
        ) : null}

        {showCopy && (
          <div className="flex justify-end">
            <CopyButton content={msg.content} />
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.msg === next.msg && prev.retryDisabled === next.retryDisabled
      && prev.isBriefing === next.isBriefing) return true;
  return prev.msg.content === next.msg.content
    && prev.msg.isStreaming === next.msg.isStreaming
    && prev.msg.isError === next.msg.isError
    && prev.msg.isStopped === next.msg.isStopped
    && prev.msg.thinkingStatus === next.msg.thinkingStatus
    && prev.retryDisabled === next.retryDisabled
    && prev.isBriefing === next.isBriefing;
});

function ChatLoadingFallback({ title }: { title: string }) {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    </div>
  );
}

export default function ChatPage({ config }: ChatPageProps) {
  return (
    <Suspense fallback={<ChatLoadingFallback title={config.headerTitle} />}>
      <ChatContent config={config} />
    </Suspense>
  );
}

function ChatContent({ config }: ChatPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { messages, isLoading, isInitialized, sendMessage, retryMessage, stopRequest } = useChatStream();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-trigger daily briefing (once per day)
  const { triggerBriefing } = useDailyBriefing({
    sendMessage,
    isLoading,
    isInitialized,
    messageCount: messages.length,
    messages,
  });

  // Track whether any message is currently streaming
  const isStreaming = messages.some(m => m.isStreaming);

  // Throttled scroll
  const lastScrollRef = useRef(0);
  const rafRef = useRef<number>(0);

  const scrollToBottom = useCallback((smooth: boolean) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (isStreaming) {
      const now = Date.now();
      if (now - lastScrollRef.current < 150) return;
      lastScrollRef.current = now;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => scrollToBottom(false));
    } else {
      scrollToBottom(true);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [messages, isStreaming, scrollToBottom]);

  // Handle pre-filled question from URL query parameter
  useEffect(() => {
    const queryQuestion = searchParams.get('q');
    if (!queryQuestion || !isInitialized || isLoading) return;

    const processedKey = 'lingtin_processed_query';
    const lastProcessed = sessionStorage.getItem(processedKey);

    if (lastProcessed === queryQuestion) {
      router.replace(config.chatBasePath, { scroll: false });
      return;
    }

    sessionStorage.setItem(processedKey, queryQuestion);
    router.replace(config.chatBasePath, { scroll: false });
    sendMessage(queryQuestion);
  }, [searchParams, isLoading, isInitialized, sendMessage, router, config.chatBasePath]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Max 4 lines (~6rem = 96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput('');
    // Reset textarea height & blur to dismiss mobile keyboard
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.blur();
    }
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Stable callback refs for memoized children
  const handleQuickQuestion = useCallback(async (question: string) => {
    if (isLoading) return;
    setInput('');
    await sendMessage(question);
  }, [isLoading, sendMessage]);

  const handleBriefingClick = useCallback(() => {
    if (isLoading) return;
    triggerBriefing();
  }, [isLoading, triggerBriefing]);

  const handleNavigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const firstAssistantIndex = messages.findIndex(m => m.role === 'assistant');

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header — #3: removed clear button */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{config.headerTitle}</h1>
        <UserMenu />
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, msgIndex) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onQuickQuestion={handleQuickQuestion}
            onRetry={retryMessage}
            retryDisabled={isLoading}
            isBriefing={msg.role === 'assistant' && msgIndex === firstAssistantIndex}
            actionLinks={config.actionLinks}
            onNavigate={handleNavigate}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Empty state: welcome message + briefing entry + quick questions */}
      {messages.length === 0 && !isLoading ? (
        <div className="px-4 py-6 flex-shrink-0">
          {/* #5: Welcome message */}
          {config.welcomeMessage && (
            <div className="text-center mb-5 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 text-primary-600" />
              </div>
              <p className="text-lg font-semibold text-gray-800">{config.welcomeMessage.title}</p>
              <p className="text-sm text-gray-500 mt-1 mb-3">{config.welcomeMessage.subtitle}</p>
              <div className="space-y-2 text-left">
                {config.welcomeMessage.capabilities.map((cap) => {
                  const Icon = iconMap[cap.icon];
                  return (
                    <div key={cap.text} className="flex items-start gap-2.5">
                      <Icon className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{cap.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-center text-sm text-gray-400 mb-3">可以问我</p>
          <div className="space-y-2 max-w-sm mx-auto">
            {/* #4: Manual briefing entry */}
            <button
              onClick={handleBriefingClick}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl text-sm text-primary-700 text-left hover:bg-primary-100 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              查看今日运营简报
            </button>
            {config.fallbackQuickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => handleQuickQuestion(q)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 text-left hover:border-primary-500 hover:bg-primary-50 disabled:opacity-50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : messages.length > 0 ? (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {config.fallbackQuickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handleQuickQuestion(q)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 whitespace-nowrap hover:border-primary-500 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      {/* Input — #1: textarea auto-resize */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed resize-none overflow-y-auto"
            style={{ maxHeight: '6rem' }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stopRequest}
              className="px-6 py-3 bg-gray-500 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors flex-shrink-0"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              发送
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
