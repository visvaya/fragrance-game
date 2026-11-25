-- pgTAP: Search Function Tests
-- Run: supabase test db
--
-- Verifies search_perfumes_unaccent_v2 behavior:
-- minimum query length, return shape, no SQL injection, queries normalized like the cache.
-- Requires perfume data to be seeded (won't pass on empty DB).

BEGIN;
-- The CI login role does not inherit postgres and cannot use the extensions schema, where
-- supabase test db installs pgTAP for the run; switch to postgres for this transaction.
SET LOCAL ROLE postgres;
SET LOCAL search_path = public, extensions;
SELECT plan(18);

-- ============================================================
-- FUNCTION SIGNATURE
-- ============================================================

SELECT has_function(
  'public',
  'search_perfumes_unaccent_v2',
  ARRAY['text', 'integer'],
  'search_perfumes_unaccent_v2 accepts (text, integer)'
);

-- ============================================================
-- RETURN TYPE – must have correct columns
-- ============================================================

SELECT function_returns(
  'public',
  'search_perfumes_unaccent_v2',
  ARRAY['text', 'integer'],
  'setof record',
  'search_perfumes_unaccent_v2 returns SETOF record'
);

-- ============================================================
-- BEHAVIOR: query shorter than 3 chars → 0 results
-- ============================================================

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('C', 10)) = 0,
  'query "C" (1 char) returns 0 results – minimum length enforced'
);

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('Ch', 10)) = 0,
  'query "Ch" (2 chars) returns 0 results – minimum length enforced'
);

-- ============================================================
-- BEHAVIOR: 3+ chars → results (requires seeded perfume data)
-- ============================================================

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('Cha', 10)) >= 0,
  'query "Cha" (3 chars) does not error – returns 0 or more results'
);

-- ============================================================
-- BEHAVIOR: respects limit parameter
-- ============================================================

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('perfume', 5)) <= 5,
  'limit_count=5 returns at most 5 results'
);

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('perfume', 1)) <= 1,
  'limit_count=1 returns at most 1 result'
);

-- ============================================================
-- BEHAVIOR: SQL injection – must not error
-- ============================================================

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2($$'; DROP TABLE perfumes; --$$, 10)) >= 0,
  'SQL injection attempt does not error (parameterized correctly)'
);

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('<script>alert(1)</script>', 10)) >= 0,
  'XSS payload in search does not error'
);

-- ============================================================
-- BEHAVIOR: the query is normalized like the cache columns
-- ============================================================
-- normalize_search_text strips punctuation such as & ' and the degree sign from name_norm and
-- brand_name_concat, so a name typed as written must be normalized the same way to match.
-- Uses catalogue rows present on production (the job runs against it).

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.search_perfumes_unaccent_v2('Blood Orange & Basil', 60)
    WHERE name = 'Blood Orange & Basil' AND brand_name = '4711'
  ),
  'a name typed with & ("Blood Orange & Basil") finds that perfume'
);

SELECT is(
  (SELECT name FROM public.search_perfumes_unaccent_v2('Blood Orange & Basil', 1)),
  'Blood Orange & Basil',
  'the exact name typed with & ranks first'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.search_perfumes_unaccent_v2('Blood Orange and Basil', 60)
    WHERE name = 'Blood Orange & Basil' AND brand_name = '4711'
  ),
  'a name with & typed with "and" instead finds that perfume'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.search_perfumes_unaccent_v2($$N°5 L'Eau$$, 60)
    WHERE name = $$N°5 L'Eau$$ AND brand_name = 'Chanel'
  ),
  $$a name typed with a degree sign and an apostrophe ("N°5 L'Eau") finds that perfume$$
);

SELECT set_eq(
  $$SELECT * FROM public.search_perfumes_unaccent_v2('dior ', 10000)$$,
  $$SELECT * FROM public.search_perfumes_unaccent_v2('dior', 10000)$$,
  'a trailing space does not change the results ("dior " is one word)'
);

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('?!.&', 10)) = 0,
  'a query of punctuation only returns 0 results'
);

-- ============================================================
-- f_unaccent – diacritics normalization
-- ============================================================

SELECT is(
  public.f_unaccent('Hermès'),
  'Hermes',
  'f_unaccent strips accents: Hermès → Hermes'
);

SELECT is(
  public.f_unaccent('CHLOÉ'),
  'CHLOE',
  'f_unaccent strips accents: CHLOÉ → CHLOE'
);

SELECT is(
  public.f_unaccent('clean'),
  'clean',
  'f_unaccent preserves ASCII: clean → clean'
);

SELECT * FROM finish();
ROLLBACK;
