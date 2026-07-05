
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_roles()                  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_roles()                  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_email_confirmed()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at()                   FROM PUBLIC, anon, authenticated;
