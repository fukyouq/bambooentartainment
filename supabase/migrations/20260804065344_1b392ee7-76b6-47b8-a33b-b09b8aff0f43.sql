ALTER TABLE public.sonk_verification_requests
  ADD COLUMN IF NOT EXISTS article_links text[] NOT NULL DEFAULT '{}';