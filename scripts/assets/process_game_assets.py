"""Build the six game images for each perfume and publish them.

Input: illustrations named <perfume uuid>.png or .avif in the illustrations directory.
Remote mode uploads each step under an unguessable key and switches the database row through
asset_publish.publish_asset; --local writes the files to the debug directory instead.
"""

import argparse
import io
import logging
from collections.abc import Sequence
from pathlib import Path
from typing import Any, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

from asset_config import ASSET_CONFIG, load_env, local_dirs
from asset_publish import publish_asset
from r2_client import bucket_name, make_s3_client, make_supabase

# Optional AVIF plugin for older Pillow builds
try:
    import pillow_avif  # noqa: F401
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DELETE_BATCH_SIZE = 1000  # S3 DeleteObjects accepts at most 1000 keys per request

# --- Optimization Functions ---

def _resolve_quantize_method(method_name: str) -> int:
    name = (method_name or "auto").lower()
    quantize_enum = getattr(Image, "Quantize", None)
    
    def _get(attr):
        val = getattr(quantize_enum, attr, None) if quantize_enum else getattr(Image, attr, None)
        return int(val) if val is not None else 0

    mediancut = _get("MEDIANCUT") or 0
    fastoctree = _get("FASTOCTREE") or mediancut
    libimagequant = _get("LIBIMAGEQUANT")
    
    if name == "libimagequant": return libimagequant or fastoctree
    if name == "fastoctree": return fastoctree
    return mediancut

def _snap_near_white(img: Image.Image, threshold: int) -> Image.Image:
    if not threshold or threshold <= 0: return img
    data = np.asarray(img)
    # Check if any pixel meets the condition before copying/processing
    mask = (data[:, :, 0] >= threshold) & (data[:, :, 1] >= threshold) & (data[:, :, 2] >= threshold)
    if not mask.any(): return img
    
    data2 = data.copy()
    data2[mask] = (255, 255, 255)
    
    return Image.fromarray(data2, mode=img.mode)

def reduce_image_complexity(
    img: Image.Image,
    colors: int = 0,
    quantize_method: str = "auto",
    posterize_bits: int = 0,
    median: int = 0,
    snap_white_threshold: int = 253,
) -> Image.Image:
    img = img.convert("RGB")
    
    if median >= 3:
        img = img.filter(ImageFilter.MedianFilter(size=median))
    
    if posterize_bits > 0:
        img = ImageOps.posterize(img, bits=int(posterize_bits))
        
    # Pre-snap to help quantization
    if snap_white_threshold > 0:
        img = _snap_near_white(img, threshold=snap_white_threshold)
        
    if colors > 0:
        method = _resolve_quantize_method(quantize_method)
        # Handle Dither constant safe lookup
        dither_method = getattr(Image, "Dither", Image).FLOYDSTEINBERG
        img = img.quantize(colors=int(colors), method=method, dither=dither_method).convert("RGB")
        # Post-snap to clean up dithering near white
        if snap_white_threshold > 0:
            img = _snap_near_white(img, threshold=snap_white_threshold)
        
    return img

def add_noise(img: Image.Image, intensity: float = 0.05) -> Image.Image:
    """
    Adds monochromatic noise.
    """
    if intensity <= 1e-4: return img
    
    arr = np.asarray(img).astype(float)
    noise = np.random.normal(0, intensity * 255, arr.shape[:2])
    
    if len(arr.shape) == 3:
        noise = noise[:, :, np.newaxis]
        
    arr = arr + noise
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    
    return Image.fromarray(arr, mode=img.mode)

def normalize_to_square_canvas(img: Image.Image, target_size: int = 400) -> Image.Image:
    """
    Resizes image to fit within target_size x target_size, maintaining aspect ratio,
    and pads the rest with white to create a perfect square.
    """
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB") # Ensure RGB
    
    w, h = img.size
    if w == 0 or h == 0:
        return Image.new("RGB", (target_size, target_size), (255, 255, 255))
        
    scale = target_size / float(max(w, h))
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    
    img_resized = img.resize((new_w, new_h), resample=Image.Resampling.LANCZOS)
    
    canvas = Image.new("RGB", (target_size, target_size), (255, 255, 255))
    paste_x = (target_size - new_w) // 2
    paste_y = (target_size - new_h) // 2
    canvas.paste(img_resized, (paste_x, paste_y))
    
    return canvas

