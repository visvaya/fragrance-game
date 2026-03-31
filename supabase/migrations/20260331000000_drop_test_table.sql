-- Removes leftover test-table from production.
-- Table has 0 rows and is not tracked in any migration — manual test artifact.
DROP TABLE IF EXISTS public."test-table";
