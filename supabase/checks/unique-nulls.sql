-- A UNIQUE key over a nullable column accepts any number of rows with NULL in it, so the rule it
-- states (one game per player and day, one slug per perfume) does not hold for those rows. Every
-- unique index in public must cover only NOT NULL columns or use NULLS NOT DISTINCT. Runs on the
-- database built from the migrations (CI job "Database from migrations"); the Supabase linter has no
-- such lint. Read-only.
DO $check$
DECLARE
  found text;
BEGIN
  SELECT string_agg(format('%s.%s (nullable: %s)', c.relname, i.relname, cols), E'\n' ORDER BY c.relname, i.relname)
  INTO found
  FROM pg_catalog.pg_index x
  JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid
  JOIN pg_catalog.pg_class c ON c.oid = x.indrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL (
    SELECT string_agg(a.attname, ', ' ORDER BY a.attnum) AS cols
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = c.oid AND NOT a.attnotnull
      AND (
        a.attnum = ANY (x.indkey)
        -- An expression key (lower(slug)) stores 0 in indkey; the columns it reads are recorded as
        -- dependencies of the index. A partial index predicate is recorded the same way, so a column
        -- that only appears in WHERE is reported too; such an index gets NOT NULL or an exception.
        OR a.attnum IN (
          SELECT d.refobjsubid FROM pg_catalog.pg_depend d
          WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.objid = x.indexrelid
            AND d.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid = c.oid
            AND d.refobjsubid > 0
        )
      )
  ) nullable
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND x.indisunique AND NOT x.indnullsnotdistinct
    AND nullable.cols IS NOT NULL;

  IF found IS NOT NULL THEN
    RAISE EXCEPTION E'unique keys over nullable columns (add NOT NULL or NULLS NOT DISTINCT):\n%', found;
  END IF;
  RAISE NOTICE 'unique keys: none over nullable columns';
END
$check$;
