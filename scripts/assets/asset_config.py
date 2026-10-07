"""Configuration of the game image pipeline: key format, HTTP headers, local directories."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Final

WEBAPP_ROOT: Final[Path] = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class AssetConfig:
    key_prefix: str
    asset_id_bytes: int
    step_name_bytes: int
    file_suffix: str
    content_type: str
    cache_max_age_seconds: int

    @property
    def cache_control(self) -> str:
        # Keys never change content, so browsers and CDNs may keep files for a year.
        return f"public, max-age={self.cache_max_age_seconds}, immutable"


ASSET_CONFIG: Final[AssetConfig] = AssetConfig(
    key_prefix="a",
    asset_id_bytes=16,
    step_name_bytes=16,
    file_suffix=".avif",
    content_type="image/avif",
    cache_max_age_seconds=31_536_000,
)


@dataclass(frozen=True)
class LocalDirs:
    originals: Path
    preprocessed: Path
    illustrations: Path
    debug_output: Path


_DIR_DEFAULTS: Final[dict[str, str]] = {
    "ASSET_ORIGINALS_DIR": "img/bottles/1original_photos",
    "ASSET_PREPROCESSED_DIR": "img/bottles/2preprocessed_photos",
    "ASSET_ILLUSTRATIONS_DIR": "img/bottles/3illustrations",
    "ASSET_DEBUG_DIR": "img/bottles/4app_assets_debug",
}


def _resolve_dir(env_name: str) -> Path:
    raw = os.environ.get(env_name, "").strip() or _DIR_DEFAULTS[env_name]
    path = Path(raw)
    return path if path.is_absolute() else WEBAPP_ROOT / path


def load_env() -> None:
    """Load fragrance-webapp/.env.local into the process environment when it exists."""
    from dotenv import load_dotenv  # imported lazily so pure tests need no third-party packages

    env_file = WEBAPP_ROOT / ".env.local"
    if env_file.exists():
        load_dotenv(env_file, override=False)


def local_dirs() -> LocalDirs:
    """Local pipeline directories; each can be overridden in .env.local."""
    return LocalDirs(
        originals=_resolve_dir("ASSET_ORIGINALS_DIR"),
        preprocessed=_resolve_dir("ASSET_PREPROCESSED_DIR"),
        illustrations=_resolve_dir("ASSET_ILLUSTRATIONS_DIR"),
        debug_output=_resolve_dir("ASSET_DEBUG_DIR"),
    )
