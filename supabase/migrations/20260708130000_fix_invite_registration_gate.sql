-- =========================================================================
-- SpartaFlow — Fix registration gate: allow admin invites, still block public
-- self-signup (and remove the 25P02 cascade).
--
-- Root cause: public.handle_new_user() (migration 20260702120000) gated signups
-- on `NEW.invited_at IS NOT NULL`, evaluated inside the AFTER INSERT trigger
-- on_auth_user_created. GoTrue's admin invite (auth.admin.inviteUserByEmail)
-- sets auth.users.invited_at in a follow-up UPDATE *within the same
-- transaction*, AFTER the INSERT — so at AFTER-INSERT time invited_at is still
-- NULL. Legitimate admin invites were therefore misread as public self-signups
-- and rejected with 42501 ("Public registration is disabled..."), which aborted
-- the transaction mid-flight and produced the secondary 25P02
-- ("current transaction is aborted") cascade.
--
-- Fix:
--   1. handle_new_user() becomes pure provisioning (profile + least-privilege
--      role). It no longer gates registration and no longer trusts a metadata
--      `role` — real roles are assigned by the trusted server layer (bootstrap
--      orchestrator / invite provisioning, both service-role), so a forged
--      { role } in signup metadata can never escalate.
--   2. The registration gate moves to a DEFERRED CONSTRAINT TRIGGER that fires at
--      COMMIT and re-reads invited_at. By commit, an admin invite has set
--      invited_at (allowed); a public signup has not (blocked). Firing at commit
--      also means the RAISE is the transaction's final act — nothing runs after
--      it on an aborted transaction, so the 25P02 cascade disappears.
--
-- Runtime control is unchanged: owners still toggle
-- public.system_settings.public_registration_enabled from the app; this only
-- fixes enforcement.
-- =========================================================================

-- 1. Provisioning-only handle_new_user (gate + metadata-role trust removed).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, display_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name'),
    CASE WHEN NEW.email_confirmed_at IS NULL THEN 'invited'::public.employee_status
         ELSE 'active'::public.employee_status END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Always least-privilege. The bootstrap orchestrator and invite provisioning
  -- (both service-role) grant the real role afterwards; untrusted signup
  -- metadata is never honored, so { role: 'owner' } in a self-signup is inert.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Deferred registration gate — evaluated at COMMIT, after GoTrue has set
--    invited_at for admin invites. Re-reads invited_at (rather than trusting
--    NEW, which is captured at INSERT time):
--      * admin invite  → invited_at set  at commit → allowed
--      * public signup → invited_at NULL at commit → blocked (42501)
CREATE OR REPLACE FUNCTION public.enforce_registration_gate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invited_at timestamptz;
BEGIN
  IF public.is_bootstrapped() AND NOT public.public_registration_enabled() THEN
    SELECT invited_at INTO v_invited_at FROM auth.users WHERE id = NEW.id;
    IF v_invited_at IS NULL THEN
      RAISE EXCEPTION 'Public registration is disabled. An administrator must invite you.'
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
  END IF;
  RETURN NULL; -- AFTER trigger: return value ignored
END;
$$;

DROP TRIGGER IF EXISTS enforce_registration_gate ON auth.users;
CREATE CONSTRAINT TRIGGER enforce_registration_gate
  AFTER INSERT ON auth.users
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_registration_gate();
