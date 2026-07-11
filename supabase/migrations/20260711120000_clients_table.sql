-- =========================================================================
-- SpartaFlow — Clients (CRM) core
-- Adds:
--   * public.clients            — client company / contact directory
--   * public.projects.client_id — FK linking a project to its client
--
-- Conventions reused from 20260630150000_project_execution_core.sql:
--   * uuid PKs (gen_random_uuid())        * created_at/updated_at audit fields
--   * created_by / updated_by (DEFAULT auth.uid())
--   * BEFORE-UPDATE trigger public.tg_set_updated_at()
--   * RLS enabled; authorization via public.has_any_role()
--   * grants to authenticated / service_role only — never anon
--
-- Org scoping: company_id FK to companies is present for org isolation and
-- future multi-tenancy (single-company in practice today). RLS authorization is
-- role-based, matching projects/employees, which do not filter by company_id.
--
-- Depends on: companies (20260702120000), projects (20260630150000),
--   public.has_any_role + public.tg_set_updated_at. Regenerate
--   integrations/supabase/types.ts after apply (optional — services use the
--   relaxed db client).
-- =========================================================================

-- =========================================================================
-- CLIENTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company        TEXT NOT NULL,                 -- client company name
  contact_person TEXT,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  notes          TEXT,
  logo_hue       INT NOT NULL DEFAULT 0 CHECK (logo_hue BETWEEN 0 AND 359),
  -- audit fields
  created_by     UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_name    ON public.clients(company);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_clients ON public.clients;
CREATE TRIGGER set_updated_at_clients BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- RLS POLICIES
-- Read  = any authenticated org user (broad — "broader roles can read")
-- Write = owner / admin / project_manager (the "can manage" set)
-- =========================================================================
DROP POLICY IF EXISTS "clients_read" ON public.clients;
CREATE POLICY "clients_read" ON public.clients
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "clients_write" ON public.clients;
CREATE POLICY "clients_write" ON public.clients
  FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','project_manager']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','project_manager']::public.app_role[])
  );

-- =========================================================================
-- PROJECTS ↔ CLIENTS linkage
-- =========================================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);

-- =========================================================================
-- SEED: migrate the one real client (Etihad Transit Authority)
-- The other former mock companies (Brightwash Holdings, FinX Mobile,
-- "SpartaFlow (internal)") and the local test client ("Zini Architict") are
-- intentionally NOT migrated. Idempotent, keyed on (company_id, company).
-- =========================================================================
INSERT INTO public.clients (company_id, company, contact_person, email, phone, address, notes, logo_hue)
SELECT c.id,
       'Etihad Transit Authority',
       'Mahmoud Al-Hassan',
       'ops@etihad-transit.ae',
       '+971 2 555 8821',
       'Corniche Rd, Abu Dhabi, UAE',
       'Long-running public transit modernization. Quarterly steering committee.',
       200
  FROM public.companies c
 WHERE c.slug = 'spartaflow'
   AND NOT EXISTS (
     SELECT 1 FROM public.clients x
      WHERE x.company_id = c.id AND x.company = 'Etihad Transit Authority'
   );

-- Link the existing "Etihad Bus" project (key 'EB') to the migrated client.
UPDATE public.projects p
   SET client_id = cl.id
  FROM public.clients cl
 WHERE p.key = 'EB'
   AND cl.company = 'Etihad Transit Authority'
   AND p.client_id IS DISTINCT FROM cl.id;
