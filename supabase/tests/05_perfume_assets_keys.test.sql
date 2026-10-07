-- pgTAP: game image keys are unique and unguessable (format enforced by CHECK constraints).
BEGIN;
SELECT plan(6);

SELECT col_is_unique('public', 'perfume_assets', ARRAY['asset_random_id'],
  'asset_random_id is unique');

SELECT ok(EXISTS (SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.perfume_assets'::regclass
    AND conname = 'perfume_assets_asset_random_id_format' AND contype = 'c' AND convalidated),
  'asset id format check exists and is validated');

SELECT ok(EXISTS (SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.perfume_assets'::regclass
    AND conname = 'perfume_assets_step_keys_format' AND contype = 'c' AND convalidated),
  'step key format check exists and is validated');

SELECT ok(EXISTS (SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.perfume_assets'::regclass
    AND conname = 'perfume_assets_step_keys_distinct' AND contype = 'c' AND convalidated),
  'distinct step keys check exists and is validated');

SELECT is((SELECT count(*)::int FROM public.perfume_assets
  WHERE image_key_step_1 ~ '/[1-6]_' OR image_key_step_2 ~ '/[1-6]_'
     OR image_key_step_3 ~ '/[1-6]_' OR image_key_step_4 ~ '/[1-6]_'
     OR image_key_step_5 ~ '/[1-6]_' OR image_key_step_6 ~ '/[1-6]_'), 0,
  'no step key carries its step number');

SELECT hasnt_index('public', 'perfume_assets', 'idx_perfume_assets_random_id',
  'the old non-unique index is gone');

SELECT * FROM finish();
ROLLBACK;
