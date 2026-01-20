
import os
import csv
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env variables (ensure .env.local is in the current or parent dir)
load_dotenv('.env.local')

# Setup Supabase client
url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local")
    exit(1)

supabase: Client = create_client(url, key)

def main():
    print("Fetching perfumes (is_uncertain=false)...")

    # Fetch data: select ID, Name, Brand, Concentration, Release Year
    # Note: We rely on foreign keys for brands and concentrations.
    # The query joins brands and concentrations tables.
    # Batch fetch all records to bypass 1000 limit
    all_data = []
    page_size = 1000
    start = 0
    total_count = supabase.table('perfumes').select('*', count='exact', head=True).eq('is_uncertain', False).execute().count
    
    print(f"Found {total_count} records to fetch...")
    
    while True:
        print(f"Fetching records {start} to {start+page_size}...")
        response = supabase.table('perfumes').select(
            'id, name, release_year, is_uncertain, brands(name), concentrations(name)'
        ).eq('is_uncertain', False).range(start, start + page_size - 1).execute()
        
        records = response.data
        if not records:
            break
            
        all_data.extend(records)
        start += page_size
        
        if len(records) < page_size:
            break

    data = all_data
    
    # Sort by Brand, then Name for easier manual browsing
    data.sort(key=lambda x: (
        x.get('brands', {}).get('name') or '', 
        x.get('name') or ''
    ))

    # Prepare set of IDs in 4postprocessed_assets
    # Relative path from script location: scripts/../../img/bottles/...
    base_proj_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_proj_dir, "img", "bottles", "4postprocessed_assets")
    existing_files = set()
    if os.path.exists(assets_dir):
        for fname in os.listdir(assets_dir):
            if fname.lower().endswith('.avif'):
                # Assuming filename is UUID.avif
                fid = os.path.splitext(fname)[0]
                existing_files.add(fid)

    # Prepare set of IDs in Supabase perfume_assets
    # Just fetch all perfume_ids from perfume_assets
    uploaded_assets = set()
    try:
        # Paging through perfume_assets just in case it grows large
        pa_start = 0
        pa_limit = 2000
        while True:
            res = supabase.table('perfume_assets').select('perfume_id').range(pa_start, pa_start + pa_limit - 1).execute()
            if not res.data:
                break
            for r in res.data:
                uploaded_assets.add(r['perfume_id'])
            if len(res.data) < pa_limit:
                break
            pa_start += pa_limit
    except Exception as e:
        print(f"Warning: Could not fetch perfume_assets (maybe table doesn't exist?): {e}")

    # Output path in img/bottles
    # base_proj_dir already defined above
    output_dir = os.path.join(base_proj_dir, "img", "bottles")
    os.makedirs(output_dir, exist_ok=True)
    output_filename = os.path.join(output_dir, 'missing_assets.csv')
    
    # Utf-8-sig for Excel compatibility
    with open(output_filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f, delimiter=';')
        # Header
        writer.writerow(['ID', 'Name', 'Brand', 'Concentration', 'Year', 'is_in_folder', 'is_in_Cloudflare'])
        
        for row in data:
            # Extract fields safely
            pid = row.get('id')
            name = row.get('name')
            year = row.get('release_year') or ''
            
            # Extract nested data
            brand_obj = row.get('brands')
            brand_name = brand_obj.get('name') if brand_obj else 'Unknown'
            
            conc_obj = row.get('concentrations')
            conc_name = conc_obj.get('name') if conc_obj else 'Unknown'
            
            in_folder = "TRUE" if pid in existing_files else "FALSE"
            in_cloud = "TRUE" if pid in uploaded_assets else "FALSE"

            writer.writerow([pid, name, brand_name, conc_name, year, in_folder, in_cloud])

    print(f"Baza danych zwróciła {len(data)} rekordów.")
    print(f"Zapisano listę do pliku: {output_filename}")
    print("\nFormat:")
    print("UUID, Name, Brand, Concentration, Year")

if __name__ == "__main__":
    main()
