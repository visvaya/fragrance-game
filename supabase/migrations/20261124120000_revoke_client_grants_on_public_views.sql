-- perfumes_public and daily_challenges_public are security_invoker views and the client roles
-- (anon, authenticated) hold no privileges on the base tables, so a client read of either view
-- already fails with 42501. Server actions read them with the service role. The remaining view
-- grants therefore do nothing today, but would expose the views without a deliberate decision if
-- table access for client roles were ever restored.

REVOKE ALL ON public.perfumes_public, public.daily_challenges_public FROM anon, authenticated;
