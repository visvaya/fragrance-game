"""Clients for the image pipeline: R2 (S3 API) and Supabase, configured from .env.local."""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping, Sequence
from typing import Any, Final

from asset_config import ASSET_CONFIG, load_env

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


DELETE_BATCH_SIZE: Final[int] = 1000  # S3 DeleteObjects accepts at most 1000 keys per request


def raise_on_delete_errors(response: Mapping[str, Any]) -> None:
    """DeleteObjects reports per-key failures in the response instead of raising; raise them."""
    errors = response.get("Errors") or []
    if errors:
        details = ", ".join(f"{e.get('Key')} ({e.get('Code')})" for e in errors)
        raise RuntimeError(f"{len(errors)} objects could not be deleted: {details}")


def make_r2_io(s3_client: Any, bucket: str) -> dict[str, Callable[..., None]]:
    """I/O callables for asset_publish.publish_asset backed by an S3-compatible client."""

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
            batch = [{"Key": key} for key in keys[i : i + DELETE_BATCH_SIZE]]
            raise_on_delete_errors(
                s3_client.delete_objects(Bucket=bucket, Delete={"Objects": batch})
            )

    def delete_prefix(prefix: str) -> None:
        paginator = s3_client.get_paginator("list_objects_v2")
        keys = [
            obj["Key"]
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix)
            for obj in page.get("Contents", [])
        ]
        delete_keys(keys)

    return {"put_object": put_object, "delete_keys": delete_keys, "delete_prefix": delete_prefix}
