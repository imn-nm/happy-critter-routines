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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      children: {
        Row: {
          age: number | null
          bedtime: string | null
          breakfast_time: string | null
          created_at: string
          current_coins: number
          dinner_time: string | null
          id: string
          lunch_time: string | null
          name: string
          parent_id: string
          pet_happiness: number
          pet_type: string
          school_end_time: string | null
          school_start_time: string | null
          snack_time: string | null
          updated_at: string
          wake_time: string | null
        }
        Insert: {
          age?: number | null
          bedtime?: string | null
          breakfast_time?: string | null
          created_at?: string
          current_coins?: number
          dinner_time?: string | null
          id?: string
          lunch_time?: string | null
          name: string
          parent_id: string
          pet_happiness?: number
          pet_type: string
          school_end_time?: string | null
          school_start_time?: string | null
          snack_time?: string | null
          updated_at?: string
          wake_time?: string | null
        }
        Update: {
          age?: number | null
          bedtime?: string | null
          breakfast_time?: string | null
          created_at?: string
          current_coins?: number
          dinner_time?: string | null
          id?: string
          lunch_time?: string | null
          name?: string
          parent_id?: string
          pet_happiness?: number
          pet_type?: string
          school_end_time?: string | null
          school_start_time?: string | null
          snack_time?: string | null
          updated_at?: string
          wake_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_purchases: {
        Row: {
          child_id: string
          coins_spent: number
          id: string
          purchased_at: string
          reward_id: string
          status: string
        }
        Insert: {
          child_id: string
          coins_spent?: number
          id?: string
          purchased_at?: string
          reward_id: string
          status?: string
        }
        Update: {
          child_id?: string
          coins_spent?: number
          id?: string
          purchased_at?: string
          reward_id?: string
          status?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          child_id: string
          cost: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          child_id: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          child_id: string
          coins_earned: number
          completed_at: string
          date: string
          duration_spent: number | null
          id: string
          notes: string | null
          task_id: string
        }
        Insert: {
          child_id: string
          coins_earned?: number
          completed_at?: string
          date?: string
          duration_spent?: number | null
          id?: string
          notes?: string | null
          task_id: string
        }
        Update: {
          child_id?: string
          coins_earned?: number
          completed_at?: string
          date?: string
          duration_spent?: number | null
          id?: string
          notes?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sessions: {
        Row: {
          child_id: string
          ended_at: string | null
          id: string
          is_active: boolean
          started_at: string
          task_id: string
          total_duration: number | null
        }
        Insert: {
          child_id: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          started_at?: string
          task_id: string
          total_duration?: number | null
        }
        Update: {
          child_id?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          started_at?: string
          task_id?: string
          total_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          child_id: string
          coins: number
          created_at: string
          description: string | null
          duration: number | null
          id: string
          is_active: boolean
          is_recurring: boolean
          name: string
          recurring_days: string[] | null
          scheduled_time: string | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          child_id: string
          coins?: number
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name: string
          recurring_days?: string[] | null
          scheduled_time?: string | null
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          coins?: number
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name?: string
          recurring_days?: string[] | null
          scheduled_time?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
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
