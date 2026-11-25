-- pgTAP: pick_daily_perfume draws only eligible perfumes and only the service role can call it.
-- Inserts probe perfumes under an existing brand and a far-future challenge; all rolled back.
-- The draw is random, so the eligibility checks repeat it and assert that no draw breaks a rule;
-- the draw number in the argument makes the planner call the function again for every draw.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(10);

SELECT has_function('public', 'pick_daily_perfume', ARRAY['date'], 'pick_daily_perfume(date) exists');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.pick_daily_perfume(date)'::regprocedure),
  'pick_daily_perfume runs as the caller (SECURITY INVOKER)');
SELECT ok(NOT has_function_privilege('anon', 'public.pick_daily_perfume(date)', 'EXECUTE'), 'anon cannot pick the daily perfume');
SELECT ok(NOT has_function_privilege('authenticated', 'public.pick_daily_perfume(date)', 'EXECUTE'), 'authenticated cannot pick the daily perfume');
SELECT ok(has_function_privilege('service_role', 'public.pick_daily_perfume(date)', 'EXECUTE'), 'service_role can pick the daily perfume');

-- One eligible probe and one probe per broken rule.
INSERT INTO public.perfumes (brand_id, name, source_record_slug, is_uncertain, is_active, xsolve_score, top_notes)
SELECT b.id, probe.slug, probe.slug, probe.is_uncertain, probe.is_active, probe.xsolve_score, probe.top_notes
FROM (SELECT id FROM public.brands WHERE slug IS NOT NULL ORDER BY id LIMIT 1) AS b
CROSS JOIN (VALUES
  ('pgtap-pick-eligible', false, true, 0.5::double precision, '{Bergamot}'::text[]),
  ('pgtap-pick-uncertain', true, true, 0.5, '{Bergamot}'),
  ('pgtap-pick-inactive', false, false, 0.5, '{Bergamot}'),
  ('pgtap-pick-no-score', false, true, NULL, '{Bergamot}'),
  ('pgtap-pick-empty-notes', false, true, 0.5, '{}'),
  ('pgtap-pick-null-notes', false, true, 0.5, NULL),
  ('pgtap-pick-no-assets', false, true, 0.5, '{Bergamot}')
) AS probe(slug, is_uncertain, is_active, xsolve_score, top_notes);

INSERT INTO public.perfume_assets (perfume_id, asset_random_id, image_key_step_1, image_key_step_2,
  image_key_step_3, image_key_step_4, image_key_step_5, image_key_step_6)
SELECT p.id, md5(p.source_record_slug),
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '1') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '2') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '3') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '4') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '5') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '6') || '.avif'
FROM public.perfumes AS p
WHERE p.source_record_slug LIKE 'pgtap-pick-%' AND p.source_record_slug <> 'pgtap-pick-no-assets';

-- Without the probes the draws below would check only production rows and could pass vacuously.
SELECT is(
  (SELECT count(*) FROM public.perfumes AS p
   LEFT JOIN public.perfume_assets AS pa ON pa.perfume_id = p.id
   WHERE p.source_record_slug LIKE 'pgtap-pick-%'
     AND (pa.perfume_id IS NOT NULL OR p.source_record_slug = 'pgtap-pick-no-assets')),
  7::bigint,
  'the seven probe perfumes exist, each with assets except the image-less one'
);

SELECT is((SELECT count(*) FROM public.pick_daily_perfume('9999-01-01')), 1::bigint,
  'a draw returns one perfume');

SELECT is(
  (SELECT count(*)
   FROM generate_series(1, 200) AS draw
   CROSS JOIN LATERAL public.pick_daily_perfume('9999-01-01'::date + 0 * draw) AS pick
   JOIN public.perfumes AS p ON p.id = pick.perfume_id
   WHERE p.source_record_slug LIKE 'pgtap-pick-%' AND p.source_record_slug <> 'pgtap-pick-eligible'),
  0::bigint,
  'no draw returns an uncertain, inactive, unscored, note-less or image-less probe'
);

SELECT is(
  (SELECT count(*)
   FROM generate_series(1, 200) AS draw
   CROSS JOIN LATERAL public.pick_daily_perfume('9999-01-01'::date + 0 * draw) AS pick
   JOIN public.perfumes AS p ON p.id = pick.perfume_id
   LEFT JOIN public.perfume_assets AS pa ON pa.perfume_id = p.id
   WHERE pa.perfume_id IS NULL OR p.is_uncertain IS DISTINCT FROM false
     OR p.is_active IS DISTINCT FROM true OR p.top_notes = '{}' OR p.top_notes IS NULL
     OR pick.xsolve_score IS NULL OR pick.xsolve_score IS DISTINCT FROM p.xsolve_score),
  0::bigint,
  'every draw is eligible and returns the perfume''s own difficulty score'
);

-- The eligible probe is used by a challenge on 9998-01-01, inside a window starting that day.
INSERT INTO public.daily_challenges (challenge_date, challenge_number, perfume_id, seed_hash,
  snapshot_metadata, grace_deadline_at_utc)
SELECT '9998-01-01', (SELECT coalesce(max(challenge_number), 0) + 1 FROM public.daily_challenges),
  p.id, 'pgtap-pick', '{}', '9998-01-01 23:59:59+00'
FROM public.perfumes AS p WHERE p.source_record_slug = 'pgtap-pick-eligible';

SELECT is(
  (SELECT count(*)
   FROM generate_series(1, 200) AS draw
   CROSS JOIN LATERAL public.pick_daily_perfume('9998-01-01'::date + 0 * draw) AS pick
   JOIN public.perfumes AS p ON p.id = pick.perfume_id
   WHERE p.source_record_slug = 'pgtap-pick-eligible'),
  0::bigint,
  'a perfume used by a challenge dated on or after the window start is not drawn'
);

SELECT * FROM finish();
ROLLBACK;
