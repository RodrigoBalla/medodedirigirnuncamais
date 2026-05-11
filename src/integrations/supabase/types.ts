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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_group_products: {
        Row: {
          group_id: string
          product_id: string
        }
        Insert: {
          group_id: string
          product_id: string
        }
        Update: {
          group_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_group_products_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_group_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      access_group_users: {
        Row: {
          group_id: string
          user_id: string
        }
        Insert: {
          group_id: string
          user_id: string
        }
        Update: {
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_group_users_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      access_groups: {
        Row: {
          created_at: string | null
          description: string | null
          eduzz_product_ids: Json | null
          eduzz_product_names: Json | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          eduzz_product_ids?: Json | null
          eduzz_product_names?: Json | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          eduzz_product_ids?: Json | null
          eduzz_product_names?: Json | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      active_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          ip_address: string | null
          last_seen_at: string
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          ip_address?: string | null
          last_seen_at?: string
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          ip_address?: string | null
          last_seen_at?: string
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          device: string | null
          id: number
          meta: Json | null
          name: string
          referrer: string | null
          session: string | null
          ts: string
          utm: Json | null
        }
        Insert: {
          device?: string | null
          id?: number
          meta?: Json | null
          name: string
          referrer?: string | null
          session?: string | null
          ts?: string
          utm?: Json | null
        }
        Update: {
          device?: string | null
          id?: number
          meta?: Json | null
          name?: string
          referrer?: string | null
          session?: string | null
          ts?: string
          utm?: Json | null
        }
        Relationships: []
      }
      cashback_config: {
        Row: {
          coins_per_brl: number
          id: number
          max_discount_pct: number
          min_coins_to_convert: number
          updated_at: string | null
          validity_days: number
        }
        Insert: {
          coins_per_brl?: number
          id?: number
          max_discount_pct?: number
          min_coins_to_convert?: number
          updated_at?: string | null
          validity_days?: number
        }
        Update: {
          coins_per_brl?: number
          id?: number
          max_discount_pct?: number
          min_coins_to_convert?: number
          updated_at?: string | null
          validity_days?: number
        }
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
        Relationships: [
          {
            foreignKeyName: "challenge_options_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "lesson_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          reference_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          reference_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          reference_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      community_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
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
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_wheel_prizes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          display_order: number
          icon: string
          id: string
          label: string
          prize_type: string
          prize_value: number
          rarity: string
          weight: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: string
          label: string
          prize_type: string
          prize_value: number
          rarity?: string
          weight?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: string
          label?: string
          prize_type?: string
          prize_value?: number
          rarity?: string
          weight?: number
        }
        Relationships: []
      }
      daily_wheel_spins: {
        Row: {
          expires_at: string
          id: string
          prize_icon: string
          prize_id: string | null
          prize_label: string
          prize_type: string
          prize_value: number
          redeemed_at: string | null
          spun_at: string
          user_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          prize_icon: string
          prize_id?: string | null
          prize_label: string
          prize_type: string
          prize_value: number
          redeemed_at?: string | null
          spun_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          prize_icon?: string
          prize_id?: string | null
          prize_label?: string
          prize_type?: string
          prize_value?: number
          redeemed_at?: string | null
          spun_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_wheel_spins_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "daily_wheel_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_coupons: {
        Row: {
          code: string
          coins_spent: number
          created_at: string
          expires_at: string
          id: string
          used: boolean
          used_at: string | null
          used_on_product_id: string | null
          user_id: string
          value_brl: number
        }
        Insert: {
          code: string
          coins_spent: number
          created_at?: string
          expires_at: string
          id?: string
          used?: boolean
          used_at?: string | null
          used_on_product_id?: string | null
          user_id: string
          value_brl: number
        }
        Update: {
          code?: string
          coins_spent?: number
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          used_on_product_id?: string | null
          user_id?: string
          value_brl?: number
        }
        Relationships: []
      }
      enrolled_emails: {
        Row: {
          email: string
          enrolled_at: string
          notes: string | null
          pending_group_ids: string[] | null
          product_id: string | null
        }
        Insert: {
          email: string
          enrolled_at?: string
          notes?: string | null
          pending_group_ids?: string[] | null
          product_id?: string | null
        }
        Update: {
          email?: string
          enrolled_at?: string
          notes?: string | null
          pending_group_ids?: string[] | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrolled_emails_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_challenges: {
        Row: {
          created_at: string
          id: string
          lesson_id: string | null
          question_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          question_text: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_challenges_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "lesson_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          lesson_id: string
          page_url: string | null
          resolved_at: string | null
          status: string
          user_agent: string | null
          user_email: string | null
          user_id: string
          video_timestamp_seconds: number
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          lesson_id: string
          page_url?: string | null
          resolved_at?: string | null
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          video_timestamp_seconds?: number
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          lesson_id?: string
          page_url?: string | null
          resolved_at?: string | null
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          video_timestamp_seconds?: number
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
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_config: {
        Row: {
          coin_expiry_days: number
          cycle_days: number
          id: number
          max_coins_per_cycle: number
          missions_per_cycle: number
          updated_at: string
        }
        Insert: {
          coin_expiry_days?: number
          cycle_days?: number
          id?: number
          max_coins_per_cycle?: number
          missions_per_cycle?: number
          updated_at?: string
        }
        Update: {
          coin_expiry_days?: number
          cycle_days?: number
          id?: number
          max_coins_per_cycle?: number
          missions_per_cycle?: number
          updated_at?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          description: string
          difficulty: string
          display_order: number
          icon: string
          id: string
          reward_coins: number
          title: string
          trigger_target: number
          trigger_type: string
        }
        Insert: {
          active?: boolean
          category?: string
          code: string
          created_at?: string
          description: string
          difficulty?: string
          display_order?: number
          icon?: string
          id?: string
          reward_coins: number
          title: string
          trigger_target: number
          trigger_type: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          description?: string
          difficulty?: string
          display_order?: number
          icon?: string
          id?: string
          reward_coins?: number
          title?: string
          trigger_target?: number
          trigger_type?: string
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
        Relationships: [
          {
            foreignKeyName: "modules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          checkout_url: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          checkout_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          checkout_url?: string | null
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
      user_missions: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          cycle_end: string
          cycle_start: string
          id: string
          mission_id: string
          progress_value: number
          rewarded_coins: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          cycle_end: string
          cycle_start: string
          id?: string
          mission_id: string
          progress_value?: number
          rewarded_coins?: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          cycle_end?: string
          cycle_start?: string
          id?: string
          mission_id?: string
          progress_value?: number
          rewarded_coins?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
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
    Views: {
      v_student_events: {
        Row: {
          at: string | null
          kind: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_student_meaningful_events: {
        Row: {
          at: string | null
          kind: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _is_admin: { Args: never; Returns: boolean }
      admin_activity_candles: {
        Args: { p_days?: number }
        Returns: {
          close_count: number
          day: string
          high_count: number
          low_count: number
          open_count: number
          total_count: number
        }[]
      }
      admin_completion_by_course: {
        Args: never
        Returns: {
          product_id: string
          product_title: string
          total_completions: number
          total_lessons: number
          unique_students_completed: number
        }[]
      }
      admin_daily_series: {
        Args: { p_days?: number; p_metric: string }
        Returns: {
          day: string
          value: number
        }[]
      }
      admin_dashboard_kpis: {
        Args: never
        Returns: {
          metric: string
          today_count: number
          total_count: number
          yesterday_count: number
        }[]
      }
      admin_grant_access_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_journey_funnel: {
        Args: never
        Returns: {
          count: number
          step_desc: string
          step_icon: string
          step_id: string
          step_label: string
          step_order: number
        }[]
      }
      admin_list_access_groups: {
        Args: never
        Returns: {
          description: string
          id: string
          name: string
        }[]
      }
      admin_list_groups_with_mapping: {
        Args: never
        Returns: {
          description: string
          eduzz_product_ids: Json
          eduzz_product_names: Json
          id: string
          member_count: number
          name: string
          product_count: number
        }[]
      }
      admin_list_students_full: {
        Args: never
        Returns: {
          avatar_url: string
          badges: Json
          coins: number
          completed_phases: number[]
          confidence: number
          created_at: string
          daily_xp: number
          display_name: string
          email: string
          groups: Json
          is_blocked: boolean
          lives: number
          phone: string
          streak: number
          total_xp: number
          user_id: string
        }[]
      }
      admin_overview_kpis: {
        Args: never
        Returns: {
          total_coupons: number
          total_courses: number
          total_lessons: number
          total_lessons_completed: number
          total_students: number
          total_wheel_spins: number
          total_xp_sum: number
        }[]
      }
      admin_recent_events: {
        Args: { p_limit?: number }
        Returns: {
          at: string
          display_name: string
          kind: string
          user_id: string
        }[]
      }
      admin_reset_student: {
        Args: { p_user_id: string }
        Returns: {
          ok: boolean
          summary: Json
        }[]
      }
      admin_revoke_access_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_group_eduzz_mapping: {
        Args: {
          p_group_id: string
          p_product_ids: string[]
          p_product_names: string[]
        }
        Returns: undefined
      }
      admin_toggle_student_blocked: {
        Args: { p_blocked: boolean; p_user_id: string }
        Returns: undefined
      }
      analytics_clear: { Args: never; Returns: Json }
      analytics_get: { Args: { p_range?: string }; Returns: Json }
      analytics_sessions_journey: { Args: { p_range?: string }; Returns: Json }
      apply_pending_grants: {
        Args: { p_email: string; p_user_id: string }
        Returns: number
      }
      assign_admin_by_email: { Args: { _email: string }; Returns: undefined }
      bootstrap_user_cycle: {
        Args: never
        Returns: {
          cycle_end: string
          cycle_start: string
          missions_count: number
        }[]
      }
      can_spin_daily_wheel: {
        Args: never
        Returns: {
          can_spin: boolean
          last_spin_at: string
          next_available_at: string
        }[]
      }
      check_enrollment: { Args: { p_email: string }; Returns: boolean }
      check_existing_user: { Args: { p_email: string }; Returns: Json }
      claim_mission: {
        Args: { p_user_mission_id: string }
        Returns: {
          granted_coins: number
          ok: boolean
          total_balance: number
        }[]
      }
      convert_coins_to_coupon: {
        Args: { p_coins_amount: number }
        Returns: {
          code: string
          expires_at: string
          remaining_coins: number
          value_brl: number
        }[]
      }
      delete_user_by_admin: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      find_groups_for_eduzz_product: {
        Args: { p_product_id: string; p_product_name: string }
        Returns: string[]
      }
      get_valid_coins_balance: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_user_missions: {
        Args: never
        Returns: {
          category: string
          claimed_at: string
          code: string
          completed_at: string
          cycle_end: string
          cycle_start: string
          description: string
          difficulty: string
          icon: string
          id: string
          mission_id: string
          progress_value: number
          reward_coins: number
          title: string
          trigger_target: number
          trigger_type: string
        }[]
      }
      pending_comments_count: { Args: never; Returns: number }
      register_active_session: {
        Args: { p_device_info?: string; p_ip?: string; p_session_token: string }
        Returns: {
          prev_session_token: string
          was_replaced: boolean
        }[]
      }
      self_report_mission: {
        Args: { p_user_mission_id: string }
        Returns: {
          granted_coins: number
          ok: boolean
          total_balance: number
        }[]
      }
      spend_coins: {
        Args: { p_amount: number; p_reason: string; p_reference?: string }
        Returns: number
      }
      spin_daily_wheel: {
        Args: never
        Returns: {
          expires_at: string
          prize_code: string
          prize_icon: string
          prize_id: string
          prize_label: string
          prize_type: string
          prize_value: number
          rarity: string
          total_balance: number
        }[]
      }
      tick_user_streak: {
        Args: never
        Returns: {
          gained_coins: number
          longest_yet: number
          milestone_reached: number
          streak: number
        }[]
      }
      track_mission_progress: {
        Args: { p_trigger_type: string; p_value?: number }
        Returns: number
      }
      vagas_disponiveis: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
