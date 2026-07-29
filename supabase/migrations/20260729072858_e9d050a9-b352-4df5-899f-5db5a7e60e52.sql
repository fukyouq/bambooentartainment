ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.user_rank(uuid) SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.user_rank(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_rank(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_rank(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;