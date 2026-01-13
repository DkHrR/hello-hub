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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assessment_results: {
        Row: {
          ai_insights: Json | null
          assessment_id: string
          attention_score: number | null
          created_at: string
          dyslexia_biomarkers: Json | null
          id: string
          overall_risk_score: number | null
          phonological_awareness_score: number | null
          raw_data: Json | null
          reading_fluency_score: number | null
          recommendations: Json | null
          visual_processing_score: number | null
        }
        Insert: {
          ai_insights?: Json | null
          assessment_id: string
          attention_score?: number | null
          created_at?: string
          dyslexia_biomarkers?: Json | null
          id?: string
          overall_risk_score?: number | null
          phonological_awareness_score?: number | null
          raw_data?: Json | null
          reading_fluency_score?: number | null
          recommendations?: Json | null
          visual_processing_score?: number | null
        }
        Update: {
          ai_insights?: Json | null
          assessment_id?: string
          attention_score?: number | null
          created_at?: string
          dyslexia_biomarkers?: Json | null
          id?: string
          overall_risk_score?: number | null
          phonological_awareness_score?: number | null
          raw_data?: Json | null
          reading_fluency_score?: number | null
          recommendations?: Json | null
          visual_processing_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          assessor_id: string
          completed_at: string | null
          created_at: string
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["assessment_status"]
          student_id: string | null
          user_id: string | null
        }
        Insert: {
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          assessor_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          student_id?: string | null
          user_id?: string | null
        }
        Update: {
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          assessor_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          student_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      eye_tracking_data: {
        Row: {
          assessment_id: string
          average_fixation_duration: number | null
          biomarkers: Json | null
          created_at: string
          fixation_points: Json | null
          glissade_count: number | null
          id: string
          pso_count: number | null
          reading_speed_wpm: number | null
          regression_count: number | null
          saccade_count: number | null
          saccade_patterns: Json | null
        }
        Insert: {
          assessment_id: string
          average_fixation_duration?: number | null
          biomarkers?: Json | null
          created_at?: string
          fixation_points?: Json | null
          glissade_count?: number | null
          id?: string
          pso_count?: number | null
          reading_speed_wpm?: number | null
          regression_count?: number | null
          saccade_count?: number | null
          saccade_patterns?: Json | null
        }
        Update: {
          assessment_id?: string
          average_fixation_duration?: number | null
          biomarkers?: Json | null
          created_at?: string
          fixation_points?: Json | null
          glissade_count?: number | null
          id?: string
          pso_count?: number | null
          reading_speed_wpm?: number | null
          regression_count?: number | null
          saccade_count?: number | null
          saccade_patterns?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "eye_tracking_data_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          effectiveness_rating: number | null
          end_date: string | null
          id: string
          intervention_type: string
          notes: string | null
          start_date: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          effectiveness_rating?: number | null
          end_date?: string | null
          id?: string
          intervention_type: string
          notes?: string | null
          start_date?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          effectiveness_rating?: number | null
          end_date?: string | null
          id?: string
          intervention_type?: string
          notes?: string | null
          start_date?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_access_tokens: {
        Row: {
          access_code: string
          access_count: number | null
          created_at: string | null
          created_by: string
          expires_at: string
          id: string
          included_assessments: string[] | null
          last_accessed_at: string | null
          settings: Json | null
          student_id: string
        }
        Insert: {
          access_code: string
          access_count?: number | null
          created_at?: string | null
          created_by: string
          expires_at: string
          id?: string
          included_assessments?: string[] | null
          last_accessed_at?: string | null
          settings?: Json | null
          student_id: string
        }
        Update: {
          access_code?: string
          access_count?: number | null
          created_at?: string | null
          created_by?: string
          expires_at?: string
          id?: string
          included_assessments?: string[] | null
          last_accessed_at?: string | null
          settings?: Json | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_access_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          created_at: string
          created_by: string
          date_of_birth: string | null
          first_name: string
          grade_level: string | null
          id: string
          last_name: string
          notes: string | null
          school: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date_of_birth?: string | null
          first_name: string
          grade_level?: string | null
          id?: string
          last_name: string
          notes?: string | null
          school?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date_of_birth?: string | null
          first_name?: string
          grade_level?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          school?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_assessment_count: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "educator" | "clinician" | "parent"
      assessment_status: "pending" | "in_progress" | "completed" | "cancelled"
      assessment_type: "reading" | "phonological" | "visual" | "comprehensive"
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
    Enums: {
      app_role: ["admin", "educator", "clinician", "parent"],
      assessment_status: ["pending", "in_progress", "completed", "cancelled"],
      assessment_type: ["reading", "phonological", "visual", "comprehensive"],
    },
  },
} as const
