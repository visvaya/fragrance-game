-- pgTAP: undated rows of yearly editions that dated rows replaced are hidden (migration
-- 20261126080000_hide_undated_editions). The listed rows exist in the production catalogue; a
-- database built from the seed has none of them either.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(1);

SELECT is(
  (
    SELECT count(*)::int
    FROM perfumes AS p
    JOIN brands AS b ON b.id = p.brand_id
    WHERE p.is_active
      AND p.release_year IS NULL
      -- "Cherry Blossom" Parfum without a year is a source row of its own and stays.
      AND p.concentration_id IS NULL
      AND (b.name, p.name) IN (
        ('Guerlain', 'Cherry Blossom'),
        ('Jean Paul Gaultier', 'Classique Pride Edition'),
        ('Paul Smith', 'Sunshine Edition for Men')
      )
  ),
  0,
  'undated rows of yearly editions are hidden'
);

SELECT * FROM finish();
ROLLBACK;
