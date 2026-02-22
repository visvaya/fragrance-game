-- Migration: Fix double-encoded UTF-8 characters in concentration names
-- Date: 2026-02-22
-- Problem: 'î' (U+00EE, UTF-8: c3ae) was stored as c482c2ae (Ă + ®) due to CSV import encoding error.
-- Affected: 'Eau FraĂ®che' and 'Eau de FraĂ®cheur'

UPDATE concentrations SET name = 'Eau Fraîche'      WHERE id = '205ecff2-f482-4153-b522-cc8bf90297e9';
UPDATE concentrations SET name = 'Eau de Fraîcheur' WHERE id = 'eb66b678-2e4d-4ee2-9345-0949feb7061d';

REFRESH MATERIALIZED VIEW public.perfume_autocomplete_cache;
