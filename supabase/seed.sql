-- Local seed: runs after the migrations on a local database (config.toml [db.seed]).
-- A minimal catalogue so the search function and the slug trigger have rows to work on; the real
-- catalogue comes from the ETL.

INSERT INTO public.concentrations (name, slug) VALUES ('Eau de Parfum', 'edp');
INSERT INTO public.brands (name, slug) VALUES ('Chanel', 'chanel');
INSERT INTO public.perfumes (brand_id, name, source_record_slug, release_year, concentration_id)
SELECT b.id, 'Coco Mademoiselle', 'chanel-coco-mademoiselle-edp', 2001, c.id
FROM public.brands b, public.concentrations c
WHERE b.slug = 'chanel' AND c.slug = 'edp';

-- Names with characters the search normalizer strips (03_search_function.test.sql); both exist in
-- the production catalogue too.
INSERT INTO public.brands (name, slug) VALUES ('4711', '4711');
INSERT INTO public.perfumes (brand_id, name, source_record_slug, release_year, concentration_id)
SELECT b.id, 'Blood Orange & Basil', '4711-blood-orange-basil-edp', 2015, c.id
FROM public.brands b, public.concentrations c
WHERE b.slug = '4711' AND c.slug = 'edp';
INSERT INTO public.perfumes (brand_id, name, source_record_slug, release_year, concentration_id)
SELECT b.id, 'N°5 L''Eau', 'chanel-n5-leau-edp', 2016, c.id
FROM public.brands b, public.concentrations c
WHERE b.slug = 'chanel' AND c.slug = 'edp';

REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
