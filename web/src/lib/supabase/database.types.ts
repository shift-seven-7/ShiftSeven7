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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      employee_requests: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          file_name: string | null
          file_url: string | null
          handled_by: string | null
          id: string
          manager_comment: string | null
          notes: string | null
          staff_id: string
          staff_name: string
          start_date: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          handled_by?: string | null
          id?: string
          manager_comment?: string | null
          notes?: string | null
          staff_id: string
          staff_name: string
          start_date?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          handled_by?: string | null
          id?: string
          manager_comment?: string | null
          notes?: string | null
          staff_id?: string
          staff_name?: string
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          facility: string
          id: string
          name: string
          required_role: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          facility: string
          id?: string
          name: string
          required_role: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          facility?: string
          id?: string
          name?: string
          required_role?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_facility_fkey"
            columns: ["facility"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          actual_end: string
          actual_start: string
          approved_by: string | null
          created_at: string
          created_by: string | null
          date: string
          facility_id: string
          id: string
          is_emergency_override: boolean
          is_published: boolean
          override_reason: string | null
          post_id: string
          post_name: string | null
          shift_code: string
          shift_template_id: string
          staff_id: string
          staff_name: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_end: string
          actual_start: string
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          facility_id: string
          id?: string
          is_emergency_override?: boolean
          is_published?: boolean
          override_reason?: string | null
          post_id: string
          post_name?: string | null
          shift_code: string
          shift_template_id: string
          staff_id: string
          staff_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end?: string
          actual_start?: string
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          facility_id?: string
          id?: string
          is_emergency_override?: boolean
          is_published?: boolean
          override_reason?: string | null
          post_id?: string
          post_name?: string | null
          shift_code?: string
          shift_template_id?: string
          staff_id?: string
          staff_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_requests: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          facility_id: string
          id: string
          shift_code: string
          shift_template_id: string
          staff_id: string
          staff_name: string
          status: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          facility_id: string
          id?: string
          shift_code: string
          shift_template_id: string
          staff_id: string
          staff_name: string
          status?: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          facility_id?: string
          id?: string
          shift_code?: string
          shift_template_id?: string
          staff_id?: string
          staff_name?: string
          status?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_requests_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          applicable_roles: string[]
          category: string
          code: string
          color: string | null
          created_at: string
          created_by: string | null
          duration_hours: number
          end_time: string
          facility: string | null
          id: string
          name: string
          post_number: number | null
          start_time: string
          updated_at: string
        }
        Insert: {
          applicable_roles: string[]
          category: string
          code: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          duration_hours: number
          end_time: string
          facility?: string | null
          id?: string
          name: string
          post_number?: number | null
          start_time: string
          updated_at?: string
        }
        Update: {
          applicable_roles?: string[]
          category?: string
          code?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          duration_hours?: number
          end_time?: string
          facility?: string | null
          id?: string
          name?: string
          post_number?: number | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_facility_fkey"
            columns: ["facility"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          access_level: Database["public"]["Enums"]["app_role"]
          created_at: string
          created_by: string | null
          email: string | null
          employee_id: string
          full_name: string
          id: string
          medical_check_expiry: string | null
          phone: string | null
          primary_facility: string
          qualification: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
          weapon_license_expiry: string | null
          weapon_refresh_expiry: string | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          employee_id: string
          full_name: string
          id?: string
          medical_check_expiry?: string | null
          phone?: string | null
          primary_facility: string
          qualification?: string
          role: string
          status?: string
          updated_at?: string
          user_id?: string | null
          weapon_license_expiry?: string | null
          weapon_refresh_expiry?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          employee_id?: string
          full_name?: string
          id?: string
          medical_check_expiry?: string | null
          phone?: string | null
          primary_facility?: string
          qualification?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          weapon_license_expiry?: string | null
          weapon_refresh_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_primary_facility_fkey"
            columns: ["primary_facility"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_credential_notification_state: {
        Row: {
          credential_key: string
          staff_id: string
          state: string
          updated_at: string
        }
        Insert: {
          credential_key: string
          staff_id: string
          state?: string
          updated_at?: string
        }
        Update: {
          credential_key?: string
          staff_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_credential_notification_state_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_requirements: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          day_group: string
          dispatcher: number
          facility_id: string
          guard: number
          id: string
          supervisor: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          day_group: string
          dispatcher?: number
          facility_id: string
          guard?: number
          id?: string
          supervisor?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          day_group?: string
          dispatcher?: number
          facility_id?: string
          guard?: number
          id?: string
          supervisor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_requirements_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "scheduler" | "employee" | "no_access"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "scheduler", "employee", "no_access"],
    },
  },
} as const
