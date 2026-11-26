-- Local seed: runs after the migrations on a local database (config.toml [db.seed]).
-- A minimal catalogue so the search function and the slug trigger have rows to work on; the real
-- catalogue comes from the ETL. Perfume ids derive from the source slug, so every local database has
-- the same ids: test runs that share one Redis cache then serve each other valid ids.

INSERT INTO public.concentrations (name, slug) VALUES ('Eau de Parfum', 'edp');
INSERT INTO public.brands (name, slug) VALUES ('Chanel', 'chanel');
INSERT INTO public.perfumes (id, brand_id, name, source_record_slug, release_year, concentration_id)
SELECT md5('chanel-coco-mademoiselle-edp')::uuid, b.id, 'Coco Mademoiselle', 'chanel-coco-mademoiselle-edp', 2001, c.id
FROM public.brands b, public.concentrations c
WHERE b.slug = 'chanel' AND c.slug = 'edp';

-- Names with characters the search normalizer strips (03_search_function.test.sql); both exist in
-- the production catalogue too.
INSERT INTO public.brands (name, slug) VALUES ('4711', '4711');
INSERT INTO public.perfumes (id, brand_id, name, source_record_slug, release_year, concentration_id)
SELECT md5('4711-blood-orange-basil-edp')::uuid, b.id, 'Blood Orange & Basil', '4711-blood-orange-basil-edp', 2015, c.id
FROM public.brands b, public.concentrations c
WHERE b.slug = '4711' AND c.slug = 'edp';
INSERT INTO public.perfumes (id, brand_id, name, source_record_slug, release_year, concentration_id)
SELECT md5('chanel-n5-leau-edp')::uuid, b.id, 'N°5 L''Eau', 'chanel-n5-leau-edp', 2016, c.id
FROM public.brands b, public.concentrations c
WHERE b.slug = 'chanel' AND c.slug = 'edp';

-- A synthetic catalogue large enough to play on: the source data is private, so CI and a fresh
-- local stack get invented brands, names and perfumers with common note names. Every value follows
-- from the row number, so each reset builds the same rows.
INSERT INTO public.concentrations (name, slug) VALUES
  ('Eau de Toilette', 'edt'), ('Extrait de Parfum', 'extrait'), ('Eau de Cologne', 'edc');

INSERT INTO public.brands (name, slug) VALUES
  ('Maison Aubrac', 'maison-aubrac'), ('Atelier Corvin', 'atelier-corvin'), ('Ostrova', 'ostrova'),
  ('Lune Pâle', 'lune-pale'), ('Hollin & Reed', 'hollin-reed'), ('Casa Velluto', 'casa-velluto'),
  ('Nordvik', 'nordvik'), ('Ambrette Studio', 'ambrette-studio');

INSERT INTO public.perfumes (id, brand_id, name, source_record_slug, release_year,
  concentration_id, gender, is_linear, xsolve_score, top_notes, middle_notes, base_notes, perfumers)
SELECT md5('synthetic-' || i)::uuid, b.id, w.adjectives[i % 16 + 1] || ' ' || w.nouns[(i / 16) % 15 + 1], 'synthetic-' || i,
  1960 + (i * 37) % 65, c.id, w.genders[(i * 7) % 3 + 1], i % 12 = 5,
  ((i * 7919) % 1000) / 1000.0,
  -- A linear perfume keeps one flat list in top_notes, as the ETL stores it.
  CASE WHEN i % 12 = 5
    THEN ARRAY[w.top[i % 8 + 1], w.middle[i % 8 + 1], w.base[i % 10 + 1]]
    ELSE ARRAY[w.top[i % 8 + 1], w.top[(i * 3 + 1) % 8 + 1]] END,
  CASE WHEN i % 12 = 5 THEN '{}'
    ELSE ARRAY[w.middle[(i * 5) % 8 + 1], w.middle[(i * 5 + 3) % 8 + 1]] END,
  CASE WHEN i % 12 = 5 THEN '{}'
    ELSE ARRAY[w.base[i % 10 + 1], w.base[(i + 4) % 10 + 1]]
      || CASE WHEN i % 3 = 0 THEN ARRAY[w.base[(i + 7) % 10 + 1]] ELSE '{}' END END,
  ARRAY[w.perfumers[i % 6 + 1]]
    || CASE WHEN i % 5 = 0 THEN ARRAY[w.perfumers[(i + 2) % 6 + 1]] ELSE '{}' END
