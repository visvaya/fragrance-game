-- Make f_unaccent SECURITY DEFINER so pgTAP test runner can call it
-- without needing direct USAGE on extensions schema.
-- Safe: f_unaccent is a pure utility function (strips accents, no side effects).
ALTER FUNCTION public.f_unaccent(text)
  SECURITY DEFINER
  SET search_path = public, extensions, pg_catalog;
