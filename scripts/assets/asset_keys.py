"""Object keys for game images.

Every perfume asset has its own directory with a 128-bit random id, and every step file has its
own 128-bit random name, so knowing one step's URL reveals nothing about the others.
"""

from __future__ import annotations

import re
import secrets
from collections.abc import Callable
from typing import Final

from asset_config import ASSET_CONFIG

TokenHex = Callable[[int], str]

STEPS: Final[tuple[int, ...]] = (1, 2, 3, 4, 5, 6)

_ASSET_ID_RE: Final = re.compile(rf"[0-9a-f]{{{ASSET_CONFIG.asset_id_bytes * 2}}}")
_STEP_NAME_PATTERN: Final = rf"[0-9a-f]{{{ASSET_CONFIG.step_name_bytes * 2}}}"


def is_valid_asset_id(value: str) -> bool:
    return _ASSET_ID_RE.fullmatch(value) is not None


def asset_prefix(asset_id: str) -> str:
    return f"{ASSET_CONFIG.key_prefix}/{asset_id}/"


def step_column(step: int) -> str:
    return f"image_key_step_{step}"


def is_valid_step_key(asset_id: str, key: str) -> bool:
    if not is_valid_asset_id(asset_id):
        return False
    pattern = (
        re.escape(asset_prefix(asset_id)) + _STEP_NAME_PATTERN + re.escape(ASSET_CONFIG.file_suffix)
    )
    return re.fullmatch(pattern, key) is not None


def new_asset_id(token_hex: TokenHex = secrets.token_hex) -> str:
    asset_id = token_hex(ASSET_CONFIG.asset_id_bytes)
    if not is_valid_asset_id(asset_id):
        raise ValueError("token source returned an invalid asset id")
    return asset_id


def new_step_keys(asset_id: str, token_hex: TokenHex = secrets.token_hex) -> dict[int, str]:
    if not is_valid_asset_id(asset_id):
        raise ValueError("invalid asset id")
    keys = {
        step: f"{asset_prefix(asset_id)}{token_hex(ASSET_CONFIG.step_name_bytes)}"
        f"{ASSET_CONFIG.file_suffix}"
        for step in STEPS
    }
    if len(set(keys.values())) != len(STEPS):
        raise ValueError("step keys collided")
    if not all(is_valid_step_key(asset_id, key) for key in keys.values()):
        raise ValueError("token source returned an invalid step name")
    return keys
