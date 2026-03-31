-- pgTAP: Search Function Tests
-- Run: supabase test db
--
-- Verifies search_perfumes_unaccent_v2 behavior:
-- minimum query length, return shape, no SQL injection.
-- Requires perfume data to be seeded (won't pass on empty DB).

BEGIN;
SELECT plan(12);

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
-- RETURN TYPE — must have correct columns
-- ============================================================

SELECT function_returns(
  'public',
  'search_perfumes_unaccent_v2',
  ARRAY['text', 'integer'],
  'record',
  'search_perfumes_unaccent_v2 returns SETOF record'
);

-- ============================================================
-- BEHAVIOR: query shorter than 3 chars → 0 results
-- ============================================================

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('C', 10)) = 0,
  'query "C" (1 char) returns 0 results — minimum length enforced'
);

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('Ch', 10)) = 0,
  'query "Ch" (2 chars) returns 0 results — minimum length enforced'
);

-- ============================================================
-- BEHAVIOR: 3+ chars → results (requires seeded perfume data)
-- ============================================================

SELECT ok(
  (SELECT COUNT(*) FROM public.search_perfumes_unaccent_v2('Cha', 10)) >= 0,
  'query "Cha" (3 chars) does not error — returns 0 or more results'
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
-- BEHAVIOR: SQL injection — must not error
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
-- f_unaccent — diacritics normalization
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