def encode_image(img: Image.Image, quality: int, speed: int = 0, subsampling: str = "4:2:0") -> bytes:
    buf = io.BytesIO()
    try:
        img.save(buf, format="AVIF", quality=quality, speed=speed, subsampling=subsampling)
    except Exception:
        # Retry without subsampling/speed if libs are old
        try:
             img.save(buf, format="AVIF", quality=quality)
        except Exception as e2:
            logger.error(f"AVIF save failed: {e2}")
            raise e2
    return buf.getvalue()

def choose_quality_for_max_kb(
    img: Image.Image,
    max_kb: int,
    min_quality: int = 20,
    max_quality: int = 80,
    speed: int = 0 
) -> bytes:
    """
    Uses Binary Search to find the highest quality that fits within max_kb.
    O(log N) complexity compared to linear scan O(N).
    """
    low = min_quality
    high = max_quality
    best_data = None
    target_bytes = max_kb * 1024

    # First check max quality to see if we even need to optimize
    best_possible_data = encode_image(img, quality=high, speed=speed, subsampling="4:2:0")
    if len(best_possible_data) <= target_bytes:
        return best_possible_data

    # Binary search
    while low <= high:
        mid = (low + high) // 2
        data = encode_image(img, quality=mid, speed=speed, subsampling="4:2:0")
        
        if len(data) <= target_bytes:
            best_data = data
            low = mid + 1  # Try to increase quality
        else:
            high = mid - 1 # Reduce quality

    if best_data:
        return best_data
    
    # Fallback to min quality if nothing fit
    return encode_image(img, quality=min_quality, speed=speed, subsampling="4:2:0")

# --- Normalization Logic ---

def normalize_signal(img: Image.Image, target_mean: float = 160.0, target_std: float = 40.0) -> Image.Image:
    """
    Normalizes the object's luminance to equalize difficulty.
    Assumes white background.
    """
    # Convert to Grayscale for analysis
    gray = img.convert("L")
    arr = np.array(gray).astype(float)
    
    # Mask: Pixels darker than 250 (Background assumed > 250)
    # We invert the logic: Object < 250.
    mask = arr < 250
    
    if not np.any(mask):
        # Empty object? Return original
        return img
        
    # Analyze masked pixels
    obj_pixels = arr[mask]
    current_mean = np.mean(obj_pixels)
    current_std = np.std(obj_pixels)
    
    if current_std < 1e-5: current_std = 1.0 # Prevent div by zero
    
    # Normalize: (x - mean) / std -> z-score
    # Then scale: z * target_std + target_mean
    norm_pixels = (obj_pixels - current_mean) / current_std
    new_pixels = norm_pixels * target_std + target_mean
    
    # Clip
    new_pixels = np.clip(new_pixels, 0, 255)
    
    # Apply back to array
    res_arr = np.full_like(arr, 255) # Default to white background
    res_arr[mask] = new_pixels
    
    return Image.fromarray(res_arr.astype(np.uint8), mode="L").convert("RGB")

# --- Progression Logic ---

def apply_progressive_reveal(
    img: Image.Image,
    blur_px: float,
    reveal_pct: float,
    grayscale: bool = False,
    noise_intensity: float = 0.0,
    normalize: bool = False,
    base_img_override: Optional[Image.Image] = None
) -> Image.Image:
    """
    Applies blur, optional grayscale, SIGNAL NORMALIZATION, NOISE (bg only), and a center reveal mask.
    OPTIMIZATION: base_img_override can be passed to avoid expensive normalization/grayscale re-calculation.
    """
    
    # 1. Base Transformation (Background)
    if base_img_override:
        # Use pre-calculated base (already normalized/grayscaled)
        base_img = base_img_override.copy()
    else:
        # Fallback to calculating from scratch
        base_img = img.copy()
        if normalize:
            # Normalize Signal (Equalizes dark/light bottles to faint grey ghost)
            # Target Mean 238 (very light grey), Std 10.
            base_img = normalize_signal(base_img, target_mean=238.0, target_std=10.0)
        elif grayscale:
            # Legacy simple grayscale
            base_img = ImageOps.grayscale(base_img).convert("RGB")
        
    if blur_px > 0:
        base_img = base_img.filter(ImageFilter.GaussianBlur(radius=blur_px))

    # Apply Noise to Background
    if noise_intensity > 0:
        base_img = add_noise(base_img, intensity=noise_intensity)

    # If full reveal, return FOREGROUND color (img)
    if reveal_pct >= 1.0:
        return img 
        
    # If no reveal, return BACKGROUND
    if reveal_pct <= 0:
        return base_img
        
    # 2. Composition with Mask
    w, h = img.size
    cx, cy = w // 2, h // 2
    min_dim = min(w, h)
    
    mask_radius = (min_dim / 2) * reveal_pct 
    
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    
    # HARD EDGE with Anti-Aliasing (Smoothing)
    feather = 1.0
    
    draw.ellipse(
        (cx - mask_radius, cy - mask_radius, cx + mask_radius, cy + mask_radius),
        fill=255
    )
    
    # Apply minimal blur to smooth pixelation on the mask edge
    mask = mask.filter(ImageFilter.GaussianBlur(radius=feather))
    
    result = Image.composite(img, base_img, mask)
    return result

