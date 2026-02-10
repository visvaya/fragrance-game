-- Fix common encoding errors (UTF-8 double-encoded as Latin-1) in concentrations table
UPDATE concentrations 
SET name = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(name,
            'FraÃ®che', 'Fraîche', 'g'),  -- î
          'ParfumÃ©e', 'Parfumée', 'g'),   -- é
        'ExtrÃªme', 'Extrême', 'g'),       -- ê
      'LÃ©gÃ¨re', 'Légère', 'g'),         -- é, è
    'Ã©', 'é', 'g'),                      -- standalone é
  'Ã¨', 'è', 'g')                         -- standalone è
WHERE name ~ 'Ã[^\s]';          -- Match only mojibake patterns

-- Verify
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM concentrations
  WHERE name LIKE '%Ã%';
  
  IF bad_count > 0 THEN
    RAISE WARNING 'Still % rows with encoding issues in concentrations', bad_count;
  ELSE
    RAISE NOTICE 'Encoding cleanup successful';
  END IF;
END $$;
