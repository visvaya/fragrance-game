-- Local seed: runs after the migrations on a local database (config.toml [db.seed]).
-- A minimal catalogue so the search function and the slug trigger have rows to work on; the real
-- catalogue comes from the ETL.

INSERT INTO public.concentrations (name, slug) VALUES ('Eau de Parfum', 'edp');
INSERT INTO public.brands (name, slug) VALUES ('Chanel', 'chanel');
INSERT INTO public.perfumes (brand_id, name, source_record_slug, release_year, concentration_id)
SELECT b.id, 'Coco Mademoiselle', 'chanel-coco-mademoiselle-edp', 2001, c.id
FROM public.brands b, public.concentrations c
WHERE b.slug = 'chanel' AND c.slug = 'edp';

REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
