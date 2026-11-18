"""List certain perfumes with flags for a local illustration and a published asset.

Writes missing_assets.csv (semicolon-separated, UTF-8 with BOM for spreadsheet apps) next to the
illustrations directory, in its parent directory.
"""

import csv
import os
import sys
from collections.abc import Callable
from typing import Any

from asset_config import load_env, local_dirs
from r2_client import make_supabase

# PostgREST caps a response at 1000 rows; a larger page would end the loop after the first one.
PAGE_SIZE = 1000
IMAGE_EXTENSIONS = (".avif", ".png", ".jpg", ".jpeg", ".webp")


def fetch_pages(
    make_query: Callable[[], Any], order_column: str, page_size: int = PAGE_SIZE
) -> list[dict[str, Any]]:
    """All rows of a query, page by page. Pages need a stable order, or rows move between them."""
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        batch = (
            make_query()
            .order(order_column)
            .range(start, start + page_size - 1)
            .limit(page_size)
            .execute()
            .data
        )
        rows.extend(batch or [])
        if not batch or len(batch) < page_size:
            return rows
        start += page_size


def main() -> None:
    load_env()
    try:
        supabase = make_supabase()
    except RuntimeError as error:
        print(f"Error: {error}")
        sys.exit(1)

    print("Fetching perfumes (is_uncertain=false)...")

    # Brands and concentrations come through foreign keys.
    all_data = fetch_pages(
        lambda: (
            supabase.table("perfumes")
            .select("id, name, release_year, is_uncertain, brands(name), concentrations(name)")
            .eq("is_uncertain", False)
        ),
        "id",
    )

    # Sort by brand, then name, for easier manual browsing
    data = sorted(
        all_data, key=lambda x: ((x.get("brands") or {}).get("name") or "", x.get("name") or "")
    )

    # Perfume ids that already have an illustration (file name is <uuid>.<extension>)
    assets_dir = local_dirs().illustrations
    existing_files = set()
    if assets_dir.exists():
        for fname in os.listdir(assets_dir):
            if fname.lower().endswith(IMAGE_EXTENSIONS):
                existing_files.add(os.path.splitext(fname)[0])

    # Perfume ids that already have published assets. A failed fetch stops the script: an empty
    # set would mark every perfume as missing.
    uploaded_assets = {
        row["perfume_id"]
        for row in fetch_pages(
            lambda: supabase.table("perfume_assets").select("perfume_id"), "perfume_id"
        )
    }

    output_dir = assets_dir.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    output_filename = output_dir / "missing_assets.csv"

    # utf-8-sig for Excel compatibility
    with open(output_filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(
            ["ID", "Name", "Brand", "Concentration", "Year", "is_in_folder", "is_in_Cloudflare"]
        )

        for row in data:
            pid = row.get("id")
            name = row.get("name")
            year = row.get("release_year") or ""

            brand_obj = row.get("brands")
            brand_name = brand_obj.get("name") if brand_obj else "Unknown"

            conc_obj = row.get("concentrations")
            conc_name = conc_obj.get("name") if conc_obj else "Unknown"

            in_folder = "TRUE" if pid in existing_files else "FALSE"
            in_cloud = "TRUE" if pid in uploaded_assets else "FALSE"

            writer.writerow([pid, name, brand_name, conc_name, year, in_folder, in_cloud])

    print(f"The database returned {len(data)} records.")
    print(f"List written to: {output_filename}")
    print("\nFormat:")
    print("UUID; Name; Brand; Concentration; Year; is_in_folder; is_in_Cloudflare")


if __name__ == "__main__":
    main()
