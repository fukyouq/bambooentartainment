CREATE TYPE public.sonk_kind AS ENUM ('video','short','post');

CREATE TABLE public.sonk_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind public.sonk_kind NOT NULL DEFAULT 'post',
  title TEXT,
  body TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sonk_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sonk_posts TO authenticated;
GRANT ALL ON public.sonk_posts TO service_role;
ALTER TABLE public.sonk_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sonk posts are public" ON public.sonk_posts FOR SELECT USING (true);
CREATE POLICY "Users create own sonk posts" ON public.sonk_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users update own sonk posts" ON public.sonk_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users or staff delete sonk posts" ON public.sonk_posts FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'overseer_entertainment') OR public.has_role(auth.uid(), 'overseer_company'));

CREATE TABLE public.sonk_likes (
  post_id UUID NOT NULL REFERENCES public.sonk_posts ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.sonk_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.sonk_likes TO authenticated;
GRANT ALL ON public.sonk_likes TO service_role;
ALTER TABLE public.sonk_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sonk likes are public" ON public.sonk_likes FOR SELECT USING (true);
CREATE POLICY "Users like as themselves" ON public.sonk_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own likes" ON public.sonk_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.sonk_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.sonk_posts ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sonk_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.sonk_comments TO authenticated;
GRANT ALL ON public.sonk_comments TO service_role;
ALTER TABLE public.sonk_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sonk comments are public" ON public.sonk_comments FOR SELECT USING (true);
CREATE POLICY "Users comment as themselves" ON public.sonk_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users or staff delete sonk comments" ON public.sonk_comments FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'overseer_entertainment') OR public.has_role(auth.uid(), 'overseer_company'));

CREATE INDEX idx_sonk_posts_kind_created ON public.sonk_posts (kind, created_at DESC);
CREATE INDEX idx_sonk_comments_post ON public.sonk_comments (post_id, created_at DESC);