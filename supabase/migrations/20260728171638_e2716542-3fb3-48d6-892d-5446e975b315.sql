-- ROLES
CREATE TYPE public.app_role AS ENUM ('overseer_company','overseer_entertainment','supervisor','journalist','user');
CREATE TYPE public.article_category AS ENUM ('breaking_news','trending','sports','global','health','food','conflicts','other');
CREATE TYPE public.sports_subcategory AS ENUM ('football','basketball','formula_1','individual_athletes');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  full_name text,
  date_of_birth date,
  email text,
  phone_number text,
  bio text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles are viewable by everyone" ON public.user_roles FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.role_rank(_role public.app_role)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'overseer_company' THEN 4
    WHEN 'overseer_entertainment' THEN 3
    WHEN 'supervisor' THEN 2
    WHEN 'journalist' THEN 1
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.user_rank(_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(public.role_rank(role)), 0) FROM public.user_roles WHERE user_id = _user_id;
$$;

-- ARTICLES
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category public.article_category NOT NULL,
  sports_subcategory public.sports_subcategory,
  event_date date NOT NULL,
  image_url text,
  keywords text[] NOT NULL DEFAULT '{}',
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT 'Bamboo Newsroom',
  blacklisted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT SELECT ON public.articles TO anon;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read live articles" ON public.articles FOR SELECT USING (blacklisted = false);
CREATE POLICY "Staff can read all articles" ON public.articles FOR SELECT TO authenticated USING (public.user_rank(auth.uid()) >= 1);
CREATE POLICY "Journalists and up can create articles" ON public.articles FOR INSERT TO authenticated WITH CHECK (public.user_rank(auth.uid()) >= 1 AND author_id = auth.uid());
CREATE POLICY "Authors and staff can update articles" ON public.articles FOR UPDATE TO authenticated USING (author_id = auth.uid() OR public.user_rank(auth.uid()) >= 3) WITH CHECK (author_id = auth.uid() OR public.user_rank(auth.uid()) >= 3);
CREATE POLICY "Supervisors and up can delete articles" ON public.articles FOR DELETE TO authenticated USING (public.user_rank(auth.uid()) >= 2);

-- COMMENTS
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.comments TO anon;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can comment" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users or staff can delete comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.user_rank(auth.uid()) >= 2);

-- SITE SETTINGS
CREATE TABLE public.site_settings (
  id boolean PRIMARY KEY DEFAULT true,
  is_open boolean NOT NULL DEFAULT true,
  closed_message text NOT NULL DEFAULT 'Bamboo Entertainment is temporarily closed. Please check back soon.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id)
);
GRANT SELECT, UPDATE ON public.site_settings TO authenticated;
GRANT SELECT ON public.site_settings TO anon;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Top overseer can update site settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'overseer_company')) WITH CHECK (public.has_role(auth.uid(),'overseer_company'));
INSERT INTO public.site_settings (id, is_open) VALUES (true, true);

-- SIGNUP HANDLING
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, email, phone_number, date_of_birth)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'phone_number',
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'didopetdim@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'overseer_company') ON CONFLICT DO NOTHING;
  ELSIF (NEW.raw_user_meta_data->>'role') IN ('overseer_entertainment','supervisor','journalist') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER articles_touch BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();