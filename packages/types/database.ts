// Lingtin Database Types (Simplified for MVP)
// v1.0
// Full types can be regenerated using: pnpm supabase:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Lingtin Core Tables
      lingtin_visit_records: {
        Row: {
          id: string;
          restaurant_id: string;
          employee_id: string | null;
          table_id: string;
          audio_url: string;
          duration_seconds: number | null;
          raw_transcript: string | null;
          corrected_transcript: string | null;
          visit_type: string | null;
          sentiment_score: number | null;
          service_stage: string | null;
          ai_summary: string | null;
          visit_date: string;
          visit_period: string | null;
          status: string;
          processed_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          employee_id?: string | null;
          table_id: string;
          audio_url: string;
          duration_seconds?: number | null;
          raw_transcript?: string | null;
          corrected_transcript?: string | null;
          visit_type?: string | null;
          sentiment_score?: number | null;
          service_stage?: string | null;
          ai_summary?: string | null;
          visit_date?: string;
          visit_period?: string | null;
          status?: string;
          processed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          employee_id?: string | null;
          table_id?: string;
          audio_url?: string;
          duration_seconds?: number | null;
          raw_transcript?: string | null;
          corrected_transcript?: string | null;
          visit_type?: string | null;
          sentiment_score?: number | null;
          service_stage?: string | null;
          ai_summary?: string | null;
          visit_date?: string;
          visit_period?: string | null;
          status?: string;
          processed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      lingtin_dish_mentions: {
        Row: {
          id: string;
          visit_id: string;
          dish_name: string;
          sentiment: string;
          feedback_text: string | null;
          mention_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          dish_name: string;
          sentiment?: string;
          feedback_text?: string | null;
          mention_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          dish_name?: string;
          sentiment?: string;
          feedback_text?: string | null;
          mention_count?: number;
          created_at?: string;
        };
      };
      lingtin_table_sessions: {
        Row: {
          id: string;
          restaurant_id: string;
          session_date: string;
          period: string;
          table_id: string;
          open_time: string | null;
          close_time: string | null;
          guest_count: number | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          session_date: string;
          period: string;
          table_id: string;
          open_time?: string | null;
          close_time?: string | null;
          guest_count?: number | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          session_date?: string;
          period?: string;
          table_id?: string;
          open_time?: string | null;
          close_time?: string | null;
          guest_count?: number | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      // Master Tables (Read-only reference)
      master_restaurant: {
        Row: {
          id: string;
          restaurant_name: string;
          brand_id: number | null;
          address: string | null;
          city: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
      master_employee: {
        Row: {
          id: string;
          username: string;
          employee_name: string;
          phone: string | null;
          restaurant_id: string | null;
          role_code: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
    };
    Views: {
      lingtin_dishname_view: {
        Row: {
          dish_name: string;
          aliases: string[];
        };
      };
    };
    Functions: {};
    Enums: {};
  };
}

// Type helpers
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];

// Convenience types
export type VisitRecord = Tables<'lingtin_visit_records'>;
export type DishMention = Tables<'lingtin_dish_mentions'>;
export type TableSession = Tables<'lingtin_table_sessions'>;
export type Restaurant = Tables<'master_restaurant'>;
export type Employee = Tables<'master_employee'>;
export type DishName = Views<'lingtin_dishname_view'>;
