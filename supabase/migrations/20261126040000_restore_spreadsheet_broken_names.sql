-- Give the nine perfumes named "#NAZWA?" their names back.
--
-- A spreadsheet turned 27 names in the source file into a formula error ("#NAZWA?", the Polish
-- "#NAME?"); keep-first deduplication merged them into nine rows that autocomplete showed as
-- "#NAZWA?". The Parfumo address still holds each name. The values below come from
-- restore_broken_name in scripts/etl.py, which the ETL now applies on import; each row was matched
-- to its source row by top notes, or as the most rated row that deduplication kept (2026-11-26).
-- The year in these rows is the number the name starts with, copied from the name ("1902" is the
-- year Berdoues was founded), so it becomes unknown where the name starts with it. Accents the
-- address dropped stay lost ("The Vert" for the accented "The"). The other 18 source rows
-- return with the next import.

UPDATE public.perfumes AS p
SET
  name = v.new_name,
  release_year = v.new_year,
  source_record_slug = v.new_slug,
  fingerprint_strict = v.fingerprint_strict,
  fingerprint_loose = v.fingerprint_loose
FROM (
  VALUES
    ('alexandre.j-#nazwa?-unknown-2018', 'alexandre.j-e 2-unknown-2018', 'E 2', 2018, '5b6d8e0e7a1baf10af42cb28d5c4b52ff5f0a86dcc39bc89565f01ea19a1ad58', 'd06809443e6c147ad624babafcdec0e26d2132511472f328adf855fdc220dc72'),
    ('berdoues-#nazwa?-eau de cologne-1902', 'berdoues-1902 tradition gingembre vert-eau de cologne-0', '1902 Tradition Gingembre Vert', NULL::integer, '2832073bd2d4e0bcf44dd54ff9a9cbd0f20ac6c4059513121e05d369c220b578', 'a781571a605e98b60f5799e723160c046dae6cdbd837532411ddf6306dc590ce'),
    ('berdoues-#nazwa?-unknown-1902', 'berdoues-1902 the vert-unknown-0', '1902 The Vert', NULL::integer, '2972232491947e5cd31cd776acd8e79bffbab7d8cf1ce5dd72b72faa7408e6f4', '22ab7fb2cacbbe2205b94989754bac6a4f2f831a8c80dee41dfbf8dc28efbb31'),
    ('byredo-#nazwa?-hair perfume-1996', 'byredo-1996 inez vinoodh-hair perfume-0', '1996 Inez Vinoodh', NULL::integer, '0aa346a1f3f999a802a4bf4001789937634471c631ea2fe4550c70ac16fdf472', '1237d2f524de7e60b2f30126bf502d83b13d6d62598dc48888478743ff5cefd9'),
    ('m. asam-#nazwa?-unknown-2022', 'm. asam-2022 magnificent magnolia-unknown-0', '2022 Magnificent Magnolia', NULL::integer, 'dd8ea50e3a50484ed6a3a77b1ae5b7fb77d2a09e36983a7c1dbe9881889ed3fa', 'f1570b252428c9e9da74f744b3fa6ded44f9906f761a317c2a97c756b948c9a4'),
    ('m. asam-#nazwa?-unknown-2023', 'm. asam-2023 golden delight-unknown-0', '2023 Golden Delight', NULL::integer, '5cd1cb459b1cc6a9383f7aee28f3626049f5f2970fc1469732da9c79edc8d2a7', '7b6e1d99593ef906686f3282151e97c8d846af9af270383e51d110e21fc44123'),
    ('sweet anthem-#nazwa?-solid perfume-1948', 'sweet anthem-1948 beginnings-solid perfume-0', '1948 Beginnings', NULL::integer, 'f0e428ef81bfba4670f3563158e699a84a41dccabff7deb251f6104c676a3901', '72bfd1ab27f549b4570c06d0e4c4685061e19ab8aacfac73a0e8d2e2f5ef71e7'),
    ('sweet anthem-#nazwa?-solid perfume-1969', 'sweet anthem-1969 revolution-solid perfume-0', '1969 Revolution', NULL::integer, 'd8b8de162ef0a9994dd12a5aa5ff1fcb9f79aa66e8d5b996cc475f22e9e63482', '310f9a4630700b9d69254e3666cb326d52367005f30158e00fba13b7149fb22d'),
    ('sweet anthem-#nazwa?-solid perfume-2020', 'sweet anthem-2020 hope-solid perfume-0', '2020 Hope', NULL::integer, '99adde0925b52eb53174a175921727feb09fb09fb4cd00e2cce93a785eefe4ea', '2fcbc637c0bbacdaf60d94462d49bbb06ba8de35c07515e17d14e339590493d2')
) AS v (old_slug, new_slug, new_name, new_year, fingerprint_strict, fingerprint_loose)
WHERE p.source_record_slug = v.old_slug;

-- Autocomplete reads the renamed perfumes from this view. Nine rows change; the refresh still takes
-- an exclusive lock on perfume_autocomplete_cache (about 59 000 rows), so give up rather than queue.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
