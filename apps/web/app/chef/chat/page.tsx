// Chef Chat Page - AI assistant for head_chef role
// v1.1 - Added actionLinks for briefing quick-actions

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
      }}
    />
  );
}
