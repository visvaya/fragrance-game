import os
import sys

import numpy as np
from PIL import Image

sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts/assets"))

from preprocess_assets import compute_object_bbox  # noqa: E402

KWARGS = {"corner_patch": 2, "bg_tolerance": 10, "fallback_white_threshold": 245}


def _image(
    fill: tuple[int, int, int], box: tuple[int, int, int, int], color: tuple[int, int, int]
) -> Image.Image:
    data = np.full((40, 40, 3), fill, dtype=np.uint8)
    x0, y0, x1, y1 = box
    data[y0:y1, x0:x1] = color
    return Image.fromarray(data)


def test_bbox_of_an_object_on_a_plain_background() -> None:
    img = _image((255, 255, 255), (10, 5, 30, 20), (0, 0, 0))
    assert compute_object_bbox(img, **KWARGS) == (10, 5, 30, 20)


def test_no_bbox_for_an_empty_background() -> None:
    assert compute_object_bbox(_image((255, 255, 255), (0, 0, 0, 0), (0, 0, 0)), **KWARGS) is None


def test_fallback_to_white_threshold_when_corners_are_inside_the_object() -> None:
    # Dark corners count as background, so the object spans the frame; white threshold decides.
    data = np.zeros((40, 40, 3), dtype=np.uint8)
    data[10:20, 10:30] = 255
    assert compute_object_bbox(Image.fromarray(data), **KWARGS) == (10, 10, 30, 20)


def test_no_bbox_when_the_fallback_also_spans_the_frame() -> None:
    data = np.zeros((40, 40, 3), dtype=np.uint8)
    data[0:40, 0:40] = 255
    data[0:2, 0:2] = 0
    data[0:2, 38:40] = 0
    data[38:40, 0:2] = 0
    data[38:40, 38:40] = 0
    assert compute_object_bbox(Image.fromarray(data), **KWARGS) is None