# --- Main Pipeline ---

# (StepNum, Blur, Reveal, Gray, ColorsRedux, MaxKB, NoisePct, Normalize)
# Max 65KB for steps 1-5, quality 30-77, snap 253.
STEPS_CONFIG: List[Tuple[int, float, float, bool, int, int, float, bool]] = [
    (1, 10.0,  0.00, True, 64, 65,  0.030, True),
    (2,  9.5,  0.05, True, 0, 65,   0.025, True),
    (3,  8.5,  0.08, True, 0, 65,   0.020, True),
    (4,  7.5,  0.11, True, 0, 65,   0.018, True),
    (5,  6.0,  0.13, True, 0, 65,   0.015, True),
    (6,  0.0,  1.00, False, 0, 150, 0.000, False)
]


def build_step_images(master_img: Image.Image, no_compression: bool = False) -> dict[int, bytes]:
    """Render and encode every step image in memory."""
    # Most steps use normalize=True, so the normalized base is calculated once.
    normalized_base: Optional[Image.Image] = None
    if any(s[7] for s in STEPS_CONFIG):
        # Target Mean 238 (very light grey), Std 10.
        normalized_base = normalize_signal(master_img.copy(), target_mean=238.0, target_std=10.0)

    images: dict[int, bytes] = {}
    for step_num, blur, reveal, gray, colors, max_kb, noise, norm in STEPS_CONFIG:
        current_base_override = normalized_base if norm and normalized_base else None

        processed = apply_progressive_reveal(
            master_img,
            blur_px=blur,
            reveal_pct=reveal,
            grayscale=gray,
            noise_intensity=noise,
            normalize=norm,
            base_img_override=current_base_override
        )

        if no_compression:
            img_data = encode_image(processed, quality=95, speed=6, subsampling="4:4:4")
            logger.info(f"  [Step {step_num}] Generated {len(img_data)//1024}KB (High Quality)")
        else:
            if colors > 0:
                processed = reduce_image_complexity(processed, colors=colors, snap_white_threshold=253)

            # Binary search for the highest quality within the size limit
            img_data = choose_quality_for_max_kb(
                processed,
                max_kb=max_kb,
                min_quality=30,
                max_quality=77 if step_num < 6 else 90,
                speed=0  # Speed 0 for maximum compression efficiency
            )
            logger.info(f"  [Step {step_num}] Generated {len(img_data)//1024}KB (Limit {max_kb}KB)")

        images[step_num] = img_data
    return images


def make_r2_io(s3_client: Any, bucket: str) -> dict[str, Any]:
    """I/O callables for publish_asset backed by an S3-compatible client."""

    def put_object(key: str, body: bytes) -> None:
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType=ASSET_CONFIG.content_type,
            CacheControl=ASSET_CONFIG.cache_control,
        )

    def delete_keys(keys: Sequence[str]) -> None:
        for i in range(0, len(keys), DELETE_BATCH_SIZE):
            batch = [{'Key': key} for key in keys[i:i + DELETE_BATCH_SIZE]]
            s3_client.delete_objects(Bucket=bucket, Delete={'Objects': batch})

    def delete_prefix(prefix: str) -> None:
        paginator = s3_client.get_paginator('list_objects_v2')
        keys = [
            obj['Key']
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix)
            for obj in page.get('Contents', [])
        ]
        delete_keys(keys)
        logger.info(f"  Deleted {len(keys)} old files under {prefix}")

    return {'put_object': put_object, 'delete_keys': delete_keys, 'delete_prefix': delete_prefix}


