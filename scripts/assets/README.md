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

`rekey_assets.py` commands: to be documented.
