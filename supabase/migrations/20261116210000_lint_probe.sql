-- Temporary: a unique expression index over a nullable column, to show that the unique key check
-- reports it. Removed again before merge; never applied.
CREATE TABLE public.lint_probe (name text);
CREATE UNIQUE INDEX lint_probe_lower_name ON public.lint_probe (lower(name));
