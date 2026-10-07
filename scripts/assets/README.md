# Game image pipeline

Scripts that turn perfume photos into the six progressive game images and publish them to the
R2 bucket and the `perfume_assets` table.

## Setup

From `fragrance-webapp/`, in a Python 3.12+ virtual environment:

```bash
python -m pip install -r scripts/assets/requirements.txt
```

Pillow must report AVIF support: `python -c "from PIL import features; print(features.check('avif'))"`
prints `True`.

## Pipeline order

1. `python scripts/assets/generate_asset_list.py` writes `missing_assets.csv` (certain perfumes,
   whether an illustration exists locally and whether assets are published).
2. `python scripts/assets/preprocess_assets.py` crops original photos to the object and centres
   them on a white square canvas.
3. Illustrations are made by hand from the preprocessed photos and saved as `<perfume uuid>.png`
   (or `.avif`) in the illustrations directory.
4. `python scripts/assets/process_game_assets.py` builds the six step images and publishes them.
   Flags: `--local` (write to the debug directory, no upload), `--no-compression`, `--force`
   (replace existing assets without asking), `--skip-existing`.

Publishing order: the new files are uploaded first, then the database row is switched to them,
and only then is the old asset directory removed. A failure before the switch removes the
partial upload and keeps the old asset.

Warning: re-publishing (`--force`) the perfume of today's puzzle deletes its old directory at once,
while the server may keep serving the cached step-1 URL until the midnight cron. Re-publish only
perfumes that are not today's puzzle, or revalidate the `daily-challenge` cache tag afterwards.

## Key format

Each perfume asset lives under `a/<32 hex asset id>/` and each step file has its own name of
32 random hex characters (`.avif`): every step file has an unguessable name, and the server hands
out only the current step, so one step's URL reveals nothing about the others.

## Environment (`fragrance-webapp/.env.local`)

Required:

- `R2_ENDPOINT_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `NEXT_PUBLIC_ASSETS_HOST`
- `ASSET_ORIGINALS_DIR`, `ASSET_PREPROCESSED_DIR`, `ASSET_ILLUSTRATIONS_DIR`, `ASSET_DEBUG_DIR`
  (local directories; relative paths resolve against `fragrance-webapp/`)

Use an R2 API token limited to object read and write on this one bucket.

## Re-keying existing assets

`scripts/assets/rekey_assets.py` moves published images to new keys in the format above. Run the
commands in this order (each reads `.env.local`):

1. `backup --out DIR` downloads every object under `a/` into an empty `DIR` and writes
   `DIR/manifest.json` with the SHA-256 and size of each object.
2. `plan --out FILE` reads `perfume_assets` and the bucket listing and writes a plan with new
   ids and keys for every row plus the objects no row references.
3. `copy --plan FILE` copies each object to its new key with the current content type and cache
   headers; objects already copied are skipped, so it can be re-run.
4. `verify --plan FILE` fetches old and new keys over HTTPS and fails on a status, content or
   header mismatch.
5. `sql --plan FILE --out DIR` writes `apply.sql` (the database swap, one checked block) and
   `rollback.sql` (the reverse swap) for review before they are applied.
6. `cleanup --plan FILE` lists old and orphaned objects the database no longer references and
   refuses to run before the swap; with `--execute` it deletes them and writes
   `purged-sources.txt` next to the plan with their public URLs for a cache purge.

`copy` and `cleanup` are dry runs that only print what they would do unless `--execute` is given.
