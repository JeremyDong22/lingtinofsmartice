// Guided Review Flow - Shared types
// Used across all step components in the wizard

export type ReviewStep =
  | 'briefing'          // Step 1: Combined data + pending actions + agenda (scrollable)
  | 'recording'         // Step 2: Record the review meeting
  | 'processing'        // (transitional, not shown in progress bar)
  | 'confirm-actions'   // Step 3: Confirm extracted action items
  | 'complete';         // Step 4: Summary

export const REVIEW_STEPS: ReviewStep[] = [
  'briefing',
  'recording',
  'processing',
  'confirm-actions',
  'complete',
];

// Steps shown in progress bar (processing is transitional, not counted)
export const VISIBLE_STEPS: ReviewStep[] = [
  'briefing',
  'recording',
  'confirm-actions',
  'complete',
];

export const STEP_LABELS: Record<ReviewStep, string> = {
  'briefing': '会前简报',
  'recording': '会议录音',
  'processing': '处理中',
  'confirm-actions': '确认行动',
  'complete': '完成',
};

// Daily summary data (from /api/daily-summary)
export interface AgendaItem {
  category: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  evidenceCount: number;
  suggestedAction: string; // Available but NOT shown — team finds root cause themselves
  feedbacks: Array<{ tableId: string; text: string }>;
}

export interface DailySummaryData {
  total_visits: number;
  avg_sentiment: number | null;
  positive_count?: number;
  neutral_count?: number;
  negative_count?: number;
  agenda_items: AgendaItem[];
  ai_overview: string;
}

// Action item from backend
export interface ActionItemData {
  id: string;
  restaurant_id: string;
  suggestion_text: string;
  assignee: string | null;
  assigned_role: string | null;
  deadline: string | null;
  category: string;
  priority: string;
  status: string;
  action_date: string;
  source_meeting_id?: string | null;
  confirmed_at?: string | null;
}

// Editable action item for confirmation step
export interface EditableActionItem {
  id: string;
  suggestion_text: string;
  assigned_role: string;
  deadline: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

// Meeting data after processing (from meeting store)
export interface ProcessedMeetingData {
  id: string;
  aiSummary?: string;
  actionItems?: Array<{ who: string; what: string; deadline: string }>;
  keyDecisions?: Array<{ decision: string; context: string }>;
}

// Role options for assigned_role field
export const ROLE_OPTIONS = [
  { value: 'manager', label: '店长' },
  { value: 'head_chef', label: '厨师长' },
  { value: 'front_of_house', label: '前厅主管' },
  { value: 'all', label: '全员' },
] as const;

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map(r => [r.value, r.label])
);

export const CATEGORY_LABELS: Record<string, string> = {
  dish_quality: '菜品',
  service_speed: '服务',
  environment: '环境',
  staff_attitude: '态度',
  other: '其他',
};

export const SEVERITY_CONFIG = {
  high: { dot: 'bg-red-500', label: '严重', bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  medium: { dot: 'bg-yellow-500', label: '注意', bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
  low: { dot: 'bg-primary-500', label: '轻微', bg: 'bg-primary-50 border-primary-200', text: 'text-primary-700' },
};
