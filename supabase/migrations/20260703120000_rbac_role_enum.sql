-- =========================================================================
-- SpartaFlow — Enterprise RBAC (1/2): role enum changes
-- Canonical enterprise roles: owner, admin, hr, project_manager, team_lead,
-- employee, intern. This migration:
--   * renames the legacy `super_admin` label to `admin` — renaming an enum
--     label transparently updates every stored role row AND every RLS policy
--     that references it, so no policy rewrites are needed.
--   * adds the new `intern` role.
-- `viewer` is retained as a deprecated legacy role (Postgres cannot drop an enum
-- value without recreating the type); it stays mapped to read-only permissions.
--
-- The permission catalog + role→permission matrix are (re)seeded in the sibling
-- migration 20260703120100 — a SEPARATE file so the newly-added `intern` value
-- is committed before it is used (Postgres forbids using a freshly-added enum
-- value in the same transaction).
-- Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

-- Rename super_admin -> admin (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'app_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role RENAME VALUE 'super_admin' TO 'admin';
  END IF;
END $$;

-- Add the new intern role.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'intern';
