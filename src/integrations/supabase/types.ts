export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_group_products: {
        Row: { group_id: string; product_id: string }
        Insert: { group_id: string; product_id: string }
        Update: { group_id?: string; product_id?: string }
        Relationships: []
      }
      access_group_users: {
        Row: { group_id: string; user_id: string }
        Insert: { group_id: string; user_id: string }
        Update: { group_id?: string; user_id?: string }
        Relationships: []
      }
      access_groups: {
        Row: { created_at: string | null; description: string | null; id: string; name: string }
        Insert: { created_at?: string | null; description?: string | null; id?: string; name: string }
        Update: { created_at?: string | null; description?: string | null; id?: string; name?: string }
        Relationships: []
      }
      challenge_options: {
        Row: {
          challenge_id: string | null
          created_at: string
          destination_video_url: string | null
          id: string
          is_correct: boolean | null
          option_text: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          destination_video_url?: string | null
          id?: string
          is_correct?: boolean | null
          option_text: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          destination_video_url?: string | null
          id?: string
          is_correct?: boolean | null
          option_text?: string
        }
        Relationships: []
      }
      community_likes: {
        Row: { created_at: string; post_id: string; user_id: string }
        Insert: { created_at?: string; post_id: string; user_id: string }
        Update: { created_at?: string; post_id?: string; user_id?: string }
        Relationships: []
      }
      community_posts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_question: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_question?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_question?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_saves: {
        Row: { created_at: string; post_id: string; user_id: string }
        Insert: { created_at?: string; post_id: string; user_id: string }
        Update: { created_at?: string; post_id?: string; user_id?: string }
        Relationships: []
      }
      enrolled_emails: {
        Row: { email: string; enrolled_at: string; notes: string | null; product_id: string | null }
        Insert: { email: string; enrolled_at?: string; notes?: string | null; product_id?: string | null }
        Update: { email?: string; enrolled_at?: string; notes?: string | null; product_id?: string | null }
        Relationships: []
      }
      lesson_challenges: {
        Row: { created_at: string; id: string; lesson_id: string | null; question_text: string }
        Insert: { created_at?: string; id?: string; lesson_id?: string | null; question_text: string }
        Update: { created_at?: string; id?: string; lesson_id?: string | null; question_text?: string }
        Relationships: []
      }
      lesson_comments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string
          created_at: string
          edited: boolean
          id: string
          lesson_id: string
          pinned: boolean
          status: string
          updated_at: string
          user_id: string
          video_timestamp_seconds: number | null
          xp_awarded: boolean
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content: string
          created_at?: string
          edited?: boolean
          id?: string
          lesson_id: string
          pinned?: boolean
          status?: string
          updated_at?: string
          user_id: string
          video_timestamp_seconds?: number | null
          xp_awarded?: boolean
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          edited?: boolean
          id?: string
          lesson_id?: string
          pinned?: boolean
          status?: string
          updated_at?: string
          user_id?: string
          video_timestamp_seconds?: number | null
          xp_awarded?: boolean
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          lesson_id: string
          position_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          lesson_id: string
          position_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          lesson_id?: string
          position_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          module_id: string | null
          order_index: number | null
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          module_id?: string | null
          order_index?: number | null
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          module_id?: string | null
          order_index?: number | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      modules: {
        Row: {
          created_at: string | null
          id: string
          order_index: number | null
          product_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          product_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          product_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          click_count: number
          created_at: string
          duration_seconds: number
          entered_at: string
          id: string
          page_name: string
          page_path: string
          referrer_path: string | null
          user_id: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          duration_seconds?: number
          entered_at?: string
          id?: string
          page_name?: string
          page_path: string
          referrer_path?: string | null
          user_id: string
        }
        Update: {
          click_count?: number
          created_at?: string
          duration_seconds?: number
          entered_at?: string
          id?: string
          page_name?: string
          page_path?: string
          referrer_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_blocked: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          badges: Json | null
          coins: number | null
          completed_lessons: string[] | null
          completed_phases: number[]
          confidence: number
          created_at: string
          daily_lessons: number | null
          daily_xp: number | null
          has_completed_tutorial: boolean | null
          id: string
          last_lives_reset: string | null
          last_login_at: string | null
          league: string | null
          lives: number | null
          streak: number | null
          streak_freeze_count: number | null
          total_xp: number
          updated_at: string
          user_id: string
          welcome_video_views: number
          xp_boost_expires_at: string | null
        }
        Insert: {
          badges?: Json | null
          coins?: number | null
          completed_lessons?: string[] | null
          completed_phases?: number[]
          confidence?: number
          created_at?: string
          daily_lessons?: number | null
          daily_xp?: number | null
          has_completed_tutorial?: boolean | null
          id?: string
          last_lives_reset?: string | null
          last_login_at?: string | null
          league?: string | null
          lives?: number | null
          streak?: number | null
          streak_freeze_count?: number | null
          total_xp?: number
          updated_at?: string
          user_id: string
          welcome_video_views?: number
          xp_boost_expires_at?: string | null
        }
        Update: {
          badges?: Json | null
          coins?: number | null
          completed_lessons?: string[] | null
          completed_phases?: number[]
          confidence?: number
          created_at?: string
          daily_lessons?: number | null
          daily_xp?: number | null
          has_completed_tutorial?: boolean | null
          id?: string
          last_lives_reset?: string | null
          last_login_at?: string | null
          league?: string | null
          lives?: number | null
          streak?: number | null
          streak_freeze_count?: number | null
          total_xp?: number
          updated_at?: string
          user_id?: string
          welcome_video_views?: number
          xp_boost_expires_at?: string | null
        }
        Relationships: []
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
    Views: { [_ in never]: never }
    Functions: {
      assign_admin_by_email: { Args: { _email: string }; Returns: undefined }
      check_enrollment: { Args: { p_email: string }; Returns: boolean }
      check_existing_user: { Args: { p_email: string }; Returns: Json }
      delete_user_by_admin: { Args: { target_user_id: string }; Returns: undefined }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string }
        Returns: boolean
      }
      pending_comments_count: { Args: never; Returns: number }
      vagas_disponiveis: { Args: never; Returns: number }
    }
    Enums: { app_role: "admin" | "user" }
    CompositeTypes: { [_ in never]: never }
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
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
      app_role: ["admin", "user"],
    },
  },
} as const
