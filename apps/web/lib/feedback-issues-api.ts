import { getApiUrl } from './api';
import { getAuthHeaders } from '@/contexts/AuthContext';

export interface FeedbackIssue {
  id: string;
  restaurant_id: string;
  category: string;
  topic: string;
  topic_keywords: string[];
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  daily_counts: Array<{ date: string; count: number }>;
  evidence: Array<{
    visit_record_id: string;
    feedback_text: string;
    table_id: string | null;
    date: string;
    audio_url: string | null;
    sentiment: string;
    score: number;
  }>;
  classification: string;
  classified_by: string | null;
  classified_at: string | null;
  manager_classification: string | null;
  manager_action_note: string | null;
  manager_action_at: string | null;
  manager_action_by: string | null;
  chef_classification: string | null;
  chef_action_note: string | null;
  chef_action_at: string | null;
  chef_action_by: string | null;
  management_reply: string | null;
  management_reply_by: string | null;
  management_reply_at: string | null;
  management_reply_read_by_manager: boolean;
  management_reply_read_by_chef: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedbackIssuesResponse {
  issues: FeedbackIssue[];
}

export interface ManagementSummaryRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  issues_total: number;
  issues_breakdown: {
    unclassified: number;
    resolved: number;
    todo: number;
    dismissed: number;
  };
  staff_actions_count: number;
  todo_overdue_count: number;
}

export interface ManagementSummaryResponse {
  restaurants: ManagementSummaryRestaurant[];
}

export async function classifyIssue(
  id: string,
  role: 'manager' | 'head_chef',
  classification: 'resolved' | 'todo' | 'dismissed',
  note?: string,
  actionBy?: string,
): Promise<{ success: boolean }> {
  const res = await fetch(getApiUrl(`/api/feedback-issues/${id}/classify`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ role, classification, note, action_by: actionBy }),
  });
  if (!res.ok) throw new Error(`Failed to classify issue: ${res.status}`);
  return res.json();
}

export async function replyToIssue(
  id: string,
  reply: string,
  replyBy: string,
): Promise<{ success: boolean }> {
  const res = await fetch(getApiUrl(`/api/feedback-issues/${id}/management-reply`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ reply, reply_by: replyBy }),
  });
  if (!res.ok) throw new Error(`Failed to reply to issue: ${res.status}`);
  return res.json();
}

export async function markReplyRead(
  id: string,
  role: 'manager' | 'head_chef',
): Promise<{ success: boolean }> {
  const res = await fetch(getApiUrl(`/api/feedback-issues/${id}/mark-reply-read`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`Failed to mark reply read: ${res.status}`);
  return res.json();
}
