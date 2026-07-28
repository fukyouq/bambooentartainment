REVOKE EXECUTE ON FUNCTION public.log_article_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_rank(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.role_rank(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_rank(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.role_rank(public.app_role) TO authenticated, anon;