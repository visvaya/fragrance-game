-- pgTAP: inserting a perfume runs the unique slug trigger. Needs at least one brand (production data).
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(3);

SELECT lives_ok(
  $$INSERT INTO public.perfumes (brand_id, name, source_record_slug)
    SELECT id, 'Pgtap Slug Probe', 'pgtap-slug-probe-1' FROM public.brands WHERE slug IS NOT NULL ORDER BY id LIMIT 1$$,
  'inserting a perfume does not fail in the slug trigger'
);

SELECT lives_ok(
  $$INSERT INTO public.perfumes (brand_id, name, source_record_slug)
    SELECT id, 'pgtap slug probe', 'pgtap-slug-probe-2' FROM public.brands WHERE slug IS NOT NULL ORDER BY id LIMIT 1$$,
  'a second perfume whose name gives the same base slug inserts too'
);

SELECT is(
  (SELECT count(DISTINCT unique_slug)::int FROM public.perfumes
   WHERE source_record_slug IN ('pgtap-slug-probe-1', 'pgtap-slug-probe-2')),
  2,
  'the trigger gives each of the two probes its own unique slug'
);

SELECT * FROM finish();
ROLLBACK;
