-- Keep solid, stick, compact, cream and gel perfumes out of autocomplete too.
--
-- Owner decision 2026-11-26, after 20261126020000_exclude_non_perfume_products: these forms leave
-- suggestions as well; perfume oils and attars stay. 44 labels, 705 active rows on 2026-11-26,
-- none of them certain, so none can be a daily answer. The search function already leaves out
-- every label with is_perfume = false.
--
-- Non-ASCII characters are written as U& escapes so the file stays ASCII.

UPDATE public.concentrations
SET is_perfume = false
WHERE name IN (
  -- Solid, stick and compact
  'Concentrated Solid Perfume',
  U&'Eau de Cologne Solide',
  U&'Gel Solide Parfum\00E9',
  'Intense Solid Perfume',
  'Parfum Solid',
  'Parfum Solide',
  'Profumo Solido',
  'Shimmer Solid Perfume',
  'Shimmering Solid Perfume',
  'Solid Cologne',
  'Solid Extrait',
  'Solid Fragrance',
  'Solid Parfum',
  'Solid Perfume',
  'Solid Perfume Concentrate',
  'Solid Scent',
  'Solid Super Perfume',
  'Cologne Stick',
  'Parfum Stick',
  'Perfume Stick',
  'Compact Parfum',
  'Parfum Compact',
  'Perfume Compact',
  U&'Concr\00E9ta',
  U&'Concr\00E8te Parfum\00E9e',
  U&'Parfum Concr\00E8te',
  'Confit de Parfum',
  -- Cream and balm
  'Cream Perfume',
  'Fragrance Cream',
  'Parfum Crema',
  'Ultra Creme Perfume',
  'Cushion Perfume',
  'Liquid Balm',
  -- Gel and mousse
  U&'Cologne Gel\00E9e',
  'Fragrance Gel',
  'Gel Cologne',
  U&'Gel Concentr\00E9',
  'Gel de Parfum',
  'Gel Fragrance',
  'Gel Perfume',
  'Parfum Gel',
  'Perfume Gel',
  'Perfume in Gel',
  'Parfumousse'
);