FROM generate_series(0, 179) AS i
CROSS JOIN (SELECT
  ARRAY['Velvet', 'Midnight', 'Golden', 'Silent', 'Wild', 'Pale', 'Burning', 'Hidden', 'Blue',
    'Crimson', 'Morning', 'Salt', 'Smoked', 'Paper', 'Silver', 'Winter'] AS adjectives,
  ARRAY['Garden', 'Orchard', 'Harbour', 'Letter', 'Meadow', 'Ember', 'Lantern', 'Tide',
    'Cathedral', 'Fig', 'Moss', 'Veil', 'Atlas', 'Reverie', 'Hour'] AS nouns,
  ARRAY['Female', 'Male', 'Unisex'] AS genders,
  ARRAY['Bergamot', 'Lemon', 'Mandarin Orange', 'Pink Pepper', 'Grapefruit', 'Cardamom', 'Neroli',
    'Black Currant'] AS top,
  ARRAY['Rose', 'Jasmine', 'Iris', 'Lavender', 'Orange Blossom', 'Violet', 'Geranium',
    'Tuberose'] AS middle,
  ARRAY['Vanilla', 'Sandalwood', 'Musk', 'Patchouli', 'Vetiver', 'Amber', 'Cedar', 'Tonka Bean',
    'Oakmoss', 'Leather'] AS base,
  ARRAY['Claire Ostend', 'Jonas Albrecht', 'Mireille Danto', 'Tomasz Wierzba', 'Ines Laborde',
    'Kenji Arata'] AS perfumers) AS w
JOIN public.brands AS b ON b.slug = (ARRAY['maison-aubrac', 'atelier-corvin', 'ostrova', 'lune-pale',
  'hollin-reed', 'casa-velluto', 'nordvik', 'ambrette-studio'])[i % 8 + 1]
JOIN public.concentrations AS c ON c.slug = (ARRAY['edp', 'edt', 'extrait', 'edc'])[(i / 3) % 4 + 1];

-- Image keys in the production format; the images themselves do not exist outside production.
INSERT INTO public.perfume_assets (perfume_id, asset_random_id, image_key_step_1, image_key_step_2,
  image_key_step_3, image_key_step_4, image_key_step_5, image_key_step_6)
SELECT p.id, md5(p.source_record_slug),
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '1') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '2') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '3') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '4') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '5') || '.avif',
  'a/' || md5(p.source_record_slug) || '/' || md5(p.source_record_slug || '6') || '.avif'
FROM public.perfumes AS p
WHERE p.source_record_slug LIKE 'synthetic-%';

-- Today's and tomorrow's puzzles (UTC, as the cron dates them); after midnight the cron route
-- (GET /api/cron/generate-daily with the CRON_SECRET bearer) adds the next ones.
INSERT INTO public.daily_challenges (challenge_number, challenge_date, perfume_id, seed_hash,
  snapshot_metadata, grace_deadline_at_utc)
SELECT d.n, d.day, p.id, 'seed', jsonb_build_object('xsolve', p.xsolve_score),
  (d.day + 1)::timestamp AT TIME ZONE 'UTC' - interval '1 millisecond'
FROM (VALUES (1, (now() AT TIME ZONE 'UTC')::date, 'synthetic-1'),
             (2, (now() AT TIME ZONE 'UTC')::date + 1, 'synthetic-2')) AS d(n, day, slug)
JOIN public.perfumes AS p ON p.source_record_slug = d.slug;

REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
