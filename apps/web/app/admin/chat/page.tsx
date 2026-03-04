// Admin Chat Page - AI assistant for boss/administrator role
// v3.0 - Added welcomeMessage config

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
        welcomeMessage: {
          title: '我是你的 AI 经营顾问',
          subtitle: '汇总了所有门店的经营数据，我能帮你：',
          capabilities: [
            { icon: 'BarChart3', text: '跨店对比，快速定位需要关注的门店' },
            { icon: 'ListTodo', text: '将问题转化为门店待办，推动各店执行' },
            { icon: 'CheckCircle', text: '跟踪各店改善进度，确认任务是否落地' },
          ],
        },
      }}
    />
  );
}
