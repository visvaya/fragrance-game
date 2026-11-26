-- pgTAP: autocomplete leaves out product types that are not perfumes (aftershave, body and hair
-- mists), migration 20261126020000_exclude_non_perfume_products. The queries name perfumes whose
-- production catalogue holds such products beside the perfume; on a database built from the seed
-- they find nothing, which passes too.
BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(3);

SELECT has_column(
  'public', 'concentrations', 'is_perfume',
  'concentrations mark the labels that are not perfumes'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM concentrations
    WHERE name IN ('Hair Mist', 'After Shave', 'Solid Perfume', 'Cream Perfume', 'Gel Perfume')
      AND is_perfume
  ),
  0,
  'aftershave, hair mist, solid, cream and gel labels are not perfumes (20261126030000)'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM unnest(ARRAY['delina', 'tobacco vanille', 'dior homme', 'lady million']) AS q (query)
    CROSS JOIN LATERAL public.search_perfumes_unaccent_v2(q.query, 60) AS r
    JOIN concentrations AS k ON k.name = r.concentration
    WHERE NOT k.is_perfume
  ),
  0,
  'autocomplete suggests no aftershave, body or hair product, nor a solid, cream or gel perfume'
);

SELECT * FROM finish();
ROLLBACK;
