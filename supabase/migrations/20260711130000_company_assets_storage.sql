-- =========================================================================
-- Company assets storage bucket
--
--   * Bucket `company-assets` — holds the org logo (and future brand assets).
--   * Public READ: logos render in the sidebar and as the browser favicon,
--     which are unauthenticated fetches (no auth header), so the bucket is public.
--   * WRITE (upload/replace/delete) restricted to owner/admin via
--     public.has_any_role() on storage.objects — mirrors companies_admin_write.
--   * 2 MB cap; image mime types only.
--
-- NOTE: storage.objects already has RLS enabled by Supabase; we only add
-- bucket-scoped policies here.
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  true,
  2097152,  -- 2 MB
  ARRAY['image/png','image/jpeg','image/svg+xml','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read (sidebar logo + favicon are unauthenticated fetches).
DROP POLICY IF EXISTS "company_assets_public_read" ON storage.objects;
CREATE POLICY "company_assets_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'company-assets');

-- Owner/admin may upload …
DROP POLICY IF EXISTS "company_assets_admin_insert" ON storage.objects;
CREATE POLICY "company_assets_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[])
  );

-- … replace …
DROP POLICY IF EXISTS "company_assets_admin_update" ON storage.objects;
CREATE POLICY "company_assets_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[])
  )
  WITH CHECK (
    bucket_id = 'company-assets'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[])
  );

-- … and delete their assets.
DROP POLICY IF EXISTS "company_assets_admin_delete" ON storage.objects;
CREATE POLICY "company_assets_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[])
  );
