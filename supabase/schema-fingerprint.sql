-- Schema fingerprint: one line per object property of the project schema (public, plus project
-- triggers on auth tables), so two databases with the same output have the same schema.
-- Covers the project extensions, relations, columns, constraints, indexes, view
-- definitions (md5), functions (signature, argument names and defaults, settings, md5 of the
-- body), triggers, policies, privileges of PUBLIC and the API roles, sequence type and start,
-- comments, and the default privileges of postgres in public.
-- Does not cover: data; objects that belong to extensions; extension versions and extensions the
-- platform installs; sequence OWNED BY, min, max and cache; column collation; index validity;
-- replica identity; schema privileges; publications; storage; role settings; default privileges
-- of other roles; triggers on auth tables that call functions outside public.
-- An empty search_path makes catalog functions print qualified names, and the C collation makes
-- the order independent of the database locale.
-- supabase/schema-fingerprint.txt holds the expected output (production); CI compares the two.
set search_path to '';
with rel as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.reloptions, c.relacl, c.relowner
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','v','m','S')
    and not exists (select 1 from pg_catalog.pg_depend d
                    where d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass and d.objid = c.oid and d.deptype = 'e')
), fn as (
  select p.oid, p.proname, p.prolang, p.prosecdef, p.provolatile, p.proisstrict, p.proparallel, p.proconfig, p.prosrc, p.proacl, p.proowner,
    p.prorows, p.procost, p.proleakproof
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_catalog.pg_depend d
                    where d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass and d.objid = p.oid and d.deptype = 'e')
), acl as (
  select 'relation ' || r.relname as obj, a.grantee, a.privilege_type, a.is_grantable
  from rel r cross join lateral pg_catalog.aclexplode(coalesce(r.relacl,
    pg_catalog.acldefault(case when r.relkind = 'S' then 's'::"char" else 'r'::"char" end, r.relowner))) a
  union all
  select 'function ' || f.oid::pg_catalog.regprocedure::text, a.grantee, a.privilege_type, a.is_grantable
  from fn f cross join lateral pg_catalog.aclexplode(coalesce(f.proacl, pg_catalog.acldefault('f'::"char", f.proowner))) a
), lines(section, line) as (
  select '01 extension', e.extname || ' schema=' || n.nspname
  from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace
  where e.extname in ('pg_trgm','unaccent','fuzzystrmatch','uuid-ossp')
  union all
  select '02 relation', r.relname || ' kind=' || r.relkind::text || ' owner=' || pg_catalog.pg_get_userbyid(r.relowner)
    || ' rls=' || r.relrowsecurity::text || ' force=' || r.relforcerowsecurity::text || ' options=' || coalesce(r.reloptions::text, '-')
  from rel r
  union all
  -- Column position counts only live columns: dropped columns leave gaps in attnum that a fresh
  -- database cannot have, while the visible column order stays significant.
  select '03 column', r.relname || '.'
    || lpad((row_number() over (partition by r.oid order by a.attnum))::text, 3, '0') || ' ' || a.attname::text || ' '
    || pg_catalog.format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' not null' else '' end
    || coalesce(' default ' || pg_catalog.pg_get_expr(d.adbin, d.adrelid), '')
    || case when a.attidentity::text <> '' then ' identity' else '' end
    || case when a.attgenerated::text <> '' then ' generated' else '' end
    || coalesce(' acl=' || a.attacl::text, '')
  from rel r join pg_catalog.pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
  left join pg_catalog.pg_attrdef d on d.adrelid = r.oid and d.adnum = a.attnum
  where r.relkind in ('r','v','m')
  union all
  select '04 constraint', r.relname || ' ' || c.conname::text || ' ' || pg_catalog.pg_get_constraintdef(c.oid)
    || case when c.convalidated then '' else ' NOT VALID' end
  from rel r join pg_catalog.pg_constraint c on c.conrelid = r.oid
  union all
  select '05 index', pg_catalog.pg_get_indexdef(i.indexrelid)
  from rel r join pg_catalog.pg_index i on i.indrelid = r.oid
  union all
  select '06 view', r.relname || ' md5=' || md5(pg_catalog.pg_get_viewdef(r.oid))
  from rel r where r.relkind in ('v','m')
  union all
  select '07 function', f.oid::pg_catalog.regprocedure::text || ' returns ' || pg_catalog.pg_get_function_result(f.oid)
    || ' lang=' || l.lanname::text || ' secdef=' || f.prosecdef::text || ' vol=' || f.provolatile::text
    || ' strict=' || f.proisstrict::text || ' parallel=' || f.proparallel::text
    || ' config=' || coalesce(f.proconfig::text, '-') || ' owner=' || pg_catalog.pg_get_userbyid(f.proowner)
    || ' rows=' || f.prorows::text || ' cost=' || f.procost::text || ' leakproof=' || f.proleakproof::text
    -- Argument names and defaults: PostgREST calls functions by parameter name.
    || ' args=' || pg_catalog.pg_get_function_arguments(f.oid)
    || ' md5=' || md5(replace(f.prosrc, chr(13), ''))
  from fn f join pg_catalog.pg_language l on l.oid = f.prolang
  union all
  select '08 trigger', pg_catalog.pg_get_triggerdef(t.oid) || ' enabled=' || t.tgenabled::text
  from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (n.nspname = 'public' or (n.nspname = 'auth' and t.tgfoid in (select oid from fn)))
  union all
  select '09 policy', p.tablename::text || ' "' || p.policyname::text || '" ' || p.permissive || ' ' || p.cmd
    || ' to=' || array_to_string(p.roles, ',') || ' using=' || coalesce(p.qual, '-') || ' check=' || coalesce(p.with_check, '-')
  from pg_catalog.pg_policies p where p.schemaname = 'public'
  union all
  select '10 acl', a.obj || ' ' || coalesce(g.rolname::text, 'PUBLIC') || '='
    -- A trailing * marks a privilege granted WITH GRANT OPTION.
    || string_agg(a.privilege_type || case when a.is_grantable then '*' else '' end, ',' order by a.privilege_type)
  from acl a left join pg_catalog.pg_roles g on g.oid = a.grantee
  where a.grantee = 0 or g.rolname in ('anon','authenticated','service_role')
  group by a.obj, g.rolname
  union all
  select '11 sequence', s.sequencename::text || ' type=' || s.data_type::text || ' start=' || s.start_value
    || ' inc=' || s.increment_by || ' cycle=' || s.cycle::text
  from pg_catalog.pg_sequences s where s.schemaname = 'public'
  union all
  select '12 comment', 'relation ' || r.relname || ': ' || pg_catalog.obj_description(r.oid, 'pg_class')
  from rel r where pg_catalog.obj_description(r.oid, 'pg_class') is not null
  union all
  select '12 comment', 'function ' || f.oid::pg_catalog.regprocedure::text || ': ' || pg_catalog.obj_description(f.oid, 'pg_proc')
  from fn f where pg_catalog.obj_description(f.oid, 'pg_proc') is not null
  union all
  select '12 comment', 'column ' || r.relname || '.' || a.attname::text || ': ' || pg_catalog.col_description(r.oid, a.attnum)
  from rel r join pg_catalog.pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
  where pg_catalog.col_description(r.oid, a.attnum) is not null
  union all
  -- Privileges that objects created by postgres in public get automatically (entries of the
  -- platform role supabase_admin are left out: the project cannot change them).
  select '13 default acl', 'type=' || d.defaclobjtype::text
    || ' schema=' || case when d.defaclnamespace = 0 then '*' else d.defaclnamespace::pg_catalog.regnamespace::text end
    || ' ' || coalesce(g.rolname::text, 'PUBLIC') || '='
    || string_agg(a.privilege_type || case when a.is_grantable then '*' else '' end, ',' order by a.privilege_type)
  from pg_catalog.pg_default_acl d
  cross join lateral pg_catalog.aclexplode(d.defaclacl) a
  left join pg_catalog.pg_roles g on g.oid = a.grantee
  where d.defaclrole = 'postgres'::pg_catalog.regrole
    and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::pg_catalog.regnamespace)
    and (a.grantee = 0 or g.rolname in ('anon','authenticated','service_role'))
  group by d.defaclobjtype, d.defaclnamespace, g.rolname
)
select section || ' | ' || line as fingerprint
from lines
order by section collate "C", line collate "C";
