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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          meta: Json
          project_id: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["activity_source"]
          summary: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          project_id?: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["activity_source"]
          summary: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          project_id?: string | null
          source_id?: string
          source_type?: Database["public"]["Enums"]["activity_source"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          action: Database["public"]["Enums"]["approval_action_kind"]
          actor_id: string | null
          approval_request_id: string
          created_at: string
          id: string
          meta: Json
          note: string | null
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action_kind"]
          actor_id?: string | null
          approval_request_id: string
          created_at?: string
          id?: string
          meta?: Json
          note?: string | null
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action_kind"]
          actor_id?: string | null
          approval_request_id?: string
          created_at?: string
          id?: string
          meta?: Json
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          assignee_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json
          requester_id: string
          status: Database["public"]["Enums"]["approval_status"]
          summary: string | null
          title: string
          type: Database["public"]["Enums"]["approval_type"]
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          requester_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          summary?: string | null
          title: string
          type?: Database["public"]["Enums"]["approval_type"]
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          requester_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          summary?: string | null
          title?: string
          type?: Database["public"]["Enums"]["approval_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          break_seconds: number
          created_at: string
          created_by: string | null
          department_id: string | null
          first_check_in_at: string | null
          id: string
          last_check_out_at: string | null
          late_minutes: number
          notes: string | null
          overtime_seconds: number
          status: Database["public"]["Enums"]["attendance_status"]
          team_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          work_date: string
          worked_seconds: number
        }
        Insert: {
          break_seconds?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          first_check_in_at?: string | null
          id?: string
          last_check_out_at?: string | null
          late_minutes?: number
          notes?: string | null
          overtime_seconds?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_date: string
          worked_seconds?: number
        }
        Update: {
          break_seconds?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          first_check_in_at?: string | null
          id?: string
          last_check_out_at?: string | null
          late_minutes?: number
          notes?: string | null
          overtime_seconds?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_date?: string
          worked_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          actor_id: string | null
          attendance_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          from_status: string | null
          id: string
          ip: string | null
          meta: Json
          occurred_at: string
          session_id: string | null
          to_status: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          attendance_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          from_status?: string | null
          id?: string
          ip?: string | null
          meta?: Json
          occurred_at?: string
          session_id?: string | null
          to_status?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          attendance_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["attendance_event_type"]
          from_status?: string | null
          id?: string
          ip?: string | null
          meta?: Json
          occurred_at?: string
          session_id?: string | null
          to_status?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_exceptions: {
        Row: {
          adjustment_minutes: number
          created_at: string
          created_by: string | null
          employee_id: string
          exception_date: string
          id: string
          paid: boolean
          reason: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjustment_minutes?: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          exception_date: string
          id?: string
          paid?: boolean
          reason: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjustment_minutes?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          exception_date?: string
          id?: string
          paid?: boolean
          reason?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_exceptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          attendance_id: string
          browser: string | null
          created_at: string
          created_by: string | null
          device: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          ip: string | null
          location: string | null
          notes: string | null
          started_at: string
          status: Database["public"]["Enums"]["work_session_status"]
          timezone: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          attendance_id: string
          browser?: string | null
          created_at?: string
          created_by?: string | null
          device?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip?: string | null
          location?: string | null
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["work_session_status"]
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_date: string
        }
        Update: {
          attendance_id?: string
          browser?: string | null
          created_at?: string
          created_by?: string | null
          device?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip?: string | null
          location?: string | null
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["work_session_status"]
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      break_sessions: {
        Row: {
          attendance_id: string
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          reason: string | null
          session_id: string
          started_at: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          attendance_id: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          reason?: string | null
          session_id: string
          started_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          attendance_id?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          reason?: string | null
          session_id?: string
          started_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_sessions_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company: string
          company_id: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          logo_hue: number
          notes: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          company: string
          company_id: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_hue?: number
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          company?: string
          company_id?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_hue?: number
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          primary_owner_id: string | null
          slug: string
          support_email: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
          work_end_time: string | null
          work_start_time: string | null
          working_days: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          primary_owner_id?: string | null
          slug: string
          support_email?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
          working_days?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          primary_owner_id?: string | null
          slug?: string
          support_email?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
          working_days?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "companies_primary_owner_id_fkey"
            columns: ["primary_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          created_at: string
          default_currency: string
          expected_work_minutes: number
          grace_period_minutes: number
          id: boolean
          max_break_minutes: number
          timezone: string
          updated_at: string
          weekend_days: number[]
          work_start_time: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          expected_work_minutes?: number
          grace_period_minutes?: number
          id?: boolean
          max_break_minutes?: number
          timezone?: string
          updated_at?: string
          weekend_days?: number[]
          work_start_time?: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          expected_work_minutes?: number
          grace_period_minutes?: number
          id?: boolean
          max_break_minutes?: number
          timezone?: string
          updated_at?: string
          weekend_days?: number[]
          work_start_time?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          attendance_id: string | null
          completed: Json
          created_at: string
          created_by: string | null
          id: string
          in_progress: Json
          need_from_others: Json
          open_dependencies: Json
          reflection: Json
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          session_summary: Json
          status: Database["public"]["Enums"]["daily_report_status"]
          submitted_at: string | null
          summary: string | null
          tomorrow_plan: Json
          updated_at: string
          updated_by: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          attendance_id?: string | null
          completed?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          in_progress?: Json
          need_from_others?: Json
          open_dependencies?: Json
          reflection?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          session_summary?: Json
          status?: Database["public"]["Enums"]["daily_report_status"]
          submitted_at?: string | null
          summary?: string | null
          tomorrow_plan?: Json
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_date: string
        }
        Update: {
          attendance_id?: string | null
          completed?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          in_progress?: Json
          need_from_others?: Json
          open_dependencies?: Json
          reflection?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          session_summary?: Json
          status?: Database["public"]["Enums"]["daily_report_status"]
          submitted_at?: string | null
          summary?: string | null
          tomorrow_plan?: Json
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_status_updates: {
        Row: {
          attendance_id: string | null
          blockers: Json
          created_at: string
          created_by: string | null
          current_focus: string | null
          help_request: Json
          id: string
          kind: Database["public"]["Enums"]["status_update_kind"]
          main_goal: string | null
          mood: string | null
          mood_note: string | null
          outlook: string | null
          priorities: Json
          progress: number | null
          submitted_at: string | null
          task_progress: Json
          updated_at: string
          updated_by: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          attendance_id?: string | null
          blockers?: Json
          created_at?: string
          created_by?: string | null
          current_focus?: string | null
          help_request?: Json
          id?: string
          kind?: Database["public"]["Enums"]["status_update_kind"]
          main_goal?: string | null
          mood?: string | null
          mood_note?: string | null
          outlook?: string | null
          priorities?: Json
          progress?: number | null
          submitted_at?: string | null
          task_progress?: Json
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_date: string
        }
        Update: {
          attendance_id?: string | null
          blockers?: Json
          created_at?: string
          created_by?: string | null
          current_focus?: string | null
          help_request?: Json
          id?: string
          kind?: Database["public"]["Enums"]["status_update_kind"]
          main_goal?: string | null
          mood?: string | null
          mood_note?: string | null
          outlook?: string | null
          priorities?: Json
          progress?: number | null
          submitted_at?: string | null
          task_progress?: Json
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_status_updates_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string | null
          name: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          name: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      dependency_requests: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          due_at: string | null
          id: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          related_task_id: string | null
          requester_id: string
          resolved_at: string | null
          state: Database["public"]["Enums"]["dependency_state"]
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["dependency_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          related_task_id?: string | null
          requester_id: string
          resolved_at?: string | null
          state?: Database["public"]["Enums"]["dependency_state"]
          tags?: string[]
          title: string
          type?: Database["public"]["Enums"]["dependency_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          related_task_id?: string | null
          requester_id?: string
          resolved_at?: string | null
          state?: Database["public"]["Enums"]["dependency_state"]
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["dependency_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dependency_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_compensation: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          employee_id: string
          hourly_rate: number | null
          id: string
          monthly_salary: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          employee_id: string
          hourly_rate?: number | null
          id?: string
          monthly_salary?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          employee_id?: string
          hourly_rate?: number | null
          id?: string
          monthly_salary?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profiles: {
        Row: {
          address_line: string | null
          bio: string | null
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string
          id: string
          nationality: string | null
          personal_email: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_line?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id: string
          id?: string
          nationality?: string | null
          personal_email?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_line?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string
          id?: string
          nationality?: string | null
          personal_email?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          employee_code: string | null
          employment_type_id: string | null
          end_date: string | null
          hire_date: string | null
          id: string
          manager_id: string | null
          position_id: string | null
          status: Database["public"]["Enums"]["employee_status"]
          team_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          work_location: string | null
          work_mode: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_code?: string | null
          employment_type_id?: string | null
          end_date?: string | null
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          position_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_location?: string | null
          work_mode?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_code?: string | null
          employment_type_id?: string | null
          end_date?: string | null
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          position_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_location?: string | null
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employment_type_id_fkey"
            columns: ["employment_type_id"]
            isOneToOne: false
            referencedRelation: "employment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_types: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      epics: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          owner_id: string | null
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epics_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          is_full_day: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          is_full_day?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          is_full_day?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentions: {
        Row: {
          actor_id: string | null
          created_at: string
          excerpt: string | null
          href: string | null
          id: string
          mentioned_user_id: string
          project_id: string | null
          seen_at: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["mention_source"]
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          excerpt?: string | null
          href?: string | null
          id?: string
          mentioned_user_id: string
          project_id?: string | null
          seen_at?: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["mention_source"]
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          excerpt?: string | null
          href?: string | null
          id?: string
          mentioned_user_id?: string
          project_id?: string | null
          seen_at?: string | null
          source_id?: string
          source_type?: Database["public"]["Enums"]["mention_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          owner_id: string | null
          progress: number
          project_id: string
          status: Database["public"]["Enums"]["milestone_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          owner_id?: string | null
          progress?: number
          project_id: string
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          progress?: number
          project_id?: string
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          categories: Json
          channels: Json
          created_at: string
          quiet_hours: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Json
          channels?: Json
          created_at?: string
          quiet_hours?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Json
          channels?: Json
          created_at?: string
          quiet_hours?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actions: Json
          actor_id: string | null
          archived_at: string | null
          body: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_name: string | null
          expires_at: string | null
          href: string | null
          id: string
          payload: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          recipient_id: string
          seen_at: string | null
          state: Database["public"]["Enums"]["notification_state"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
        }
        Insert: {
          actions?: Json
          actor_id?: string | null
          archived_at?: string | null
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string | null
          expires_at?: string | null
          href?: string | null
          id?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_id: string
          seen_at?: string | null
          state?: Database["public"]["Enums"]["notification_state"]
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
        }
        Update: {
          actions?: Json
          actor_id?: string | null
          archived_at?: string | null
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string | null
          expires_at?: string | null
          href?: string | null
          id?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_id?: string
          seen_at?: string | null
          state?: Database["public"]["Enums"]["notification_state"]
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_time: string | null
          id: string
          notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          start_time: string | null
          started_by_employee: boolean
          status: Database["public"]["Enums"]["overtime_status"]
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_time?: string | null
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          start_time?: string | null
          started_by_employee?: boolean
          status?: Database["public"]["Enums"]["overtime_status"]
          updated_at?: string
          updated_by?: string | null
          work_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          start_time?: string | null
          started_by_employee?: boolean
          status?: Database["public"]["Enums"]["overtime_status"]
          updated_at?: string
          updated_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          level: string | null
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          last_seen_at: string | null
          locale: string | null
          status: Database["public"]["Enums"]["employee_status"]
          team_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          job_title?: string | null
          last_seen_at?: string | null
          locale?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          team_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_seen_at?: string | null
          locale?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          team_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      project_activity: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          project_id: string
          summary: string
          type: Database["public"]["Enums"]["project_activity_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          project_id: string
          summary: string
          type: Database["public"]["Enums"]["project_activity_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          project_id?: string
          summary?: string
          type?: Database["public"]["Enums"]["project_activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          location: string | null
          milestone_id: string | null
          project_id: string
          starts_at: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          location?: string | null
          milestone_id?: string | null
          project_id: string
          starts_at: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          location?: string | null
          milestone_id?: string | null
          project_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_calendar_events_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          project_id: string
          project_role_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          project_id: string
          project_role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          project_id?: string
          project_role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_role_id_fkey"
            columns: ["project_role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_risks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          likelihood: Database["public"]["Enums"]["priority_level"]
          milestone_id: string | null
          mitigation: string | null
          owner_id: string | null
          project_id: string
          related_dependency_id: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["risk_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          likelihood?: Database["public"]["Enums"]["priority_level"]
          milestone_id?: string | null
          mitigation?: string | null
          owner_id?: string | null
          project_id: string
          related_dependency_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["risk_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          likelihood?: Database["public"]["Enums"]["priority_level"]
          milestone_id?: string | null
          mitigation?: string | null
          owner_id?: string | null
          project_id?: string
          related_dependency_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["risk_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_risks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risks_related_dependency_id_fkey"
            columns: ["related_dependency_id"]
            isOneToOne: false
            referencedRelation: "dependency_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      project_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          rank: number
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rank?: number
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rank?: number
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          api_docs_url: string | null
          archived_at: string | null
          client_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          end_date: string | null
          figma_url: string | null
          health: Database["public"]["Enums"]["project_health"]
          icon: string | null
          id: string
          key: string
          manager_id: string
          name: string
          priority: Database["public"]["Enums"]["priority_level"]
          repository_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          team_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_docs_url?: string | null
          archived_at?: string | null
          client_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          figma_url?: string | null
          health?: Database["public"]["Enums"]["project_health"]
          icon?: string | null
          id?: string
          key: string
          manager_id: string
          name: string
          priority?: Database["public"]["Enums"]["priority_level"]
          repository_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_docs_url?: string | null
          archived_at?: string | null
          client_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          figma_url?: string | null
          health?: Database["public"]["Enums"]["project_health"]
          icon?: string | null
          id?: string
          key?: string
          manager_id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          repository_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      report_reviews: {
        Row: {
          comment: string | null
          created_at: string
          decision: Database["public"]["Enums"]["report_review_decision"]
          id: string
          reviewer_id: string
          subject_id: string
          subject_owner: string
          subject_type: Database["public"]["Enums"]["report_review_subject"]
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decision: Database["public"]["Enums"]["report_review_decision"]
          id?: string
          reviewer_id?: string
          subject_id: string
          subject_owner: string
          subject_type: Database["public"]["Enums"]["report_review_subject"]
        }
        Update: {
          comment?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["report_review_decision"]
          id?: string
          reviewer_id?: string
          subject_id?: string
          subject_owner?: string
          subject_type?: Database["public"]["Enums"]["report_review_subject"]
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          bootstrapped_at: string | null
          bootstrapped_by: string | null
          company_id: string | null
          created_at: string
          id: boolean
          is_bootstrapped: boolean
          public_registration_enabled: boolean
          updated_at: string
        }
        Insert: {
          bootstrapped_at?: string | null
          bootstrapped_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: boolean
          is_bootstrapped?: boolean
          public_registration_enabled?: boolean
          updated_at?: string
        }
        Update: {
          bootstrapped_at?: string | null
          bootstrapped_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: boolean
          is_bootstrapped?: boolean
          public_registration_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          sprint_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          lead_id: string | null
          name: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          name: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_session_breaks: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          session_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          session_id: string
          started_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          session_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_session_breaks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          break_seconds: number
          browser: string | null
          created_at: string
          device: string | null
          finished_at: string | null
          id: string
          ip: string | null
          late_minutes: number
          location: string | null
          notes: string | null
          overtime_seconds: number
          session_status: Database["public"]["Enums"]["work_session_status"]
          started_at: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          work_date: string
          working_seconds: number
        }
        Insert: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          break_seconds?: number
          browser?: string | null
          created_at?: string
          device?: string | null
          finished_at?: string | null
          id?: string
          ip?: string | null
          late_minutes?: number
          location?: string | null
          notes?: string | null
          overtime_seconds?: number
          session_status?: Database["public"]["Enums"]["work_session_status"]
          started_at?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          work_date: string
          working_seconds?: number
        }
        Update: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          break_seconds?: number
          browser?: string | null
          created_at?: string
          device?: string | null
          finished_at?: string | null
          id?: string
          ip?: string | null
          late_minutes?: number
          location?: string | null
          notes?: string | null
          overtime_seconds?: number
          session_status?: Database["public"]["Enums"]["work_session_status"]
          started_at?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
          working_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          archived_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _overtime_pay_line: {
        Args: { _session_id: string }
        Returns: Database["public"]["CompositeTypes"]["overtime_pay_line"]
        SetofOptions: {
          from: "*"
          to: "overtime_pay_line"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _require_payroll_view: { Args: never; Returns: undefined }
      approve_overtime_session: {
        Args: { _note?: string; _session_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_time: string | null
          id: string
          notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          start_time: string | null
          started_by_employee: boolean
          status: Database["public"]["Enums"]["overtime_status"]
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "overtime_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_manage_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_review_reports: { Args: { _user_id: string }; Returns: boolean }
      current_employee_id: { Args: never; Returns: string }
      current_user_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      current_work_date: { Args: never; Returns: string }
      employees_without_attendance: {
        Args: { _work_date: string }
        Returns: string[]
      }
      employees_without_submitted_report: {
        Args: { _work_date: string }
        Returns: string[]
      }
      end_break: {
        Args: never
        Returns: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          session_id: string
          started_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "work_session_breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_overtime_session: {
        Args: never
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_time: string | null
          id: string
          notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          start_time: string | null
          started_by_employee: boolean
          status: Database["public"]["Enums"]["overtime_status"]
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "overtime_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_work_session: {
        Args: never
        Returns: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          break_seconds: number
          browser: string | null
          created_at: string
          device: string | null
          finished_at: string | null
          id: string
          ip: string | null
          late_minutes: number
          location: string | null
          notes: string | null
          overtime_seconds: number
          session_status: Database["public"]["Enums"]["work_session_status"]
          started_at: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          work_date: string
          working_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "work_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_bootstrapped: { Args: never; Returns: boolean }
      is_company_working_day: { Args: { _d: string }; Returns: boolean }
      is_overtime_reviewer: { Args: { _uid: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      job_attendance_reminders: { Args: never; Returns: undefined }
      job_missing_report_reminders: { Args: never; Returns: undefined }
      notification_reviewer_ids: { Args: never; Returns: string[] }
      overtime_full_time_hourly_rate: {
        Args: { _monthly_salary: number; _ref: string }
        Returns: number
      }
      overtime_pay_amount: {
        Args: {
          _base_hourly: number
          _multiplier: number
          _worked_seconds: number
        }
        Returns: number
      }
      overtime_pay_report: {
        Args: { _employee_id: string; _from: string; _to: string }
        Returns: Database["public"]["CompositeTypes"]["overtime_pay_line"][]
        SetofOptions: {
          from: "*"
          to: "overtime_pay_line"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      overtime_session_pay: {
        Args: { _session_id: string }
        Returns: Database["public"]["CompositeTypes"]["overtime_pay_line"]
        SetofOptions: {
          from: "*"
          to: "overtime_pay_line"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payroll_report: {
        Args: { _from: string; _to: string }
        Returns: Database["public"]["CompositeTypes"]["payroll_line"][]
        SetofOptions: {
          from: "*"
          to: "payroll_line"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_registration_enabled: { Args: never; Returns: boolean }
      reject_overtime_session: {
        Args: { _reason: string; _session_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_time: string | null
          id: string
          notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          start_time: string | null
          started_by_employee: boolean
          status: Database["public"]["Enums"]["overtime_status"]
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "overtime_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_overtime_session: {
        Args: { _employee_id: string; _notes?: string; _work_date: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_time: string | null
          id: string
          notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          start_time: string | null
          started_by_employee: boolean
          status: Database["public"]["Enums"]["overtime_status"]
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "overtime_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_break: {
        Args: never
        Returns: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          session_id: string
          started_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "work_session_breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_overtime_session: {
        Args: { _notes?: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_time: string | null
          id: string
          notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          start_time: string | null
          started_by_employee: boolean
          status: Database["public"]["Enums"]["overtime_status"]
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "overtime_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_work_session: {
        Args: {
          _browser?: string
          _device?: string
          _ip?: string
          _location?: string
        }
        Returns: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          break_seconds: number
          browser: string | null
          created_at: string
          device: string | null
          finished_at: string | null
          id: string
          ip: string | null
          late_minutes: number
          location: string | null
          notes: string | null
          overtime_seconds: number
          session_status: Database["public"]["Enums"]["work_session_status"]
          started_at: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          work_date: string
          working_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "work_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      working_days_in_month: { Args: { _ref: string }; Returns: number }
    }
    Enums: {
      activity_source:
        | "task"
        | "dependency"
        | "project"
        | "sprint"
        | "report"
        | "membership"
        | "comment"
      app_role:
        | "owner"
        | "admin"
        | "hr"
        | "project_manager"
        | "team_lead"
        | "employee"
        | "viewer"
        | "intern"
      approval_action_kind:
        | "requested"
        | "approved"
        | "rejected"
        | "cancelled"
        | "commented"
        | "reassigned"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "expired"
      approval_type:
        | "eod_report"
        | "dependency_request"
        | "project_membership"
        | "role_grant"
        | "leave_request"
        | "timesheet"
        | "generic"
      attendance_event_type:
        | "clock_in"
        | "clock_out"
        | "break_start"
        | "break_end"
        | "status_change"
        | "adjustment"
        | "auto_absent"
      attendance_status:
        | "in_progress"
        | "on_time"
        | "late"
        | "absent"
        | "weekend"
        | "holiday"
        | "half_day"
        | "leave"
      calendar_event_type:
        | "meeting"
        | "deadline"
        | "release"
        | "review"
        | "kickoff"
        | "holiday"
        | "other"
      daily_report_status: "draft" | "submitted" | "reviewed"
      dependency_state:
        | "draft"
        | "pending"
        | "accepted"
        | "in_progress"
        | "blocked"
        | "resolved"
        | "rejected"
        | "cancelled"
        | "closed"
      dependency_type:
        | "backend_api"
        | "ui_design"
        | "frontend"
        | "qa"
        | "devops"
        | "database"
        | "content"
        | "product_decision"
        | "client_feedback"
        | "bug_fix"
        | "infrastructure"
        | "security"
        | "other"
      employee_status: "active" | "invited" | "suspended" | "offboarded"
      mention_source: "comment" | "task" | "dependency" | "project" | "report"
      milestone_status: "upcoming" | "in_progress" | "done" | "missed"
      notification_category:
        | "attendance"
        | "dependencies"
        | "announcements"
        | "reports"
        | "mentions"
        | "system"
        | "approvals"
      notification_priority: "low" | "normal" | "high" | "critical"
      notification_state: "unseen" | "seen" | "read" | "archived" | "dismissed"
      notification_type:
        | "info"
        | "success"
        | "warning"
        | "critical"
        | "reminder"
      overtime_status: "pending" | "approved" | "rejected"
      priority_level: "low" | "medium" | "high" | "critical"
      project_activity_type:
        | "project_created"
        | "status_changed"
        | "health_changed"
        | "member_added"
        | "member_removed"
        | "milestone_created"
        | "milestone_reached"
        | "epic_created"
        | "risk_raised"
        | "risk_resolved"
        | "event_created"
        | "file_uploaded"
        | "report_filed"
        | "comment_added"
        | "other"
      project_health:
        | "healthy"
        | "at_risk"
        | "blocked"
        | "delayed"
        | "completed"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "archived"
        | "cancelled"
      report_review_decision: "approved" | "rejected"
      report_review_subject: "daily_report" | "status_update"
      risk_status: "open" | "mitigating" | "resolved" | "accepted" | "closed"
      status_update_kind: "morning_checkin" | "midday" | "custom"
      task_status:
        | "backlog"
        | "todo"
        | "in_progress"
        | "review"
        | "qa"
        | "done"
        | "blocked"
        | "cancelled"
      work_session_status: "not_started" | "working" | "on_break" | "finished"
    }
    CompositeTypes: {
      overtime_pay_line: {
        session_id: string | null
        employee_id: string | null
        work_date: string | null
        worked_seconds: number | null
        base_hourly: number | null
        multiplier: number | null
        amount: number | null
        currency: string | null
        status: Database["public"]["Enums"]["overtime_status"] | null
      }
      payroll_line: {
        employee_id: string | null
        employee_name: string | null
        employment_type: string | null
        currency: string | null
        monthly_salary: number | null
        hourly_rate: number | null
        working_days: number | null
        expected_days: number | null
        present_days: number | null
        absence_days: number | null
        expected_hours: number | null
        worked_hours: number | null
        paid_exception_count: number | null
        unpaid_exception_count: number | null
        paid_exception_hours: number | null
        unpaid_exception_hours: number | null
        base_pay: number | null
        overtime_hours: number | null
        overtime_pay: number | null
        overtime_pending_count: number | null
        overtime_rejected_count: number | null
        total_pay: number | null
        has_pay_data: boolean | null
      }
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
      activity_source: [
        "task",
        "dependency",
        "project",
        "sprint",
        "report",
        "membership",
        "comment",
      ],
      app_role: [
        "owner",
        "admin",
        "hr",
        "project_manager",
        "team_lead",
        "employee",
        "viewer",
        "intern",
      ],
      approval_action_kind: [
        "requested",
        "approved",
        "rejected",
        "cancelled",
        "commented",
        "reassigned",
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "expired",
      ],
      approval_type: [
        "eod_report",
        "dependency_request",
        "project_membership",
        "role_grant",
        "leave_request",
        "timesheet",
        "generic",
      ],
      attendance_event_type: [
        "clock_in",
        "clock_out",
        "break_start",
        "break_end",
        "status_change",
        "adjustment",
        "auto_absent",
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
      calendar_event_type: [
        "meeting",
        "deadline",
        "release",
        "review",
        "kickoff",
        "holiday",
        "other",
      ],
      daily_report_status: ["draft", "submitted", "reviewed"],
      dependency_state: [
        "draft",
        "pending",
        "accepted",
        "in_progress",
        "blocked",
        "resolved",
        "rejected",
        "cancelled",
        "closed",
      ],
      dependency_type: [
        "backend_api",
        "ui_design",
        "frontend",
        "qa",
        "devops",
        "database",
        "content",
        "product_decision",
        "client_feedback",
        "bug_fix",
        "infrastructure",
        "security",
        "other",
      ],
      employee_status: ["active", "invited", "suspended", "offboarded"],
      mention_source: ["comment", "task", "dependency", "project", "report"],
      milestone_status: ["upcoming", "in_progress", "done", "missed"],
      notification_category: [
        "attendance",
        "dependencies",
        "announcements",
        "reports",
        "mentions",
        "system",
        "approvals",
      ],
      notification_priority: ["low", "normal", "high", "critical"],
      notification_state: ["unseen", "seen", "read", "archived", "dismissed"],
      notification_type: ["info", "success", "warning", "critical", "reminder"],
      overtime_status: ["pending", "approved", "rejected"],
      priority_level: ["low", "medium", "high", "critical"],
      project_activity_type: [
        "project_created",
        "status_changed",
        "health_changed",
        "member_added",
        "member_removed",
        "milestone_created",
        "milestone_reached",
        "epic_created",
        "risk_raised",
        "risk_resolved",
        "event_created",
        "file_uploaded",
        "report_filed",
        "comment_added",
        "other",
      ],
      project_health: ["healthy", "at_risk", "blocked", "delayed", "completed"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "archived",
        "cancelled",
      ],
      report_review_decision: ["approved", "rejected"],
      report_review_subject: ["daily_report", "status_update"],
      risk_status: ["open", "mitigating", "resolved", "accepted", "closed"],
      status_update_kind: ["morning_checkin", "midday", "custom"],
      task_status: [
        "backlog",
        "todo",
        "in_progress",
        "review",
        "qa",
        "done",
        "blocked",
        "cancelled",
      ],
      work_session_status: ["not_started", "working", "on_break", "finished"],
    },
  },
} as const
