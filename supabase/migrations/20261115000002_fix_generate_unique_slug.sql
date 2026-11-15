-- The slug trigger compared ids with an unqualified uuid_generate_v4(), which lives in the extensions
-- schema while the function's search_path is public, so every insert into perfumes failed. Comparing
-- with IS DISTINCT FROM keeps the meaning (a new row with no id matches every existing slug) without
-- any extension. CREATE OR REPLACE keeps the trigger binding and the existing grants.
CREATE OR REPLACE FUNCTION public.generate_unique_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    brand_slug TEXT;
    conc_slug TEXT;
    base_slug TEXT;
    final_slug TEXT;
    counter INT := 1;
BEGIN
    SELECT slug INTO brand_slug FROM brands WHERE id = NEW.brand_id;

    IF NEW.concentration_id IS NOT NULL THEN
        SELECT slug INTO conc_slug FROM concentrations WHERE id = NEW.concentration_id;
    ELSE
        conc_slug := 'unknown';
    END IF;

    base_slug := brand_slug || '_' || slugify(NEW.name) || '_' || conc_slug || '_' || COALESCE(NEW.release_year::TEXT, 'unknown');
    final_slug := base_slug;

    -- Dedup loop
    WHILE EXISTS(SELECT 1 FROM perfumes WHERE unique_slug = final_slug AND id IS DISTINCT FROM NEW.id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '_' || counter;
    END LOOP;

    NEW.unique_slug := final_slug;
    RETURN NEW;
END;
$function$;
