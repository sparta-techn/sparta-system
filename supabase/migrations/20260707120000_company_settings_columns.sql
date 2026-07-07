-- =========================================================================
-- SpartaFlow — Company settings columns
-- Backs the Owner "Edit Organization" surface (Admin Console → Organization).
-- The org identity (`public.companies`, migration 20260702120000) already holds
-- name / legal_name / timezone; this adds the remaining editable settings the
-- spec calls for: company logo, support email, and working hours.
--
-- Logo is a plain URL for now (File Attachments / Storage is out of MVP scope);
-- swap for a Storage object reference when a bucket exists.
--
-- Writes stay gated to owner/admin by the existing `companies_admin_write` RLS
-- policy — no policy change needed. Regenerate integrations/supabase/types.ts
-- after apply.
-- =========================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url        TEXT,
  ADD COLUMN IF NOT EXISTS support_email   TEXT,
  ADD COLUMN IF NOT EXISTS work_start_time TEXT,                         -- 'HH:MM' (company-local)
  ADD COLUMN IF NOT EXISTS work_end_time   TEXT,                         -- 'HH:MM' (company-local)
  ADD COLUMN IF NOT EXISTS working_days    TEXT[] NOT NULL
    DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri']::text[];
