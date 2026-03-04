// Store Manager Chat Page - AI assistant for store managers
// v4.0 - Added welcomeMessage config

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
        welcomeMessage: {
          title: '我是你的 AI 运营助手',
          subtitle: '基于你每天的桌访录音，我能帮你：',
          capabilities: [
            { icon: 'Search', text: '从顾客真实反馈中发现菜品和服务问题' },
            { icon: 'ListTodo', text: '自动生成待办事项，驱动每日改善落地' },
            { icon: 'CheckCircle', text: '追踪任务完成情况，验证改善是否见效' },
          ],
        },
      }}
    />
  );
}
