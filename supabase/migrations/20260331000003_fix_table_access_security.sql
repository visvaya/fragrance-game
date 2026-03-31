-- Fix: revoke direct table access from anon/authenticated roles
--
-- Security model:
-- - anon/authenticated MUST use public VIEWs: perfumes_public, daily_challenges_public
-- - Server actions use adminClient (service_role) which bypasses RLS
-- - VIEWs are owned by postgres (bypassrls) so they can still read base tables
-- - search_perfumes_unaccent_v2 becomes SECURITY DEFINER so autocomplete RPC
--   can still access perfumes when called by anon

-- 1. Remove overly permissive RLS policies on base tables
DROP POLICY IF EXISTS "Public read perfumes" ON public.perfumes;
DROP POLICY IF EXISTS "Public read active daily challenges" ON public.daily_challenges;

-- 2. Revoke direct SELECT on base tables from client roles
--    (VIEWs remain accessible because they run as postgres/bypassrls)
REVOKE SELECT ON public.perfumes FROM anon, authenticated;
REVOKE SELECT ON public.daily_challenges FROM anon, authenticated;

-- 3. Make search function SECURITY DEFINER so it can access perfumes when called by anon
--    Hardened search_path prevents schema-injection attacks
ALTER FUNCTION public.search_perfumes_unaccent_v2(text, integer)
  SECURITY DEFINER
  SET search_path = public, extensions, pg_catalog;
