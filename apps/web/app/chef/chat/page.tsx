// Chef Chat Page - AI assistant for head_chef role
// v2.1 - Added i18n support

'use client';

import ChatPage from '@/components/chat/ChatPage';
import { useT } from '@/lib/i18n';

export default function ChefChatPage() {
  const { t } = useT();
  return (
    <ChatPage
      config={{
        role: 'chef',
        headerTitle: t('chat.chef.title'),
        placeholder: t('chat.chef.placeholder'),
        chatBasePath: '/chef/chat',
        fallbackQuickQuestions: [
          t('chat.chef.q1'),
          t('chat.chef.q2'),
          t('chat.chef.q3'),
          t('chat.chef.q4'),
        ],
        actionLinks: [
          { label: t('chat.chef.link1'), path: '/chef/dashboard' },
          { label: t('chat.chef.link2'), path: '/chef/dishes' },
        ],
        welcomeMessage: {
          title: t('chat.chef.welcomeTitle'),
          subtitle: t('chat.chef.welcomeSubtitle'),
          capabilities: [
            { icon: 'AlertTriangle', text: t('chat.chef.cap1') },
            { icon: 'ListTodo', text: t('chat.chef.cap2') },
            { icon: 'CheckCircle', text: t('chat.chef.cap3') },
          ],
        },
      }}
    />
  );
}
