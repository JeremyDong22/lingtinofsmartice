// Store Manager Chat Page - AI assistant for store managers
// v3.1 - Added actionLinks for briefing quick-actions

'use client';

import ChatPage from '@/components/chat/ChatPage';

export default function ManagerChatPage() {
  return (
    <ChatPage
      config={{
        role: 'manager',
        headerTitle: 'AI 智库',
        placeholder: '问我任何关于桌访的问题...',
        chatBasePath: '/chat',
        fallbackQuickQuestions: [
          '帮我优化桌访话术',
          '最近有哪些需要改进的地方',
          '哪些菜品需要重点关注',
          '本周顾客满意度怎么样',
        ],
        actionLinks: [
          { label: '开始桌访', path: '/recorder' },
          { label: '查看看板', path: '/dashboard' },
        ],
      }}
    />
  );
}
