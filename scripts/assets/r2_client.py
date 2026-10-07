"""Clients for the image pipeline: R2 (S3 API) and Supabase, configured from .env.local."""

from __future__ import annotations

import os
from typing import Any, Final

from asset_config import load_env

DEFAULT_BUCKET_NAME: Final[str] = "fragrance-game"
DEFAULT_ASSETS_HOST: Final[str] = "pub-2c37ff9f03ea40878492e7f72ef83fe3.r2.dev"


def _require(names: tuple[str, ...]) -> dict[str, str]:
    values = {name: os.environ.get(name, "").strip() for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"Missing environment variables: {', '.join(missing)}")
    return values


def make_s3_client() -> Any:
    """Return a boto3 S3 client pointed at the R2 endpoint."""
    load_env()
    env = _require(("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"))
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=env["R2_ENDPOINT_URL"],
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
    )


def bucket_name() -> str:
    """R2 bucket that holds the game images."""
    load_env()
    return os.environ.get("R2_BUCKET_NAME", "").strip() or DEFAULT_BUCKET_NAME


def make_supabase() -> Any:
    """Return a Supabase client with the service role key (server-side scripts only)."""
    load_env()
    env = _require(("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"))
    from supabase import create_client

    return create_client(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])


def assets_host() -> str:
    """Public host that serves the bucket; an empty value counts as unset."""
    load_env()
    return os.environ.get("NEXT_PUBLIC_ASSETS_HOST", "").strip() or DEFAULT_ASSETS_HOST
