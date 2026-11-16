-- Temporary: one trigger function on two tables, valid on the first (perfume_assets has updated_at) and
-- broken on the second (daily_challenges has no updated_at). Removed again before merge; never applied.
CREATE FUNCTION public.lint_probe() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER lint_probe BEFORE UPDATE ON public.perfume_assets
FOR EACH ROW EXECUTE FUNCTION public.lint_probe();

CREATE TRIGGER lint_probe BEFORE UPDATE ON public.daily_challenges
FOR EACH ROW EXECUTE FUNCTION public.lint_probe();
