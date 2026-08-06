-- 1. Storage: owner/staff-only reads of the private sonk-media bucket
DROP POLICY IF EXISTS "Sonk media readable by signed-in users" ON storage.objects;
CREATE POLICY "Owners or moderators read sonk media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'sonk-media'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.sonk_rank(auth.uid()) >= 1
  )
);

-- 2. Revoke direct EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_article_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_sonk_comment_visibility() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_sonk_post_visibility() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_sonk_status_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_public_profile_fields() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_sonk_status() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_ad_campaign() FROM anon, authenticated;

-- 3. sonk_effect_levels stays callable, but only for signed-in users
REVOKE ALL ON FUNCTION public.sonk_effect_levels(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sonk_effect_levels(uuid[]) TO authenticated;