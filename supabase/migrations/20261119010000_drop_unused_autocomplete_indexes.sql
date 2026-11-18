-- Drop six perfume_autocomplete_cache indexes that search_perfumes_unaccent_v2 cannot use and that
-- show zero scans on production (pg_stat_user_indexes, 2026-11-19). Every refresh of the cache
-- after an import rebuilds them (about 13 MB together).
--
-- The function filters only with ILIKE '%term%' (served by the name_norm and brand_norm trigram
-- indexes), dmetaphone equality (the phonetic indexes) and similarity() calls, which use no index.
-- Its prefix LIKE comparisons sit in the SELECT list as ranking flags, so the text_pattern_ops
-- indexes never serve a filter, and name_length is only a sort key after filtering.
-- name_brand_concat holds the same words as brand_name_concat in another order; the trigram index
-- on brand_name_concat stays for a rewrite of the multi-word path that filters with ILIKE on it.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

DROP INDEX public.idx_ac_cache_brand_name_concat;
DROP INDEX public.idx_ac_cache_name_brand_concat;
DROP INDEX public.idx_ac_cache_brand_norm;
DROP INDEX public.idx_ac_cache_name_norm;
DROP INDEX public.idx_ac_cache_name_length;
DROP INDEX public.idx_ac_cache_name_brand_trgm;
