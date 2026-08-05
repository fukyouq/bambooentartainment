-- 1. Moderation audit log (staff-only)
CREATE TABLE public.sonk_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  subject_id uuid,
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sonk_moderation_log TO authenticated;
GRANT ALL ON public.sonk_moderation_log TO service_role;

ALTER TABLE public.sonk_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderation log visible to staff"
ON public.sonk_moderation_log FOR SELECT TO authenticated
USING (public.sonk_rank(auth.uid()) >= 1);

CREATE INDEX sonk_moderation_log_created_idx ON public.sonk_moderation_log (created_at DESC);

-- Status changes (warning_count / banned)
CREATE OR REPLACE FUNCTION public.log_sonk_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.warning_count IS NOT DISTINCT FROM OLD.warning_count
     AND NEW.banned IS NOT DISTINCT FROM OLD.banned THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.sonk_moderation_log (target_type, target_id, subject_id, actor_id, action, details)
  VALUES ('user', NEW.user_id, NEW.user_id, auth.uid(),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'status_created'
      WHEN NEW.banned IS DISTINCT FROM OLD.banned THEN (CASE WHEN NEW.banned THEN 'banned' ELSE 'unbanned' END)
      ELSE 'warning_count_changed'
    END,
    jsonb_build_object(
      'warning_count', NEW.warning_count,
      'previous_warning_count', CASE WHEN TG_OP = 'UPDATE' THEN OLD.warning_count ELSE NULL END,
      'banned', NEW.banned
    ));
  RETURN NULL;
END;
$$;

CREATE TRIGGER sonk_status_audit
AFTER INSERT OR UPDATE ON public.sonk_status
FOR EACH ROW EXECUTE FUNCTION public.log_sonk_status_change();

-- Visibility changes on posts
CREATE OR REPLACE FUNCTION public.log_sonk_post_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hidden IS NOT DISTINCT FROM OLD.hidden
     AND NEW.blacklisted IS NOT DISTINCT FROM OLD.blacklisted THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.sonk_moderation_log (target_type, target_id, subject_id, actor_id, action, details)
  VALUES ('post', NEW.id, NEW.author_id, auth.uid(),
    CASE
      WHEN NEW.blacklisted IS DISTINCT FROM OLD.blacklisted
        THEN (CASE WHEN NEW.blacklisted THEN 'post_blacklisted' ELSE 'post_unblacklisted' END)
      ELSE (CASE WHEN NEW.hidden THEN 'post_hidden' ELSE 'post_unhidden' END)
    END,
    jsonb_build_object('hidden', NEW.hidden, 'blacklisted', NEW.blacklisted, 'kind', NEW.kind));
  RETURN NULL;
END;
$$;

CREATE TRIGGER sonk_posts_audit
AFTER UPDATE ON public.sonk_posts
FOR EACH ROW EXECUTE FUNCTION public.log_sonk_post_visibility();

-- Visibility changes on comments
CREATE OR REPLACE FUNCTION public.log_sonk_comment_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hidden IS NOT DISTINCT FROM OLD.hidden THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.sonk_moderation_log (target_type, target_id, subject_id, actor_id, action, details)
  VALUES ('comment', NEW.id, NEW.author_id, auth.uid(),
    CASE WHEN NEW.hidden THEN 'comment_hidden' ELSE 'comment_unhidden' END,
    jsonb_build_object('hidden', NEW.hidden, 'post_id', NEW.post_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER sonk_comments_audit
AFTER UPDATE ON public.sonk_comments
FOR EACH ROW EXECUTE FUNCTION public.log_sonk_comment_visibility();

-- 2. Users may remove their own music badge
CREATE POLICY "Users revoke own music badge"
ON public.sonk_badges FOR DELETE TO authenticated
USING (auth.uid() = user_id AND badge = 'music'::badge_kind);

-- 3. Harden ad campaign financial fields
CREATE OR REPLACE FUNCTION public.validate_ad_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE staff boolean;
BEGIN
  staff := public.sonk_rank(auth.uid()) >= 2;

  IF NEW.budget_cents IS NULL OR NEW.budget_cents <= 0 THEN
    RAISE EXCEPTION 'Budget must be greater than zero';
  END IF;
  IF NEW.budget_cents > 100000000 THEN
    RAISE EXCEPTION 'Budget may not exceed 1,000,000';
  END IF;
  IF NEW.budget_cents % 100 <> 0 THEN
    RAISE EXCEPTION 'Budget must be a whole amount';
  END IF;

  IF NOT staff THEN
    IF TG_OP = 'INSERT' THEN
      NEW.payment_reference := NULL;
      IF NEW.status NOT IN ('draft', 'pending_payment') THEN
        RAISE EXCEPTION 'New campaigns must start as draft or pending payment';
      END IF;
    ELSE
      NEW.payment_reference := OLD.payment_reference;
      IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Campaign ownership cannot be changed';
      END IF;
      IF NEW.status = 'active' AND OLD.status <> 'active' THEN
        RAISE EXCEPTION 'Only Sonk staff can activate a campaign';
      END IF;
      IF NEW.budget_cents IS DISTINCT FROM OLD.budget_cents
         AND OLD.status NOT IN ('draft', 'pending_payment') THEN
        RAISE EXCEPTION 'Budget can only be changed while the campaign is a draft or awaiting payment';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;