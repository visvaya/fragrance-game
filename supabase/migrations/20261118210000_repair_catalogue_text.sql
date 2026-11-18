-- Repair catalogue text imported with broken encoding, and the "SeeByChloe" names.
--
-- Three concentration names (33 perfumes, none in the puzzle pool on 2026-11-18) hold UTF-8 text
-- that was decoded as CP1250 upstream: an e with acute accent arrives as U+0102 U+00A9. Encoding
-- such a name back to WIN1250 and reading the bytes as UTF-8 restores it. The ETL now repairs the
-- same sequences on import (scripts/etl.py, repair_text).
--
-- Three Chloe perfumes are named "SeeByChloe..." (with an e acute), the source's spelling of the
-- "See by Chloe" line; players see the name in autocomplete.
--
-- Non-ASCII characters are built with chr() so the file stays ASCII.

UPDATE public.concentrations
SET name = convert_from(convert_to(name, 'WIN1250'), 'UTF8')
WHERE name ~ (
  '[' || chr(258) || chr(195) || chr(196) || chr(313) || chr(197) || chr(226) || ']'
  || '[' || chr(128) || '-' || chr(767) || chr(8192) || '-' || chr(8447) || ']'
);

UPDATE public.perfumes
SET name = replace(name, 'SeeByChlo' || chr(233), 'See by Chlo' || chr(233))
WHERE name LIKE 'SeeByChlo' || chr(233) || '%';

-- Autocomplete reads the renamed perfumes from this view.
REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
