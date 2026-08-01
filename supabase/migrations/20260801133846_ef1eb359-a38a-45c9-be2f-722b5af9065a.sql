-- rank functions -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_rank(_role app_role)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE _role
    WHEN 'overseer_company' THEN 4
    WHEN 'overseer_entertainment' THEN 3
    WHEN 'sonk_admin' THEN 2
    WHEN 'supervisor' THEN 2
    WHEN 'sonk_supervisor' THEN 2
    WHEN 'journalist' THEN 1
    WHEN 'sonk_moderator' THEN 1
    ELSE 0 END;
$$;

-- Sonk-specific ladder: moderator 1 < supervisor 2 < admin 3 < ent overseer 4 < company 5
CREATE OR REPLACE FUNCTION public.sonk_role_rank(_role app_role)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE _role
    WHEN 'overseer_company' THEN 5
    WHEN 'overseer_entertainment' THEN 4
    WHEN 'sonk_admin' THEN 3
    WHEN 'sonk_supervisor' THEN 2
    WHEN 'supervisor' THEN 2
    WHEN 'sonk_moderator' THEN 1
    WHEN 'journalist' THEN 1
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.sonk_rank(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE(MAX(public.sonk_role_rank(role)), 0)
  FROM public.user_roles WHERE user_id = _user_id;
$$;

-- 1. enums -----------------------------------------------------------------
CREATE TYPE public.verify_category AS ENUM ('individual','business','institution');
CREATE TYPE public.verify_status AS ENUM ('pending','approved','denied');
CREATE TYPE public.badge_kind AS ENUM ('staff','official','media','music');
CREATE TYPE public.sonk_target AS ENUM ('post','comment');
CREATE TYPE public.report_status AS ENUM ('open','actioned','dismissed');
CREATE TYPE public.ad_status AS ENUM ('draft','pending_payment','active','paused','ended');

-- 2. sonk accounts ---------------------------------------------------------
CREATE TABLE public.sonk_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sonk_accounts TO authenticated;
GRANT SELECT ON public.sonk_accounts TO anon;
GRANT ALL ON public.sonk_accounts TO service_role;
ALTER TABLE public.sonk_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sonk accounts are public" ON public.sonk_accounts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users create own sonk account" ON public.sonk_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sonk account" ON public.sonk_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_sonk_accounts BEFORE UPDATE ON public.sonk_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. status (public, derived) ---------------------------------------------
CREATE TABLE public.sonk_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  warning_count integer NOT NULL DEFAULT 0,
  banned boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sonk_status TO anon, authenticated;
GRANT ALL ON public.sonk_status TO service_role;
ALTER TABLE public.sonk_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sonk status is public" ON public.sonk_status FOR SELECT TO anon, authenticated USING (true);

-- 4. warnings -------------------------------------------------------------
CREATE TABLE public.sonk_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.sonk_warnings TO authenticated;
GRANT ALL ON public.sonk_warnings TO service_role;
ALTER TABLE public.sonk_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or moderators read warnings" ON public.sonk_warnings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.sonk_rank(auth.uid()) >= 1);
CREATE POLICY "Moderators issue warnings" ON public.sonk_warnings FOR INSERT TO authenticated
  WITH CHECK (public.sonk_rank(auth.uid()) >= 1 AND issued_by = auth.uid());
CREATE POLICY "Moderators remove warnings" ON public.sonk_warnings FOR DELETE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 1);

CREATE OR REPLACE FUNCTION public.sync_sonk_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid; cnt integer;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);
  SELECT count(*) INTO cnt FROM public.sonk_warnings WHERE user_id = uid;
  INSERT INTO public.sonk_status (user_id, warning_count, banned, updated_at)
  VALUES (uid, cnt, cnt > 3, now())
  ON CONFLICT (user_id) DO UPDATE
    SET warning_count = EXCLUDED.warning_count, banned = EXCLUDED.banned, updated_at = now();
  IF cnt >= 1 THEN
    UPDATE public.profiles SET bio = NULL, avatar_url = NULL WHERE id = uid;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER sonk_warnings_status AFTER INSERT OR DELETE ON public.sonk_warnings
FOR EACH ROW EXECUTE FUNCTION public.sync_sonk_status();

