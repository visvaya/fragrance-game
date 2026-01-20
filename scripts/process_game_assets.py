import os
import secrets
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import boto3
from dotenv import load_dotenv
from supabase import create_client, Client
import io

# Load Environment
load_dotenv('.env.local')

# Configuration
R2_ENDPOINT = os.getenv('R2_ENDPOINT_URL')
R2_ACCESS_KEY = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET = os.getenv('R2_BUCKET_NAME', 'fragrance-game-assets')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Relative path to assets
INPUT_DIR = Path(__file__).parent.parent / "img" / "bottles" / "4postprocessed_assets"

if not all([R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("Missing credentials in .env.local")

# Clients
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def generate_random_id(length=16):
    return secrets.token_hex(length // 2)

def generate_filename():
    return secrets.token_hex(2)  # 4 chars, e.g. "a1b2"

# --- Image Processing Functions ---

def apply_heavy_blur(img: Image.Image, radius=50) -> Image.Image:
    """Step 1-2: Very heavy blur (abstract shapes)"""
    return img.filter(ImageFilter.GaussianBlur(radius=radius))

def apply_medium_blur(img: Image.Image, radius=20) -> Image.Image:
    """Step 3: Medium blur (shapes visible)"""
    return img.filter(ImageFilter.GaussianBlur(radius=radius))

def apply_light_blur(img: Image.Image, radius=10) -> Image.Image:
    """Step 4: Light blur (details hinting)"""
    return img.filter(ImageFilter.GaussianBlur(radius=radius))

def apply_radial_mask(img: Image.Image) -> Image.Image:
    """Step 5: Radial mask revealing center + light blur"""
    # Create mask: white center, black outer
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    
    cx, cy = img.width // 2, img.height // 2
    radius = min(cx, cy) * 0.7  # 70% reveal
    
    # Draw soft circle
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=20)) # Soft edge
    
    # Apply mask to a slightly blurred version of the image
    blurred_bg = img.filter(ImageFilter.GaussianBlur(radius=5))
    
    # Composite: Center is sharp(er), outer is blurred/hidden?
    # Actually, let's make it simpler: Reveal center of SHARP image, over BLACK/White background?
    # Or just use the blurred background strategy similar to 'reveal' logic.
    # User's preference: "Maska (np. kółko odsłaniające fragment) lub bardzo lekki blur"
    
    # Let's do: Sharp image masked by circle, over a blurred background.
    result = Image.composite(img, apply_heavy_blur(img, 30), mask)
    return result

def save_optimized_avif(img: Image.Image, quality=65, min_quality=30, max_size_kb=55) -> bytes:
    """Adaptive compression to fit target size"""
    # Try target quality
    out_io = io.BytesIO()
    img.save(out_io, format='AVIF', quality=quality, speed=6) # speed 6 is good balance
    
    # If too big, lower quality
    if out_io.tell() > max_size_kb * 1024:
        # Binary search or just brute force step down
        for q in range(quality - 10, min_quality - 1, -10):
            out_io = io.BytesIO()
            img.save(out_io, format='AVIF', quality=q, speed=9) # faster speed for retry
            if out_io.tell() <= max_size_kb * 1024:
                return out_io.getvalue()
    
    return out_io.getvalue()

# --- Main Pipeline ---

def process_file(file_path: Path):
    filename = file_path.stem # UUID
    try:
        uuid_str = filename
        # Basic validation of UUID format? skipping for now, relying on filename
    except:
        print(f"Skipping non-UUID filename: {file_path}")
        return

    print(f"Processing {uuid_str}...")
    
    # 1. Open Master Image
    master_img = Image.open(file_path).convert("RGBA")
    
    # 2. Setup Variants
    # Steps: 6 total
    # 1: Extreme Blur
    # 2: Big Blur
    # 3: Medium Blur
    # 4: Light Blur
    # 5: Radial Reveal/Mask
    # 6: Original (Master)
    
    variants = [
        (1, lambda i: apply_heavy_blur(i, 80)),
        (2, lambda i: apply_heavy_blur(i, 50)),
        (3, lambda i: apply_medium_blur(i, 20)),
        (4, lambda i: apply_light_blur(i, 8)),
        (5, apply_radial_mask),
        (6, lambda i: i) # Master
    ]
    
    asset_random_id = generate_random_id()
    variant_keys = {}
    
    # 3. Process & Upload
    for step, transform_func in variants:
        
        # Apply Transform
        processed_img = transform_func(master_img.copy())
        
        # Optimize
        # Steps 1-2 can be heavily compressed (low detail)
        # Step 6 needs best quality
        q = 75 if step == 6 else 60
        max_kb = 70 if step == 6 else 40
        
        img_data = save_optimized_avif(processed_img, quality=q, max_size_kb=max_kb)
        
        # Generate Key
        rand_name = generate_filename()
        key = f"a/{asset_random_id}/{step}_{rand_name}.avif" # prefix step for easier debugging, but filename is random enough
        # Actually plan said: "a/{random}/{variant}.avif". Random filename prevents guessing step order?
        # If I include 'step', user might guess step 6.
        # Better: just random filename. The DB mapping tells us which is which.
        
        frame_name = generate_filename()
        key = f"a/{asset_random_id}/{frame_name}.avif"
        
        # Upload
        print(f"  -> Uploading Step {step} ({len(img_data)/1024:.1f}KB) to {key}")
        s3_client.put_object(
            Bucket=R2_BUCKET,
            Key=key,
            Body=img_data,
            ContentType='image/avif',
            CacheControl='public, max-age=31536000'
        )
        variant_keys[f'image_key_step_{step}'] = key

    # 4. Update Database
    data = {
        'perfume_id': uuid_str,
        'asset_random_id': asset_random_id,
        **variant_keys
    }
    
    # Upsert perfume_assets
    supabase.table('perfume_assets').upsert(data).execute()
    
    # Upsert perfume_asset_sources (Audit)
    # Since we don't have source URL, we assume it is already 'web_catalog' or we just insert minimalist record
    # Migration has UNIQUE(perfume_id, version). 
    supabase.table('perfume_asset_sources').upsert({
        'perfume_id': uuid_str,
        'version': 1,
        'source_type': 'web_catalog',
        'source_url': 'manual_upload_from_folder', # Placeholder
        'license_status': 'unknown',
        'takedown_status': 'active'
    }, on_conflict='perfume_id, version').execute()

    print(f"✅ Completed {uuid_str}")

def main():
    if not INPUT_DIR.exists():
        print(f"Directory not found: {INPUT_DIR}")
        return

    # Find valid files
    files = [f for f in INPUT_DIR.glob('*.avif') if len(f.stem) == 36] # Crude UUID check
    
    print(f"Found {len(files)} potential assets.")
    
    for f in files:
        # Check if already processed? 
        # We can query DB for this ID.
        try:
             res = supabase.table('perfume_assets').select('perfume_id').eq('perfume_id', f.stem).execute()
             if res.data:
                 print(f"Skipping {f.stem} (Already in DB)")
                 continue
        except Exception as e:
            print(f"DB Check failed: {e}")
            
        process_file(f)

if __name__ == '__main__':
    main()
