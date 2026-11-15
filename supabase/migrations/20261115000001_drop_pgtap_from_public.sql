-- pgTAP lived in the public schema, which the REST API exposes, and its functions run arbitrary SQL.
-- `supabase test db` installs it into the extensions schema before the tests and drops it afterwards
-- when it was not installed before, so the database itself does not need it.
drop extension if exists pgtap;
