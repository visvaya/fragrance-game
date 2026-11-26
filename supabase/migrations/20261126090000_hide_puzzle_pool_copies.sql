-- Hide 40 uncertain copies of puzzle-pool perfumes (owner review, 2026-11-26).
--
-- Autocomplete listed an uncertain copy next to a certain perfume of the same brand (the same
-- perfume without its year, concentration or notes, or under its line name, such as "Replica -
-- Jazz Club" for Maison Margiela "Jazz Club"). A player who picked the copy lost a guess, because
-- only the certain row can be the answer. The owner rated every pair on the review page; these 40
-- are the confirmed copies (attar and Pure Perfume versions and "1 Million $" are other perfumes,
-- owner 2026-11-26). The copies are hidden, not deleted: none has been a daily puzzle (checked on
-- production), and the import keeps hidden rows hidden (scripts/etl.py, _hidden_keys). Rows are
-- matched by source_record_slug.
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
    ('azzaro-the most wanted-unknown-0'),
    ('cacharel-amor amor-unknown-2003'),
    ('carthusia-a''mmare-unknown-2021'),
    ('celine-black tie-unknown-2019'),
    ('clean-clean reserve - skin [reserve blend]-eau de parfum-2015'),
    ('dior-bois d''argent-unknown-2004'),
    ('dior-dior homme-parfum-2014'),
    (U&'diptyque-orph\00E9on-unknown-2021'),
    (U&'essential parfums-bois imp\00E9rial-unknown-2020'),
    ('etat libre d''orange-the ghost in the shell-unknown-0'),
    ('ex nihilo-blue talisman-unknown-2023'),
    ('francesca bianchi-the dark side-unknown-2016'),
    ('francesca bianchi-the lover''s tale-unknown-2018'),
    ('initio-musk therapy-unknown-2021'),
    ('initio-oud for greatness-unknown-2018'),
    ('issey miyake-le sel d''issey-unknown-2024'),
    ('j.f. schwarzlose berlin-1a-33-unknown-0'),
    ('kayali-lovefest burning cherry | 48-unknown-2022'),
    ('kayali-vanilla | 28-unknown-2018'),
    ('kilian-angels'' share-unknown-2020'),
    ('lalique-lalique le-parfum-0'),
    ('maison francis kurkdjian-grand soir-unknown-2016'),
    ('maison margiela-replica - autumn vibes-unknown-2021'),
    ('maison margiela-replica - bubble bath-unknown-2020'),
    ('maison margiela-replica - by the fireplace-unknown-2015'),
    ('maison margiela-replica - jazz club-unknown-2013'),
    ('maison margiela-replica - when the rain stops-unknown-2022'),
    (U&'mati\00E8re premi\00E8re-santal austral-unknown-2019'),
    (U&'mati\00E8re premi\00E8re-vanilla powder-unknown-2023'),
    ('mercedes-benz-club black-unknown-0'),
    ('rabanne-fame-unknown-2022'),
    ('rabanne-phantom-unknown-0'),
    ('serge lutens-la fille de berlin-eau de parfum-0'),
    ('sora dora-mandorle-unknown-2021'),
    ('tom ford-black orchid-parfum-0'),
    (U&'tom ford-\00E9b\00E8ne fum\00E9-unknown-2021'),
    ('valentino-valentino uomo-unknown-0'),
    ('widian-london-unknown-2018'),
    ('yves saint laurent-le vestiaire - tuxedo-unknown-2015'),
    ('zara-vibrant leather-eau de parfum-0')
) AS v (slug)
WHERE p.source_record_slug = v.slug
  AND p.is_uncertain
  AND p.is_active;

-- Autocomplete lists active perfumes only; this view drops the hidden copies.
REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
