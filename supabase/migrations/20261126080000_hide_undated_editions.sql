-- Hide 61 undated rows of yearly editions that the 2026-11-26 import replaced with dated rows.
--
-- The import (run 5c73ca86, 2026-11-26) took each edition's year from its Parfumo address
-- (scripts/etl.py, year_from_address) and stored one row per year. 61 older rows without a year
-- stood for several editions at once and no source row matches them any more: the ETL dry run
-- after the import lists exactly these 61 (all uncertain, all active). They are hidden, not
-- deleted, so game history that points at them stays intact. Rows are matched by brand, name and
-- concentration with no year.
--
-- Non-ASCII characters are written as U& escapes so the file stays ASCII.

-- The view refresh takes an exclusive lock on perfume_autocomplete_cache (about 59 000 rows):
-- give up rather than queue behind a long reader, and bound the whole migration.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

UPDATE public.perfumes AS p
SET is_active = false
FROM (
  VALUES
    ('Guerlain', 'Cherry Blossom', NULL),
    ('Jean Paul Gaultier', 'Classique Pride Edition', NULL),
    ('Paul Smith', 'Sunshine Edition for Men', NULL),
    ('Clinique', 'Happy in Bloom', NULL),
    (U&'Est\00E9e Lauder', 'Beautiful Summer Fun', NULL),
    ('Calvin Klein', 'CK One Collector''s Bottle', NULL),
    ('L''Artisan Parfumeur', 'Passage d''Enfer Limited Edition', NULL),
    (U&'Est\00E9e Lauder', 'Pleasures Artist''s Edition', NULL),
    (U&'Parf\00FCmerie Br\00FCckner', U&'Aazaram Les Limit\00E9es', NULL),
    (U&'Herm\00E8s', U&'Terre d''Herm\00E8s Flacon H', NULL),
    ('Diptyque', U&'Do Son \00C9dition Limit\00E9e', 'Eau de Toilette'),
    ('Yves Saint Laurent', 'Opium Edition Collector', NULL),
    ('Jimmy Choo', 'Blossom Special Edition', NULL),
    ('Filippo Sorcinelli', 'LAVS Christmas Edition', NULL),
    ('Yves Saint Laurent', 'Mon Paris Collector Edition', NULL),
    ('Issey Miyake', U&'L''Eau d''Issey Eau d''\00C9t\00E9 Summer Edition', NULL),
    ('Bruno Banani', 'Bruno Banani Woman Limited Edition', NULL),
    ('Acqua di Parma', 'Colonia Artist Edition', NULL),
    ('Yves Rocher', U&'Comme une Evidence Flacon Collector No\00EBl', NULL),
    ('Cartier', U&'La Panth\00E8re Eau de Parfum L\00E9g\00E8re \00C9dition Limit\00E9e', U&'Eau de Parfum L\00E9g\00E8re'),
    ('Paul Smith', 'Sunshine Edition for Women', NULL),
    ('Jimmy Choo', 'Jimmy Choo Exotic', NULL),
    ('Jo Malone', 'Pomegranate Noir Limited Edition', NULL),
    ('Cacharel', U&'Ana\00EFs Ana\00EFs Premier D\00E9lice L''Eau', NULL),
    ('Guerlain', U&'Bouquet de la Mari\00E9e', NULL),
    ('Maison Margiela', 'Replica - Lazy Sunday Morning Limited Edition', NULL),
    ('Jo Malone', 'Velvet Rose & Oud Limited Edition', NULL),
    ('Fiorucci', 'Fiorucci', NULL),
    ('Tommy Hilfiger', 'Tommy Girl Summer Cologne', NULL),
    ('Alexander McQueen', 'Kingdom Limited Edition', NULL),
    ('Maison Margiela', 'Replica - By the Fireplace Limited Edition', NULL),
    ('Clinique', 'Happy Summer Spray', NULL),
    ('Les Parfums de Rosine', 'Le Muguet de Rosine', NULL),
    ('Juicy Couture', 'Viva La Juicy Limited Edition', NULL),
    ('Diptyque', U&'Do Son \00C9dition Limit\00E9e', 'Eau de Parfum'),
    ('Thymes', 'Filigree', NULL),
    ('Jean Paul Gaultier', 'Classique Collector', NULL),
    ('Teone Reinthal Natural Perfume', 'Quintessence', NULL),
    ('Cartier', U&'D\00E9claration \00C9dition Limit\00E9e', NULL),
    ('Yves Saint Laurent', 'La Nuit de L''Homme Edition Collector', NULL),
    ('Clarins', U&'Eau Dynamisante - Eau du C\0153ur Collector', NULL),
    (U&'Est\00E9e Lauder', 'Bronze Goddess', 'Eau de Parfum'),
    ('Cartier', U&'D\00E9lices de Cartier Edition Limit\00E9e', NULL),
    (U&'Est\00E9e Lauder', 'Pleasures Exotic', NULL),
    ('Viktor & Rolf', 'Flowerbomb La Vie en Rose', NULL),
    ('Guerlain', 'La Petite Robe Noire Limited Edition', 'Eau de Toilette'),
    ('Givenchy', U&'L''Interdit \00C9dition Couture', NULL),
    ('Mugler', U&'Angel Eau Sucr\00E9e', NULL),
    ('Tommy Hilfiger', 'Tommy Summer Cologne', NULL),
    (U&'Est\00E9e Lauder', U&'Beyond Parad\00EDse Summer Fun', NULL),
    ('Cacharel', 'Noa L''Eau', NULL),
    ('Stella McCartney', 'Stella - The Print Collection', NULL),
    ('Acqua di Parma', 'Colonia Intensa Prestige Edition', NULL),
    ('Cacharel', 'Amor Amor L''Eau', NULL),
    ('Cartier', U&'La Panth\00E8re \00C9dition Limit\00E9e', NULL),
    ('Issey Miyake', U&'L''Eau d''Issey pour Homme Eau d''\00C9t\00E9 Summer Edition', NULL),
    ('Jean Paul Gaultier', U&'Le M\00E2le Pride Edition', NULL),
    ('Yves Rocher', 'Comme une Evidence Flacon Collector', NULL),
    ('Yves Rocher', U&'Comme une Evidence \00C9dition Limit\00E9e', NULL),
    ('Louis Vuitton', 'Eau de Voyage', NULL),
    ('Yves Saint Laurent', 'Black Opium Collector Edition', NULL)
) AS v (brand, name, concentration)
JOIN public.brands AS b ON b.name = v.brand
LEFT JOIN public.concentrations AS c ON c.name = v.concentration
WHERE p.brand_id = b.id
  AND p.name = v.name
  AND p.concentration_id IS NOT DISTINCT FROM c.id
  AND p.release_year IS NULL
  AND p.is_uncertain
  AND p.is_active;

-- Autocomplete lists active perfumes only; this view drops the hidden rows.
REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
