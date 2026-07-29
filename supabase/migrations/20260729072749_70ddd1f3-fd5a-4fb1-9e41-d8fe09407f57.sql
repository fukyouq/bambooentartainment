REVOKE SELECT ON public.profiles FROM anon;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.public_profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL,
  bio text,
  avatar_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT ALL ON public.public_profiles TO service_role;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profile fields are viewable by everyone" ON public.public_profiles;
CREATE POLICY "Public profile fields are viewable by everyone"
ON public.public_profiles
FOR SELECT
TO anon, authenticated
USING (true);

INSERT INTO public.public_profiles (id, username, bio, avatar_url, updated_at)
SELECT id, username, bio, avatar_url, updated_at
FROM public.profiles
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION public.sync_public_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.public_profiles (id, username, bio, avatar_url, updated_at)
  VALUES (NEW.id, NEW.username, NEW.bio, NEW.avatar_url, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    bio = EXCLUDED.bio,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_sync_public_fields ON public.profiles;
CREATE TRIGGER profiles_sync_public_fields
AFTER INSERT OR UPDATE OF username, bio, avatar_url, updated_at
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_profile_fields();