def find_existing_asset_id(supabase: Any, perfume_id: str) -> Optional[str]:
    """Current asset id of a perfume, or None when it has no assets yet."""
    res = (
        supabase.table('perfume_assets')
        .select('asset_random_id')
        .eq('perfume_id', perfume_id)
        .limit(1)
        .execute()
    )
    return res.data[0].get('asset_random_id') if res.data else None


def confirm_overwrite(perfume_id: str, old_asset_id: str, force: bool, skip_existing: bool) -> bool:
    """Decide whether existing assets are replaced (flags first, then an interactive prompt)."""
    if skip_existing:
        logger.info("  Skipping (existing asset + --skip-existing)")
        return False
    if force:
        logger.info("  Replacing (existing asset + --force)")
        return True
    print(f"\n[!] Perfume {perfume_id} already has assets (ID: {old_asset_id}).")
    choice = input("    Replace them with new ones? [y/N]: ").strip().lower()
    if choice != 'y':
        print("    -> Skipped.")
        return False
    return True


def process_file(
    file_path: Path,
    output_dir: Path,
    clients: Optional[dict[str, Any]],
    no_compression: bool = False,
    force: bool = False,
    skip_existing: bool = False
) -> None:
    """Process one illustration; clients is None in local mode."""
    filename = file_path.stem
    if len(filename) != 36:
        logger.info(f"Skipping non-UUID: {filename}")
        return

    logger.info(f"Processing {filename}...")

    old_asset_id: Optional[str] = None
    if clients is not None:
        try:
            old_asset_id = find_existing_asset_id(clients['supabase'], filename)
        except Exception as e:
            logger.error(f"  DB check failed, skipping: {e}")
            return
        if old_asset_id and not confirm_overwrite(filename, old_asset_id, force, skip_existing):
            return

    try:
        master_img = Image.open(file_path).convert("RGB")
        master_img = normalize_to_square_canvas(master_img, target_size=400)
    except Exception as e:
        logger.error(f"Failed to open {file_path}: {e}")
        return

    images = build_step_images(master_img, no_compression=no_compression)

    if clients is None:
        for step_num, img_data in images.items():
            (output_dir / f"{filename}_step{step_num}.avif").write_bytes(img_data)
        return

    def upsert_row(row: Any) -> None:
        clients['supabase'].table('perfume_assets').upsert(dict(row)).execute()

    try:
        result = publish_asset(
            filename,
            images,
            old_asset_id=old_asset_id,
            upsert_row=upsert_row,
            **clients['r2_io'],
        )
    except Exception as e:
        logger.error(f"  Publish failed, previous asset kept: {e}")
        return
    removed = f" (old directory removed: {result.old_prefix_removed})" if old_asset_id else ""
    logger.info(f"  Published asset {result.asset_id}{removed}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--local', action='store_true', help='Generate assets in the debug directory without upload')
    parser.add_argument('--no-compression', action='store_true', help='Disable all optimization/compression (High Quality Debug)')
    parser.add_argument('--force', action='store_true', help='Replace existing assets without asking')
    parser.add_argument('--skip-existing', action='store_true', help='Skip perfumes that already have assets')
    args = parser.parse_args()

    load_env()
    dirs = local_dirs()
    input_dir = dirs.illustrations
    output_dir = dirs.debug_output

    if not input_dir.exists():
        logger.error(f"Input dir not found: {input_dir}")
        return

    files = sorted(list(input_dir.glob('*.png')) + list(input_dir.glob('*.avif')))
    logger.info(f"Found {len(files)} files in {input_dir}")

    clients: Optional[dict[str, Any]] = None
    if args.local:
        logger.info(f"Running in LOCAL MODE. Output: {output_dir}")
        output_dir.mkdir(parents=True, exist_ok=True)
    else:
        clients = {
            'supabase': make_supabase(),
            'r2_io': make_r2_io(make_s3_client(), bucket_name()),
        }

    for f in files:
        process_file(
            f,
            output_dir,
            clients,
            no_compression=args.no_compression,
            force=args.force,
            skip_existing=args.skip_existing
        )


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        logger.critical(f"Process failed: {e}")
        raise SystemExit(1)