CREATE OR REPLACE FUNCTION public.sonk_warning_count(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT warning_count FROM public.sonk_status WHERE user_id = _user_id), 0);
$$;

CREATE OR REPLACE FUNCTION public.can_post_sonk(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.sonk_accounts WHERE user_id = _user_id)
     AND public.sonk_warning_count(_user_id) < 3;
$$;

-- 5. verification ---------------------------------------------------------
CREATE TABLE public.sonk_verification (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  category verify_category NOT NULL,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sonk_verification TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sonk_verification TO authenticated;
GRANT ALL ON public.sonk_verification TO service_role;
ALTER TABLE public.sonk_verification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verification marks are public" ON public.sonk_verification FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Sonk admins verify" ON public.sonk_verification FOR INSERT TO authenticated
  WITH CHECK (public.sonk_rank(auth.uid()) >= 3);
CREATE POLICY "Sonk admins change verification" ON public.sonk_verification FOR UPDATE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 3) WITH CHECK (public.sonk_rank(auth.uid()) >= 3);
CREATE POLICY "Sonk admins unverify" ON public.sonk_verification FOR DELETE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 3);

CREATE TABLE public.sonk_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category verify_category NOT NULL,
  status verify_status NOT NULL DEFAULT 'pending',
  full_name text,
  date_of_birth date,
  country text,
  city text,
  id_document_url text,
  company_documents_url text,
  written_request text,
  decision_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sonk_verification_requests TO authenticated;
GRANT ALL ON public.sonk_verification_requests TO service_role;
ALTER TABLE public.sonk_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or reviewers read requests" ON public.sonk_verification_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.sonk_rank(auth.uid()) >= 2);
CREATE POLICY "Users request verification" ON public.sonk_verification_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Owner or reviewers update requests" ON public.sonk_verification_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.sonk_rank(auth.uid()) >= 2)
  WITH CHECK (auth.uid() = user_id OR public.sonk_rank(auth.uid()) >= 2);
CREATE TRIGGER touch_verification_requests BEFORE UPDATE ON public.sonk_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. badges ---------------------------------------------------------------
CREATE TABLE public.sonk_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge badge_kind NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge)
);
GRANT SELECT ON public.sonk_badges TO anon, authenticated;
GRANT INSERT, DELETE ON public.sonk_badges TO authenticated;
GRANT ALL ON public.sonk_badges TO service_role;
ALTER TABLE public.sonk_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are public" ON public.sonk_badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff badge by supervisors, rest by sonk admins" ON public.sonk_badges FOR INSERT TO authenticated
  WITH CHECK (
    granted_by = auth.uid() AND (
      (badge = 'staff' AND public.user_rank(auth.uid()) >= 2)
      OR (badge <> 'staff' AND public.sonk_rank(auth.uid()) >= 3)
    )
  );
CREATE POLICY "Badge granters can revoke" ON public.sonk_badges FOR DELETE TO authenticated
  USING (public.user_rank(auth.uid()) >= 2 OR public.sonk_rank(auth.uid()) >= 3);

CREATE TABLE public.sonk_music_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_count integer NOT NULL DEFAULT 0,
  total_views bigint NOT NULL DEFAULT 0,
  catalogue_url text,
  status verify_status NOT NULL DEFAULT 'pending',
  decision_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sonk_music_requests TO authenticated;
GRANT ALL ON public.sonk_music_requests TO service_role;
ALTER TABLE public.sonk_music_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or reviewers read music requests" ON public.sonk_music_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.sonk_rank(auth.uid()) >= 2);
CREATE POLICY "Users request music verification" ON public.sonk_music_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Reviewers decide music requests" ON public.sonk_music_requests FOR UPDATE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 2) WITH CHECK (public.sonk_rank(auth.uid()) >= 2);
CREATE TRIGGER touch_music_requests BEFORE UPDATE ON public.sonk_music_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. moderation on content ------------------------------------------------
ALTER TABLE public.sonk_posts
  ADD COLUMN hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN blacklisted boolean NOT NULL DEFAULT false;
ALTER TABLE public.sonk_comments ADD COLUMN hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.articles ADD COLUMN video_url text;

