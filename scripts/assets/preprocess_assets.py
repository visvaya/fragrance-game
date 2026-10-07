"""Crop each original photo to its object and centre it on a white square canvas."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Optional, Tuple

import numpy as np
try:
    import pillow_avif  # type: ignore  # noqa: F401
except Exception:
    pillow_avif = None  # type: ignore
from PIL import Image, ImageOps

from asset_config import load_env, local_dirs

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif"}


def iter_images(input_dir: Path) -> Iterable[Path]:
    for p in sorted(input_dir.iterdir()):
        if not p.is_file():
            continue
        if p.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        yield p


def _corner_patch_median(data: np.ndarray, x0: int, x1: int, y0: int, y1: int) -> np.ndarray:
    patch = data[y0:y1, x0:x1, :]
    patch = patch.reshape(-1, 3)
    return np.median(patch, axis=0)


def compute_object_bbox(
    img_rgb: Image.Image,
    *,
    corner_patch: int,
    bg_tolerance: int,
    fallback_white_threshold: int,
) -> Optional[Tuple[int, int, int, int]]:
    data = np.asarray(img_rgb)
    h, w, _ = data.shape

    patch = max(1, min(corner_patch, w, h))

    corners = np.stack(
        [
            _corner_patch_median(data, 0, patch, 0, patch),
            _corner_patch_median(data, w - patch, w, 0, patch),
            _corner_patch_median(data, 0, patch, h - patch, h),
            _corner_patch_median(data, w - patch, w, h - patch, h),
        ],
        axis=0,
    )
    bg = np.median(corners, axis=0).astype(np.int16)

    diff = np.abs(data.astype(np.int16) - bg)
    bg_mask = (diff <= bg_tolerance).all(axis=2)
    obj_mask = ~bg_mask

    ys, xs = np.where(obj_mask)
    if ys.size == 0:
        return None

    x0, x1 = int(xs.min()), int(xs.max() + 1)
    y0, y1 = int(ys.min()), int(ys.max() + 1)

    if (x1 - x0) >= int(w * 0.98) and (y1 - y0) >= int(h * 0.98):
        bg_mask = (data[:, :, 0] >= fallback_white_threshold) & (
            data[:, :, 1] >= fallback_white_threshold
        ) & (data[:, :, 2] >= fallback_white_threshold)
        obj_mask = ~bg_mask

        ys, xs = np.where(obj_mask)
        if ys.size == 0:
            return None

        x0, x1 = int(xs.min()), int(xs.max() + 1)
        y0, y1 = int(ys.min()), int(ys.max() + 1)

        if (x1 - x0) >= int(w * 0.98) and (y1 - y0) >= int(h * 0.98):
            return None

    return (x0, y0, x1, y1)


def process_image(
    img: Image.Image,
    *,
    target_size: int,
    padding_percent: float,
    corner_patch: int,
    bg_tolerance: int,
    fallback_white_threshold: int,
    bbox_pad_ratio: float,
) -> Optional[Image.Image]:
    img = ImageOps.exif_transpose(img)

    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img_rgba = img.convert("RGBA")
        white = Image.new("RGBA", img_rgba.size, (255, 255, 255, 255))
        img_rgb = Image.alpha_composite(white, img_rgba).convert("RGB")
    else:
        img_rgb = img.convert("RGB")

    bbox = compute_object_bbox(
        img_rgb,
        corner_patch=corner_patch,
        bg_tolerance=bg_tolerance,
        fallback_white_threshold=fallback_white_threshold,
    )
    if bbox is None:
        return None

    w, h = img_rgb.size
    pad_px = max(2, int(round(min(w, h) * bbox_pad_ratio)))
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad_px)
    y0 = max(0, y0 - pad_px)
    x1 = min(w, x1 + pad_px)
    y1 = min(h, y1 + pad_px)

    obj = img_rgb.crop((x0, y0, x1, y1))

    safe_area_ratio = 1.0 - (2.0 * padding_percent)
    max_object = int(round(target_size * safe_area_ratio))
    max_object_size = (max_object, max_object)

    obj_w, obj_h = obj.size
    if obj_w == 0 or obj_h == 0:
        return None

    scale = min(max_object_size[0] / obj_w, max_object_size[1] / obj_h)
    new_w = max(1, int(round(obj_w * scale)))
    new_h = max(1, int(round(obj_h * scale)))
    obj = obj.resize((new_w, new_h), resample=Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (target_size, target_size), (255, 255, 255))
    paste_x = (target_size - new_w) // 2
    paste_y = (target_size - new_h) // 2
    canvas.paste(obj, (paste_x, paste_y))

    return canvas


def main() -> int:
    load_env()
    dirs = local_dirs()
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(dirs.originals))
    parser.add_argument("--output", default=str(dirs.preprocessed))
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--padding", type=float, default=0.10)
    parser.add_argument("--corner-patch", type=int, default=16)
    parser.add_argument("--bg-tolerance", type=int, default=18)
    parser.add_argument("--fallback-white-threshold", type=int, default=245)
    parser.add_argument("--bbox-pad-ratio", type=float, default=0.005)
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        input_dir.mkdir(parents=True, exist_ok=True)
        print(f"Created folder '{input_dir}'. Put images there and run the script again.")
        return 0

    processed = 0
    skipped = 0

    for path in iter_images(input_dir):
        try:
            with Image.open(path) as img:
                out = process_image(
                    img,
                    target_size=args.size,
                    padding_percent=args.padding,
                    corner_patch=args.corner_patch,
                    bg_tolerance=args.bg_tolerance,
                    fallback_white_threshold=args.fallback_white_threshold,
                    bbox_pad_ratio=args.bbox_pad_ratio,
                )

            if out is None:
                skipped += 1
                print(f"[SKIP] Could not determine bbox: {path.name}")
                continue

            out_path = output_dir / f"{path.stem}.png"
            out.save(out_path, format="PNG")
            processed += 1
            print(f"[OK] {path.name} -> {out_path.name}")

        except Exception as e:
            skipped += 1
            print(f"[ERROR] {path.name}: {e}")

    print(f"--- Done --- OK: {processed}, SKIP/ERR: {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
