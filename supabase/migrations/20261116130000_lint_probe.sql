-- Temporary: reproduces an unqualified extension call in a trigger function to show that the
-- plpgsql_check step fails. Removed in the next commit; never applied to production.
CREATE FUNCTION public.lint_probe() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.id := uuid_generate_v4();
  RETURN NEW;
END
$$;

CREATE TRIGGER lint_probe BEFORE INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public.lint_probe();
