export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          class_id: string
          coverage_scope: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          lecture_range_end: string | null
          lecture_range_start: string | null
          project_metadata: Json
          roadmap: Json
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          coverage_scope?: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          lecture_range_end?: string | null
          lecture_range_start?: string | null
          project_metadata?: Json
          roadmap?: Json
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          coverage_scope?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          lecture_range_end?: string | null
          lecture_range_start?: string | null
          project_metadata?: Json
          roadmap?: Json
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          class_id: string | null
          color: string
          created_at: string
          date: string | null
          end_time: string | null
          id: string
          notes: string | null
          recurrence: string | null
          recurrence_days: string[] | null
          recurrence_end_date: string | null
          recurrence_start_date: string | null
          reminder_minutes_before: number | null
          start_time: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          color?: string
          created_at?: string
          date?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          recurrence?: string | null
          recurrence_days?: string[] | null
          recurrence_end_date?: string | null
          recurrence_start_date?: string | null
          reminder_minutes_before?: number | null
          start_time?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string | null
          color?: string
          created_at?: string
          date?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          recurrence?: string | null
          recurrence_days?: string[] | null
          recurrence_end_date?: string | null
          recurrence_start_date?: string | null
          reminder_minutes_before?: number | null
          start_time?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_attendance: {
        Row: {
          attended: boolean
          class_id: string
          confirmed_at: string | null
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          class_id: string
          confirmed_at?: string | null
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attended?: boolean
          class_id?: string
          confirmed_at?: string | null
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_end_date: string | null
          class_start_date: string | null
          color: string
          course_code: string | null
          created_at: string
          days_of_week: string[]
          end_time: string | null
          id: string
          instructor: string | null
          meetings: Json | null
          name: string
          recording_consent_confirmed: boolean
          recording_consent_date: string | null
          room: string | null
          semester_id: string
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          class_end_date?: string | null
          class_start_date?: string | null
          color?: string
          course_code?: string | null
          created_at?: string
          days_of_week?: string[]
          end_time?: string | null
          id?: string
          instructor?: string | null
          meetings?: Json | null
          name: string
          recording_consent_confirmed?: boolean
          recording_consent_date?: string | null
          room?: string | null
          semester_id: string
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          class_end_date?: string | null
          class_start_date?: string | null
          color?: string
          course_code?: string | null
          created_at?: string
          days_of_week?: string[]
          end_time?: string | null
          id?: string
          instructor?: string | null
          meetings?: Json | null
          name?: string
          recording_consent_confirmed?: boolean
          recording_consent_date?: string | null
          room?: string | null
          semester_id?: string
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_balances: {
        Row: {
          applied_credit_operations: string[]
          created_at: string
          fair_use_flagged: boolean
          fulfilled_stripe_anchors: string[]
          id: string
          last_grant_date: string | null
          lifetime_granted: number
          period_key: string | null
          purchased_credits: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_credits: number
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_credit_operations?: string[]
          created_at?: string
          fair_use_flagged?: boolean
          fulfilled_stripe_anchors?: string[]
          id?: string
          last_grant_date?: string | null
          lifetime_granted?: number
          period_key?: string | null
          purchased_credits?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_credits?: number
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_credit_operations?: string[]
          created_at?: string
          fair_use_flagged?: boolean
          fulfilled_stripe_anchors?: string[]
          id?: string
          last_grant_date?: string | null
          lifetime_granted?: number
          period_key?: string | null
          purchased_credits?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_credits?: number
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_tracks: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          ai_generated: boolean
          back: string
          class_id: string
          created_at: string
          front: string
          id: string
          lecture_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generated?: boolean
          back: string
          class_id: string
          created_at?: string
          front: string
          id?: string
          lecture_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generated?: boolean
          back?: string
          class_id?: string
          created_at?: string
          front?: string
          id?: string
          lecture_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      handbooks: {
        Row: {
          class_id: string
          generated_at: string
          id: string
          payload: string
          scope_key: string
          source_hash: string
          total_lectures: number
          user_id: string
        }
        Insert: {
          class_id: string
          generated_at?: string
          id?: string
          payload: string
          scope_key: string
          source_hash: string
          total_lectures?: number
          user_id: string
        }
        Update: {
          class_id?: string
          generated_at?: string
          id?: string
          payload?: string
          scope_key?: string
          source_hash?: string
          total_lectures?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handbooks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_coverage: {
        Row: {
          class_id: string
          concepts_mastered: string[]
          concepts_seen: string[]
          created_at: string
          id: string
          last_reviewed_date: string | null
          lecture_id: string | null
          proficiency: number
          sessions_reviewed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          concepts_mastered?: string[]
          concepts_seen?: string[]
          created_at?: string
          id?: string
          last_reviewed_date?: string | null
          lecture_id?: string | null
          proficiency?: number
          sessions_reviewed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          concepts_mastered?: string[]
          concepts_seen?: string[]
          created_at?: string
          id?: string
          last_reviewed_date?: string | null
          lecture_id?: string | null
          proficiency?: number
          sessions_reviewed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_coverage_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_coverage_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          actual_instructor: string | null
          ai_action_items: string[]
          ai_concepts: string[]
          ai_definitions: Json
          ai_exam_mentions: string[]
          ai_formulas: string[]
          ai_summary: string | null
          ai_title: string | null
          ai_vocabulary: string[]
          class_id: string
          created_at: string
          date: string
          duration_seconds: number | null
          id: string
          instructor_confirmed: boolean
          is_ai_estimated: boolean
          is_missed: boolean
          recording_parts: Json | null
          recording_url: string | null
          status: string
          transcript: string | null
          transcript_cleaned: boolean
          transcript_raw: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_instructor?: string | null
          ai_action_items?: string[]
          ai_concepts?: string[]
          ai_definitions?: Json
          ai_exam_mentions?: string[]
          ai_formulas?: string[]
          ai_summary?: string | null
          ai_title?: string | null
          ai_vocabulary?: string[]
          class_id: string
          created_at?: string
          date: string
          duration_seconds?: number | null
          id?: string
          instructor_confirmed?: boolean
          is_ai_estimated?: boolean
          is_missed?: boolean
          recording_parts?: Json | null
          recording_url?: string | null
          status?: string
          transcript?: string | null
          transcript_cleaned?: boolean
          transcript_raw?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_instructor?: string | null
          ai_action_items?: string[]
          ai_concepts?: string[]
          ai_definitions?: Json
          ai_exam_mentions?: string[]
          ai_formulas?: string[]
          ai_summary?: string | null
          ai_title?: string | null
          ai_vocabulary?: string[]
          class_id?: string
          created_at?: string
          date?: string
          duration_seconds?: number | null
          id?: string
          instructor_confirmed?: boolean
          is_ai_estimated?: boolean
          is_missed?: boolean
          recording_parts?: Json | null
          recording_url?: string | null
          status?: string
          transcript?: string | null
          transcript_cleaned?: boolean
          transcript_raw?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lectures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          attachments: string[]
          class_id: string
          content: string | null
          created_at: string
          id: string
          lecture_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: string[]
          class_id: string
          content?: string | null
          created_at?: string
          id?: string
          lecture_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: string[]
          class_id?: string
          content?: string | null
          created_at?: string
          id?: string
          lecture_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_questions: {
        Row: {
          ai_generated: boolean
          answer: string
          class_id: string
          created_at: string
          id: string
          lecture_id: string | null
          options: string[]
          question: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generated?: boolean
          answer: string
          class_id: string
          created_at?: string
          id?: string
          lecture_id?: string | null
          options?: string[]
          question: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generated?: boolean
          answer?: string
          class_id?: string
          created_at?: string
          id?: string
          lecture_id?: string | null
          options?: string[]
          question?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_questions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_questions_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_stripe_events: {
        Row: {
          anchor_id: string
          attempt_count: number
          completed_at: string | null
          credits_granted: number
          id: string
          kind: string
          last_error: string | null
          processed_at: string
          status: string | null
          stripe_event_id: string | null
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          anchor_id: string
          attempt_count?: number
          completed_at?: string | null
          credits_granted?: number
          id?: string
          kind: string
          last_error?: string | null
          processed_at?: string
          status?: string | null
          stripe_event_id?: string | null
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          anchor_id?: string
          attempt_count?: number
          completed_at?: string | null
          credits_granted?: number
          id?: string
          kind?: string
          last_error?: string | null
          processed_at?: string
          status?: string | null
          stripe_event_id?: string | null
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      semesters: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_records: {
        Row: {
          class_id: string | null
          created_at: string
          cycles_completed: number | null
          date: string
          duration_seconds: number
          goal_minutes: number | null
          id: string
          lectures_covered: number
          mode: string | null
          quiz_questions_count: number | null
          quiz_score: number | null
          study_mode: string | null
          study_type: string
          topics_reviewed: string[]
          total_lectures: number
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          cycles_completed?: number | null
          date: string
          duration_seconds: number
          goal_minutes?: number | null
          id?: string
          lectures_covered?: number
          mode?: string | null
          quiz_questions_count?: number | null
          quiz_score?: number | null
          study_mode?: string | null
          study_type?: string
          topics_reviewed?: string[]
          total_lectures?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          cycles_completed?: number | null
          date?: string
          duration_seconds?: number
          goal_minutes?: number | null
          id?: string
          lectures_covered?: number
          mode?: string | null
          quiz_questions_count?: number | null
          quiz_score?: number | null
          study_mode?: string | null
          study_type?: string
          topics_reviewed?: string[]
          total_lectures?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_session_reviews: {
        Row: {
          ai_interactions: Json
          class_id: string
          coverage_percentage: number | null
          created_at: string
          id: string
          in_depth_score: number | null
          lecture_ids: string[]
          overall_score: number | null
          proficiency_score: number | null
          review_questions: Json
          self_assessment: Json
          study_record_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_interactions?: Json
          class_id: string
          coverage_percentage?: number | null
          created_at?: string
          id?: string
          in_depth_score?: number | null
          lecture_ids?: string[]
          overall_score?: number | null
          proficiency_score?: number | null
          review_questions?: Json
          self_assessment?: Json
          study_record_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_interactions?: Json
          class_id?: string
          coverage_percentage?: number | null
          created_at?: string
          id?: string
          in_depth_score?: number | null
          lecture_ids?: string[]
          overall_score?: number | null
          proficiency_score?: number | null
          review_questions?: Json
          self_assessment?: Json
          study_record_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_session_reviews_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_session_reviews_study_record_id_fkey"
            columns: ["study_record_id"]
            isOneToOne: false
            referencedRelation: "study_records"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          assignment_id: string | null
          class_id: string
          created_at: string
          duration_minutes: number | null
          email_notified: boolean
          id: string
          lecture_id: string | null
          notes: string | null
          priority: string
          roadmap_step_index: number | null
          scheduled_date: string
          scheduled_time: string | null
          session_type: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id?: string | null
          class_id: string
          created_at?: string
          duration_minutes?: number | null
          email_notified?: boolean
          id?: string
          lecture_id?: string | null
          notes?: string | null
          priority?: string
          roadmap_step_index?: number | null
          scheduled_date: string
          scheduled_time?: string | null
          session_type?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string | null
          class_id?: string
          created_at?: string
          duration_minutes?: number | null
          email_notified?: boolean
          id?: string
          lecture_id?: string | null
          notes?: string | null
          priority?: string
          roadmap_step_index?: number | null
          scheduled_date?: string
          scheduled_time?: string | null
          session_type?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      system_state: {
        Row: {
          id: string
          key: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          audio_seconds: number
          base44_credits: number
          call_count: number
          cedar_credits_charged: number
          cost_cad: number
          credit_operation_id: string | null
          feature: string
          id: string
          input_tokens: number
          latency_ms: number
          lecture_id: string | null
          model: string | null
          occurred_at: string
          output_tokens: number
          provider: string | null
          success: boolean
          tier_at_time: string | null
          user_id: string
        }
        Insert: {
          audio_seconds?: number
          base44_credits?: number
          call_count?: number
          cedar_credits_charged?: number
          cost_cad?: number
          credit_operation_id?: string | null
          feature: string
          id?: string
          input_tokens?: number
          latency_ms?: number
          lecture_id?: string | null
          model?: string | null
          occurred_at?: string
          output_tokens?: number
          provider?: string | null
          success?: boolean
          tier_at_time?: string | null
          user_id: string
        }
        Update: {
          audio_seconds?: number
          base44_credits?: number
          call_count?: number
          cedar_credits_charged?: number
          cost_cad?: number
          credit_operation_id?: string | null
          feature?: string
          id?: string
          input_tokens?: number
          latency_ms?: number
          lecture_id?: string | null
          model?: string | null
          occurred_at?: string
          output_tokens?: number
          provider?: string | null
          success?: boolean
          tier_at_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
