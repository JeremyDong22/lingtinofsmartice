// Chef Chat Page - AI assistant for head_chef role
// v2.0 - Added welcomeMessage config

'use client';

import ChatPage from '@/components/chat/ChatPage';

export default function ChefChatPage() {
  return (
    <ChatPage
      config={{
        role: 'chef',
        headerTitle: 'AI 智库',
        placeholder: '问我关于菜品和厨房的问题...',
        chatBasePath: '/chef/chat',
        fallbackQuickQuestions: [
          '最近哪些菜品被差评了',
          '有哪些菜品连续好评',
          '今天备餐需要注意什么',
          '厨房待办有哪些',
        ],
        actionLinks: [
          { label: '查看厨房待办', path: '/chef/dashboard' },
          { label: '菜品反馈', path: '/chef/dishes' },
        ],
        welcomeMessage: {
          title: '我是你的 AI 厨房助手',
          subtitle: '追踪了顾客对每道菜的真实评价，我能帮你：',
          capabilities: [
            { icon: 'AlertTriangle', text: '精准定位哪道菜出了什么问题' },
            { icon: 'ListTodo', text: '将差评转化为备餐任务，驱动厨房改进' },
            { icon: 'CheckCircle', text: '追踪菜品改善效果，确认问题是否解决' },
          ],
        },
      }}
    />
  );
}
