-- Game image keys must be unguessable: each asset directory has a 128-bit random id that belongs
-- to exactly one perfume, and each step file inside it has its own 128-bit random name. The server
-- hands out only the URL of the step a player has reached, so no other step can be found.

DROP INDEX IF EXISTS public.idx_perfume_assets_random_id;

ALTER TABLE public.perfume_assets
  ADD CONSTRAINT perfume_assets_asset_random_id_key UNIQUE (asset_random_id),
  ADD CONSTRAINT perfume_assets_asset_random_id_format
    CHECK (asset_random_id ~ '^[0-9a-f]{32}$'),
  ADD CONSTRAINT perfume_assets_step_keys_format CHECK (
    image_key_step_1 ~ ('^a/' || asset_random_id || '/[0-9a-f]{32}\.avif$')
    AND image_key_step_2 ~ ('^a/' || asset_random_id || '/[0-9a-f]{32}\.avif$')
    AND image_key_step_3 ~ ('^a/' || asset_random_id || '/[0-9a-f]{32}\.avif$')
    AND image_key_step_4 ~ ('^a/' || asset_random_id || '/[0-9a-f]{32}\.avif$')
    AND image_key_step_5 ~ ('^a/' || asset_random_id || '/[0-9a-f]{32}\.avif$')
    AND image_key_step_6 ~ ('^a/' || asset_random_id || '/[0-9a-f]{32}\.avif$')
  ),
  ADD CONSTRAINT perfume_assets_step_keys_distinct CHECK (
    image_key_step_1 NOT IN (image_key_step_2, image_key_step_3, image_key_step_4,
                             image_key_step_5, image_key_step_6)
    AND image_key_step_2 NOT IN (image_key_step_3, image_key_step_4, image_key_step_5,
                                 image_key_step_6)
    AND image_key_step_3 NOT IN (image_key_step_4, image_key_step_5, image_key_step_6)
    AND image_key_step_4 NOT IN (image_key_step_5, image_key_step_6)
    AND image_key_step_5 <> image_key_step_6
  );
