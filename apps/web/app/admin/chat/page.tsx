// Admin Chat Page - AI assistant for boss/administrator role
// v2.1 - Added actionLinks for briefing quick-actions

'use client';

import ChatPage from '@/components/chat/ChatPage';

export default function AdminChatPage() {
  return (
    <ChatPage
      config={{
        role: 'admin',
        headerTitle: 'AI 智库',
        placeholder: '问我任何关于经营的问题...',
        chatBasePath: '/admin/chat',
        fallbackQuickQuestions: [
          '本周整体经营情况如何',
          '哪些菜品需要重点关注',
          '顾客满意度趋势怎么样',
          '店长执行情况分析',
        ],
        actionLinks: [
          { label: '查看总览', path: '/admin/briefing' },
          { label: '深入分析', path: '/admin/insights' },
        ],
      }}
    />
  );
}
