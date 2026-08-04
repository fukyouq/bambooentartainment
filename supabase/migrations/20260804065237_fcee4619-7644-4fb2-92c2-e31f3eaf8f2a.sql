-- 1. sonk_status: owner or Sonk staff only
DROP POLICY IF EXISTS "Sonk status visible to members" ON public.sonk_status;
DROP POLICY IF EXISTS "Sonk status is public" ON public.sonk_status;
CREATE POLICY "Sonk status visible to owner or staff"
ON public.sonk_status FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.sonk_rank(auth.uid()) >= 1);

-- Safe helper so the feed can apply warning effects without reading the table
CREATE OR REPLACE FUNCTION public.sonk_effect_levels(_ids uuid[])
RETURNS TABLE (user_id uuid, warning_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id, LEAST(s.warning_count, 3)
  FROM public.sonk_status s
  WHERE s.user_id = ANY(_ids) AND s.warning_count > 0;
$$;
GRANT EXECUTE ON FUNCTION public.sonk_effect_levels(uuid[]) TO anon, authenticated, service_role;

-- 2. sonk_accounts: owner or Sonk staff only
DROP POLICY IF EXISTS "Sonk accounts visible to members" ON public.sonk_accounts;
DROP POLICY IF EXISTS "Sonk accounts are public" ON public.sonk_accounts;
CREATE POLICY "Sonk accounts visible to owner or staff"
ON public.sonk_accounts FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.sonk_rank(auth.uid()) >= 1);

-- 3. Validate ad campaign financial fields
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
  IF NOT staff THEN
    IF TG_OP = 'INSERT' THEN
      NEW.payment_reference := NULL;
      IF NEW.status NOT IN ('draft', 'pending_payment') THEN
        RAISE EXCEPTION 'New campaigns must start as draft or pending payment';
      END IF;
    ELSE
      NEW.payment_reference := OLD.payment_reference;
      IF NEW.status = 'active' AND OLD.status <> 'active' THEN
        RAISE EXCEPTION 'Only Sonk staff can activate a campaign';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_ad_campaign_fields ON public.sonk_ad_campaigns;
CREATE TRIGGER validate_ad_campaign_fields
BEFORE INSERT OR UPDATE ON public.sonk_ad_campaigns
FOR EACH ROW EXECUTE FUNCTION public.validate_ad_campaign();