DROP POLICY IF EXISTS "Sonk posts are public" ON public.sonk_posts;
CREATE POLICY "Visible sonk posts are public" ON public.sonk_posts FOR SELECT TO anon, authenticated
  USING (hidden = false OR auth.uid() = author_id OR public.sonk_rank(auth.uid()) >= 1);
DROP POLICY IF EXISTS "Users create own sonk posts" ON public.sonk_posts;
CREATE POLICY "Sonk members create posts" ON public.sonk_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.can_post_sonk(auth.uid()));
CREATE POLICY "Moderators update sonk posts" ON public.sonk_posts FOR UPDATE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 1) WITH CHECK (public.sonk_rank(auth.uid()) >= 1);
CREATE POLICY "Moderators delete sonk posts" ON public.sonk_posts FOR DELETE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 1);

DROP POLICY IF EXISTS "Sonk comments are public" ON public.sonk_comments;
CREATE POLICY "Visible sonk comments are public" ON public.sonk_comments FOR SELECT TO anon, authenticated
  USING (hidden = false OR auth.uid() = author_id OR public.sonk_rank(auth.uid()) >= 1);
CREATE POLICY "Moderators update sonk comments" ON public.sonk_comments FOR UPDATE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 1) WITH CHECK (public.sonk_rank(auth.uid()) >= 1);
CREATE POLICY "Moderators delete sonk comments" ON public.sonk_comments FOR DELETE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 1);

CREATE TABLE public.sonk_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type sonk_target NOT NULL,
  target_id uuid NOT NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  status report_status NOT NULL DEFAULT 'open',
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sonk_reports TO authenticated;
GRANT ALL ON public.sonk_reports TO service_role;
ALTER TABLE public.sonk_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporter or moderators read reports" ON public.sonk_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.sonk_rank(auth.uid()) >= 1);
CREATE POLICY "Users report content" ON public.sonk_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Moderators handle reports" ON public.sonk_reports FOR UPDATE TO authenticated
  USING (public.sonk_rank(auth.uid()) >= 1) WITH CHECK (public.sonk_rank(auth.uid()) >= 1);
CREATE TRIGGER touch_sonk_reports BEFORE UPDATE ON public.sonk_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sonk_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.sonk_blocks TO authenticated;
GRANT ALL ON public.sonk_blocks TO service_role;
ALTER TABLE public.sonk_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own blocks" ON public.sonk_blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Users create own blocks" ON public.sonk_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users remove own blocks" ON public.sonk_blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- 8. ads ------------------------------------------------------------------
CREATE TABLE public.sonk_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  media_url text,
  click_url text,
  target_country text,
  budget_cents integer NOT NULL DEFAULT 0,
  status ad_status NOT NULL DEFAULT 'draft',
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sonk_ad_campaigns TO authenticated;
GRANT SELECT ON public.sonk_ad_campaigns TO anon;
GRANT ALL ON public.sonk_ad_campaigns TO service_role;
ALTER TABLE public.sonk_ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active campaigns are public" ON public.sonk_ad_campaigns FOR SELECT TO anon, authenticated
  USING (status = 'active');
CREATE POLICY "Owners and sonk staff read campaigns" ON public.sonk_ad_campaigns FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.sonk_rank(auth.uid()) >= 2);
CREATE POLICY "Verified businesses and media create campaigns" ON public.sonk_ad_campaigns FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id AND (
      EXISTS (SELECT 1 FROM public.sonk_verification v WHERE v.user_id = auth.uid() AND v.category IN ('business','institution'))
      OR EXISTS (SELECT 1 FROM public.sonk_badges b WHERE b.user_id = auth.uid() AND b.badge = 'media')
    )
  );
CREATE POLICY "Owners and sonk staff update campaigns" ON public.sonk_ad_campaigns FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.sonk_rank(auth.uid()) >= 2)
  WITH CHECK (auth.uid() = owner_id OR public.sonk_rank(auth.uid()) >= 2);
CREATE POLICY "Owners delete campaigns" ON public.sonk_ad_campaigns FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);
CREATE TRIGGER touch_ad_campaigns BEFORE UPDATE ON public.sonk_ad_campaigns
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
