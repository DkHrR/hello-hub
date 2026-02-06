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
      anonymized_assessment_metrics: {
        Row: {
          age_group: string
          chaos_index: number | null
          created_at: string | null
          fixation_duration_avg: number | null
          fluency_score: number | null
          grade: string
          id: string
          language: string
          pause_count: number | null
          prosody_score: number | null
          regression_count: number | null
          wpm: number | null
        }
        Insert: {
          age_group: string
          chaos_index?: number | null
          created_at?: string | null
          fixation_duration_avg?: number | null
          fluency_score?: number | null
          grade: string
          id?: string
          language: string
          pause_count?: number | null
          prosody_score?: number | null
          regression_count?: number | null
          wpm?: number | null
        }
        Update: {
          age_group?: string
          chaos_index?: number | null
          created_at?: string | null
          fixation_duration_avg?: number | null
          fluency_score?: number | null
          grade?: string
          id?: string
          language?: string
          pause_count?: number | null
          prosody_score?: number | null
          regression_count?: number | null
          wpm?: number | null
        }
        Relationships: []
      }
      chunked_uploads: {
        Row: {
          bucket_name: string
          chunk_size: number
          chunks_uploaded: number
          completed_at: string | null
          created_at: string
          file_name: string
          id: string
          metadata: Json | null
          mime_type: string | null
          original_size: number
          status: string
          storage_prefix: string
          total_chunks: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket_name?: string
          chunk_size?: number
          chunks_uploaded?: number
          completed_at?: string | null
          created_at?: string
          file_name: string
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          original_size: number
          status?: string
          storage_prefix: string
          total_chunks: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bucket_name?: string
          chunk_size?: number
          chunks_uploaded?: number
          completed_at?: string | null
          created_at?: string
          file_name?: string
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          original_size?: number
          status?: string
          storage_prefix?: string
          total_chunks?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diagnostic_results: {
        Row: {
          adhd_probability_index: number | null
          clinician_id: string
          cognitive_avg_pupil_dilation: number | null
          cognitive_overload_events: number | null
          cognitive_stress_indicators: number | null
          created_at: string
          dysgraphia_probability_index: number | null
          dyslexia_probability_index: number | null
          eye_avg_fixation_duration: number | null
          eye_chaos_index: number | null
          eye_fixation_intersection_coefficient: number | null
          eye_prolonged_fixations: number | null
          eye_regression_count: number | null
          eye_total_fixations: number | null
          fixation_data: Json | null
          handwriting_graphic_inconsistency: number | null
          handwriting_letter_crowding: number | null
          handwriting_line_adherence: number | null
          handwriting_reversal_count: number | null
          id: string
          overall_risk_level: string | null
          saccade_data: Json | null
          session_id: string
          student_id: string | null
          user_id: string | null
          voice_avg_pause_duration: number | null
          voice_avg_stall_duration: number | null
          voice_fluency_score: number | null
          voice_pause_count: number | null
          voice_phonemic_errors: number | null
          voice_prosody_score: number | null
          voice_stall_count: number | null
          voice_stall_events: Json | null
          voice_words_per_minute: number | null
        }
        Insert: {
          adhd_probability_index?: number | null
          clinician_id: string
          cognitive_avg_pupil_dilation?: number | null
          cognitive_overload_events?: number | null
          cognitive_stress_indicators?: number | null
          created_at?: string
          dysgraphia_probability_index?: number | null
          dyslexia_probability_index?: number | null
          eye_avg_fixation_duration?: number | null
          eye_chaos_index?: number | null
          eye_fixation_intersection_coefficient?: number | null
          eye_prolonged_fixations?: number | null
          eye_regression_count?: number | null
          eye_total_fixations?: number | null
          fixation_data?: Json | null
          handwriting_graphic_inconsistency?: number | null
          handwriting_letter_crowding?: number | null
          handwriting_line_adherence?: number | null
          handwriting_reversal_count?: number | null
          id?: string
          overall_risk_level?: string | null
          saccade_data?: Json | null
          session_id: string
          student_id?: string | null
          user_id?: string | null
          voice_avg_pause_duration?: number | null
          voice_avg_stall_duration?: number | null
          voice_fluency_score?: number | null
          voice_pause_count?: number | null
          voice_phonemic_errors?: number | null
          voice_prosody_score?: number | null
          voice_stall_count?: number | null
          voice_stall_events?: Json | null
          voice_words_per_minute?: number | null
        }
        Update: {
          adhd_probability_index?: number | null
          clinician_id?: string
          cognitive_avg_pupil_dilation?: number | null
          cognitive_overload_events?: number | null
          cognitive_stress_indicators?: number | null
          created_at?: string
          dysgraphia_probability_index?: number | null
          dyslexia_probability_index?: number | null
          eye_avg_fixation_duration?: number | null
          eye_chaos_index?: number | null
          eye_fixation_intersection_coefficient?: number | null
          eye_prolonged_fixations?: number | null
          eye_regression_count?: number | null
          eye_total_fixations?: number | null
          fixation_data?: Json | null
          handwriting_graphic_inconsistency?: number | null
          handwriting_letter_crowding?: number | null
          handwriting_line_adherence?: number | null
          handwriting_reversal_count?: number | null
          id?: string
          overall_risk_level?: string | null
          saccade_data?: Json | null
          session_id?: string
          student_id?: string | null
          user_id?: string | null
          voice_avg_pause_duration?: number | null
          voice_avg_stall_duration?: number | null
          voice_fluency_score?: number | null
          voice_pause_count?: number | null
          voice_phonemic_errors?: number | null
          voice_prosody_score?: number | null
          voice_stall_count?: number | null
          voice_stall_events?: Json | null
          voice_words_per_minute?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      handwriting_samples: {
        Row: {
          analysis_complete: boolean | null
          clinician_id: string
          created_at: string
          file_path: string
          graphic_inconsistency: number | null
          id: string
          letter_crowding: number | null
          line_adherence: number | null
          recognized_text: string | null
          reversal_count: number | null
          student_id: string
        }
        Insert: {
          analysis_complete?: boolean | null
          clinician_id: string
          created_at?: string
          file_path: string
          graphic_inconsistency?: number | null
          id?: string
          letter_crowding?: number | null
          line_adherence?: number | null
          recognized_text?: string | null
          reversal_count?: number | null
          student_id: string
        }
        Update: {
          analysis_complete?: boolean | null
          clinician_id?: string
          created_at?: string
          file_path?: string
          graphic_inconsistency?: number | null
          id?: string
          letter_crowding?: number | null
          line_adherence?: number | null
          recognized_text?: string | null
          reversal_count?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handwriting_samples_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      normative_baselines: {
        Row: {
          age_group: string
          created_at: string | null
          grade: string
          id: string
          language: string
          last_updated: string | null
          mean_value: number
          metric_type: string
          percentile_10: number | null
          percentile_25: number | null
          percentile_50: number | null
          percentile_75: number | null
          percentile_90: number | null
          sample_size: number | null
          std_deviation: number
        }
        Insert: {
          age_group: string
          created_at?: string | null
          grade: string
          id?: string
          language: string
          last_updated?: string | null
          mean_value: number
          metric_type: string
          percentile_10?: number | null
          percentile_25?: number | null
          percentile_50?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          sample_size?: number | null
          std_deviation: number
        }
        Update: {
          age_group?: string
          created_at?: string | null
          grade?: string
          id?: string
          language?: string
          last_updated?: string | null
          mean_value?: number
          metric_type?: string
          percentile_10?: number | null
          percentile_25?: number | null
          percentile_50?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          sample_size?: number | null
          std_deviation?: number
        }
        Relationships: []
      }
      parent_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_student_links: {
        Row: {
          access_code: string
          expires_at: string
          id: string
          linked_at: string
          linked_by: string
          parent_id: string | null
          student_id: string
        }
        Insert: {
          access_code: string
          expires_at?: string
          id?: string
          linked_at?: string
          linked_by: string
          parent_id?: string | null
          student_id: string
        }
        Update: {
          access_code?: string
          expires_at?: string
          id?: string
          linked_at?: string
          linked_by?: string
          parent_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
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
          display_name: string | null
          email: string | null
          email_preferences: Json | null
          email_verified: boolean | null
          eye_tracking_settings: Json | null
          first_name: string | null
          id: string
          last_name: string | null
          organization: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_preferences?: Json | null
          email_verified?: boolean | null
          eye_tracking_settings?: Json | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_preferences?: Json | null
          email_verified?: boolean | null
          eye_tracking_settings?: Json | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          age: number
          clinician_id: string
          created_at: string
          grade: string
          id: string
          name: string
          notes: string | null
          risk_level: string | null
          updated_at: string
        }
        Insert: {
          age: number
          clinician_id: string
          created_at?: string
          grade: string
          id?: string
          name: string
          notes?: string | null
          risk_level?: string | null
          updated_at?: string
        }
        Update: {
          age?: number
          clinician_id?: string
          created_at?: string
          grade?: string
          id?: string
          name?: string
          notes?: string | null
          risk_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      upload_chunks: {
        Row: {
          checksum: string | null
          chunk_index: number
          id: string
          size: number
          storage_path: string
          upload_id: string
          uploaded_at: string
        }
        Insert: {
          checksum?: string | null
          chunk_index: number
          id?: string
          size: number
          storage_path: string
          upload_id: string
          uploaded_at?: string
        }
        Update: {
          checksum?: string | null
          chunk_index?: number
          id?: string
          size?: number
          storage_path?: string
          upload_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_chunks_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "chunked_uploads"
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
      verification_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
          verified_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
          verified_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
          verified_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_user_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "clinician" | "educator" | "parent" | "individual"
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
      app_role: ["clinician", "educator", "parent", "individual"],
    },
  },
} as const
