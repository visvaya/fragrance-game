"""List certain perfumes with flags for a local illustration and a published asset.

Writes missing_assets.csv (semicolon-separated, UTF-8 with BOM for spreadsheet apps) next to the
illustrations directory, in its parent directory.
"""

import csv
import os
import sys

from asset_config import load_env, local_dirs
from r2_client import make_supabase

PAGE_SIZE = 1000
ASSET_PAGE_SIZE = 2000
IMAGE_EXTENSIONS = ('.avif', '.png', '.jpg', '.jpeg', '.webp')


def main():
    load_env()
    try:
        supabase = make_supabase()
    except RuntimeError as error:
        print(f"Error: {error}")
        sys.exit(1)

    print("Fetching perfumes (is_uncertain=false)...")

    # Brands and concentrations come through foreign keys. Records are fetched in pages to get
    # past the 1000-row response limit.
    all_data = []
    start = 0
    total_count = (
        supabase.table('perfumes')
        .select('id', count='exact', head=True)
        .eq('is_uncertain', False)
        .execute()
        .count
    )

    print(f"Found {total_count} records to fetch...")

    while True:
        print(f"Fetching records {start} to {start + PAGE_SIZE}...")
        response = supabase.table('perfumes').select(
            'id, name, release_year, is_uncertain, brands(name), concentrations(name)'
        ).eq('is_uncertain', False).range(start, start + PAGE_SIZE - 1).execute()

        records = response.data
        if not records:
            break

        all_data.extend(records)
        start += PAGE_SIZE

        if len(records) < PAGE_SIZE:
            break

    # Sort by brand, then name, for easier manual browsing
    data = sorted(all_data, key=lambda x: (
        (x.get('brands') or {}).get('name') or '',
        x.get('name') or ''
    ))

    # Perfume ids that already have an illustration (file name is <uuid>.<extension>)
    assets_dir = local_dirs().illustrations
    existing_files = set()
    if assets_dir.exists():
        for fname in os.listdir(assets_dir):
            if fname.lower().endswith(IMAGE_EXTENSIONS):
                existing_files.add(os.path.splitext(fname)[0])

    # Perfume ids that already have published assets
    uploaded_assets = set()
    try:
        pa_start = 0
        while True:
            res = (
                supabase.table('perfume_assets')
                .select('perfume_id')
                .range(pa_start, pa_start + ASSET_PAGE_SIZE - 1)
                .execute()
            )
            if not res.data:
                break
            for r in res.data:
                uploaded_assets.add(r['perfume_id'])
            if len(res.data) < ASSET_PAGE_SIZE:
                break
            pa_start += ASSET_PAGE_SIZE
    except Exception as e:
        print(f"Warning: Could not fetch perfume_assets: {e}")

    output_dir = assets_dir.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    output_filename = output_dir / 'missing_assets.csv'

    # utf-8-sig for Excel compatibility
    with open(output_filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['ID', 'Name', 'Brand', 'Concentration', 'Year', 'is_in_folder', 'is_in_Cloudflare'])

        for row in data:
            pid = row.get('id')
            name = row.get('name')
            year = row.get('release_year') or ''

            brand_obj = row.get('brands')
            brand_name = brand_obj.get('name') if brand_obj else 'Unknown'

            conc_obj = row.get('concentrations')
            conc_name = conc_obj.get('name') if conc_obj else 'Unknown'

            in_folder = "TRUE" if pid in existing_files else "FALSE"
            in_cloud = "TRUE" if pid in uploaded_assets else "FALSE"

            writer.writerow([pid, name, brand_name, conc_name, year, in_folder, in_cloud])

    print(f"The database returned {len(data)} records.")
    print(f"List written to: {output_filename}")
    print("\nFormat:")
    print("UUID; Name; Brand; Concentration; Year; is_in_folder; is_in_Cloudflare")


if __name__ == "__main__":
    main()
