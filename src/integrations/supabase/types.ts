export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      company_settings: {
        Row: {
          created_at: string;
          expected_work_minutes: number;
          grace_period_minutes: number;
          id: boolean;
          max_break_minutes: number;
          timezone: string;
          updated_at: string;
          weekend_days: number[];
          work_start_time: string;
        };
        Insert: {
          created_at?: string;
          expected_work_minutes?: number;
          grace_period_minutes?: number;
          id?: boolean;
          max_break_minutes?: number;
          timezone?: string;
          updated_at?: string;
          weekend_days?: number[];
          work_start_time?: string;
        };
        Update: {
          created_at?: string;
          expected_work_minutes?: number;
          grace_period_minutes?: number;
          id?: boolean;
          max_break_minutes?: number;
          timezone?: string;
          updated_at?: string;
          weekend_days?: number[];
          work_start_time?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      holidays: {
        Row: {
          created_at: string;
          holiday_date: string;
          id: string;
          is_full_day: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          holiday_date: string;
          id?: string;
          is_full_day?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          holiday_date?: string;
          id?: string;
          is_full_day?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          department_id: string | null;
          display_name: string | null;
          email: string;
          full_name: string | null;
          id: string;
          job_title: string | null;
          last_seen_at: string | null;
          locale: string | null;
          status: Database["public"]["Enums"]["employee_status"];
          team_id: string | null;
          timezone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          department_id?: string | null;
          display_name?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          job_title?: string | null;
          last_seen_at?: string | null;
          locale?: string | null;
          status?: Database["public"]["Enums"]["employee_status"];
          team_id?: string | null;
          timezone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          department_id?: string | null;
          display_name?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          job_title?: string | null;
          last_seen_at?: string | null;
          locale?: string | null;
          status?: Database["public"]["Enums"]["employee_status"];
          team_id?: string | null;
          timezone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          department_id: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department_id?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department_id?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      work_session_breaks: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          session_id: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          ended_at?: string | null;
          id?: string;
          session_id: string;
          started_at: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          ended_at?: string | null;
          id?: string;
          session_id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_session_breaks_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "work_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      work_sessions: {
        Row: {
          attendance_status: Database["public"]["Enums"]["attendance_status"];
          break_seconds: number;
          browser: string | null;
          created_at: string;
          device: string | null;
          finished_at: string | null;
          id: string;
          ip: string | null;
          late_minutes: number;
          location: string | null;
          notes: string | null;
          overtime_seconds: number;
          session_status: Database["public"]["Enums"]["work_session_status"];
          started_at: string | null;
          timezone: string | null;
          updated_at: string;
          user_id: string;
          work_date: string;
          working_seconds: number;
        };
        Insert: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"];
          break_seconds?: number;
          browser?: string | null;
          created_at?: string;
          device?: string | null;
          finished_at?: string | null;
          id?: string;
          ip?: string | null;
          late_minutes?: number;
          location?: string | null;
          notes?: string | null;
          overtime_seconds?: number;
          session_status?: Database["public"]["Enums"]["work_session_status"];
          started_at?: string | null;
          timezone?: string | null;
          updated_at?: string;
          user_id: string;
          work_date: string;
          working_seconds?: number;
        };
        Update: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"];
          break_seconds?: number;
          browser?: string | null;
          created_at?: string;
          device?: string | null;
          finished_at?: string | null;
          id?: string;
          ip?: string | null;
          late_minutes?: number;
          location?: string | null;
          notes?: string | null;
          overtime_seconds?: number;
          session_status?: Database["public"]["Enums"]["work_session_status"];
          started_at?: string | null;
          timezone?: string | null;
          updated_at?: string;
          user_id?: string;
          work_date?: string;
          working_seconds?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_roles: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"][];
      };
      current_work_date: { Args: never; Returns: string };
      end_break: {
        Args: never;
        Returns: {
          created_at: string;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          session_id: string;
          started_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "work_session_breaks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finish_work_session: {
        Args: never;
        Returns: {
          attendance_status: Database["public"]["Enums"]["attendance_status"];
          break_seconds: number;
          browser: string | null;
          created_at: string;
          device: string | null;
          finished_at: string | null;
          id: string;
          ip: string | null;
          late_minutes: number;
          location: string | null;
          notes: string | null;
          overtime_seconds: number;
          session_status: Database["public"]["Enums"]["work_session_status"];
          started_at: string | null;
          timezone: string | null;
          updated_at: string;
          user_id: string;
          work_date: string;
          working_seconds: number;
        };
        SetofOptions: {
          from: "*";
          to: "work_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      start_break: {
        Args: never;
        Returns: {
          created_at: string;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          session_id: string;
          started_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "work_session_breaks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_work_session: {
        Args: {
          _browser?: string;
          _device?: string;
          _ip?: string;
          _location?: string;
        };
        Returns: {
          attendance_status: Database["public"]["Enums"]["attendance_status"];
          break_seconds: number;
          browser: string | null;
          created_at: string;
          device: string | null;
          finished_at: string | null;
          id: string;
          ip: string | null;
          late_minutes: number;
          location: string | null;
          notes: string | null;
          overtime_seconds: number;
          session_status: Database["public"]["Enums"]["work_session_status"];
          started_at: string | null;
          timezone: string | null;
          updated_at: string;
          user_id: string;
          work_date: string;
          working_seconds: number;
        };
        SetofOptions: {
          from: "*";
          to: "work_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "hr"
        | "project_manager"
        | "team_lead"
        | "employee"
        | "intern"
        | "viewer";
      attendance_status:
        | "in_progress"
        | "on_time"
        | "late"
        | "absent"
        | "weekend"
        | "holiday"
        | "half_day"
        | "leave";
      employee_status: "active" | "invited" | "suspended" | "offboarded";
      work_session_status: "not_started" | "working" | "on_break" | "finished";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "admin",
        "hr",
        "project_manager",
        "team_lead",
        "employee",
        "intern",
        "viewer",
      ],
      attendance_status: [
        "in_progress",
        "on_time",
        "late",
        "absent",
        "weekend",
        "holiday",
        "half_day",
        "leave",
      ],
      employee_status: ["active", "invited", "suspended", "offboarded"],
      work_session_status: ["not_started", "working", "on_break", "finished"],
    },
  },
} as const;
