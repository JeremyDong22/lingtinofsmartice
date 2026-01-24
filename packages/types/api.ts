// Lingtin API Types
// v1.0

// Audio Upload
export interface AudioUploadRequest {
  file: File;
  table_id: string;
  restaurant_id: string;
  employee_id?: string;
}

export interface AudioUploadResponse {
  visit_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  audio_url: string;
}

export interface AudioStatusResponse {
  visit_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed_at?: string;
  error_message?: string;
}

// Dashboard
export interface CoverageStats {
  periods: Array<{
    period: 'lunch' | 'dinner';
    open_count: number;
    visit_count: number;
    coverage: number;
    status: 'good' | 'warning' | 'critical';
  }>;
}

export interface DishRanking {
  dishes: Array<{
    dish_name: string;
    mention_count: number;
    positive: number;
    negative: number;
    neutral: number;
  }>;
}

export interface SentimentTrend {
  trend: Array<{
    date: string;
    avg_sentiment: number;
    count: number;
  }>;
}

// Chat
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export interface ChatStreamEvent {
  type: 'text' | 'sql' | 'result' | 'error';
  content: string;
}
