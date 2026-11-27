-- Temporary probe that makes the "Base code on the new schema" job run; removed before merge.
-- A breaking rename: the base code still selects perfumes_public.name.
ALTER VIEW public.perfumes_public RENAME COLUMN name TO perfume_name;
