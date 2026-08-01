-- 1. Roles ------------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sonk_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sonk_supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sonk_moderator';
