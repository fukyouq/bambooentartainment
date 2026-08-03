-- user_roles: no public exposure
DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public.user_roles;
REVOKE SELECT ON public.user_roles FROM anon;
CREATE POLICY "Users see own roles or staff see all"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.user_rank(auth.uid()) >= 2 OR public.sonk_rank(auth.uid()) >= 2);

-- sonk_accounts: signed-in only
DROP POLICY IF EXISTS "Sonk accounts are public" ON public.sonk_accounts;
REVOKE SELECT ON public.sonk_accounts FROM anon;
CREATE POLICY "Sonk accounts visible to members"
  ON public.sonk_accounts FOR SELECT TO authenticated
  USING (true);

-- sonk_status: signed-in only
DROP POLICY IF EXISTS "Sonk status is public" ON public.sonk_status;
REVOKE SELECT ON public.sonk_status FROM anon;
CREATE POLICY "Sonk status visible to members"
  ON public.sonk_status FOR SELECT TO authenticated
  USING (true);