-- Migration: Drop search_perfumes_unaccent v1
-- Date: 2026-02-22
-- Reason: v2 (search_perfumes_unaccent_v2) is the only active search function.
--         v1 read from perfumes_public view (live query); v2 uses perfume_autocomplete_cache
--         (materialized view with pre-computed trigram/phonetic fields, faster).
--         Feature flag AUTOCOMPLETE_V2 has been removed — v2 is now hardcoded.

DROP FUNCTION IF EXISTS public.search_perfumes_unaccent(TEXT, INT);
