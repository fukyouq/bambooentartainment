CREATE TYPE public.article_status AS ENUM ('draft','published');

ALTER TABLE public.articles ADD COLUMN status public.article_status NOT NULL DEFAULT 'published';
UPDATE public.articles SET status = 'published';
ALTER TABLE public.articles ALTER COLUMN status SET DEFAULT 'draft';

DROP POLICY IF EXISTS "Public can read live articles" ON public.articles;
CREATE POLICY "Public can read live articles" ON public.articles
FOR SELECT TO anon, authenticated
USING (blacklisted = false AND status = 'published');

CREATE POLICY "Authors can read own articles" ON public.articles
FOR SELECT TO authenticated
USING (author_id = auth.uid());

CREATE TABLE public.saved_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_articles TO authenticated;
GRANT ALL ON public.saved_articles TO service_role;
ALTER TABLE public.saved_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved articles" ON public.saved_articles
FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.article_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  article_title text NOT NULL DEFAULT '',
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.article_audit_log TO authenticated;
GRANT ALL ON public.article_audit_log TO service_role;
ALTER TABLE public.article_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read audit log" ON public.article_audit_log
FOR SELECT TO authenticated USING (public.user_rank(auth.uid()) >= 2);
CREATE POLICY "Staff can write audit log" ON public.article_audit_log
FOR INSERT TO authenticated WITH CHECK (public.user_rank(auth.uid()) >= 1);

CREATE OR REPLACE FUNCTION public.log_article_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    act := CASE WHEN NEW.status = 'published' THEN 'published' ELSE 'created_draft' END;
    INSERT INTO public.article_audit_log (article_id, article_title, actor_id, action, details)
    VALUES (NEW.id, NEW.title, auth.uid(), act, jsonb_build_object('status', NEW.status));
    RETURN NEW;
  END IF;

  IF NEW.blacklisted IS DISTINCT FROM OLD.blacklisted THEN
    INSERT INTO public.article_audit_log (article_id, article_title, actor_id, action, details)
    VALUES (NEW.id, NEW.title, auth.uid(),
      CASE WHEN NEW.blacklisted THEN 'blacklisted' ELSE 'restored' END,
      jsonb_build_object('blacklisted', NEW.blacklisted));
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.article_audit_log (article_id, article_title, actor_id, action, details)
    VALUES (NEW.id, NEW.title, auth.uid(),
      CASE WHEN NEW.status = 'published' THEN 'published' ELSE 'unpublished' END,
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description THEN
    INSERT INTO public.article_audit_log (article_id, article_title, actor_id, action, details)
    VALUES (NEW.id, NEW.title, auth.uid(), 'edited', jsonb_build_object('old_title', OLD.title));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_article_change
AFTER INSERT OR UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.log_article_change();

CREATE TRIGGER trg_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();