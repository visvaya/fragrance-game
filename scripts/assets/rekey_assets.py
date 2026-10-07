"""Move existing game images to new unguessable keys.

Rollout order: backup, plan, copy, verify, sql (the swap is applied by hand), cleanup.
Mutating commands (copy, cleanup) are dry runs unless --execute is given. Output lists counts
and keys only, never credentials.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

from asset_config import ASSET_CONFIG
from asset_keys import STEPS, step_column
from r2_client import assets_host, bucket_name, make_r2_io, make_s3_client, make_supabase
from rekey_plan import (
    AssetRow,
    RekeyPlan,
    build_rekey_plan,
    needs_copy,
    plan_from_json,
    plan_to_json,
    render_apply_sql,
    render_rollback_sql,
    select_deletions,
)


@dataclass(frozen=True)
class RekeyConfig:
    list_prefix: str
    row_limit: int
    http_timeout_seconds: int
    user_agent: str
    purge_list_name: str


REKEY_CONFIG: Final[RekeyConfig] = RekeyConfig(
    list_prefix=f"{ASSET_CONFIG.key_prefix}/",
    row_limit=1000,
    http_timeout_seconds=15,
    user_agent="asset-rekey/1.0",
    purge_list_name="purged-sources.txt",
)

_ASSET_COLUMNS: Final[str] = ", ".join(
    ["perfume_id", "asset_random_id", *(step_column(s) for s in STEPS)]
)


def _list_bucket(s3: Any, bucket: str) -> list[str]:
    paginator = s3.get_paginator("list_objects_v2")
    return [
        obj["Key"]
        for page in paginator.paginate(Bucket=bucket, Prefix=REKEY_CONFIG.list_prefix)
        for obj in page.get("Contents", [])
    ]


def _fetch_rows() -> list[dict[str, Any]]:
    response = (
        make_supabase()
        .table("perfume_assets")
        .select(_ASSET_COLUMNS)
        .limit(REKEY_CONFIG.row_limit)
        .execute()
    )
    rows = list(response.data or [])
    if len(rows) >= REKEY_CONFIG.row_limit:
        raise RuntimeError(f"row limit {REKEY_CONFIG.row_limit} reached; raise it before planning")
    return rows


def _to_asset_row(raw: dict[str, Any]) -> AssetRow:
    return AssetRow(
        perfume_id=str(raw["perfume_id"]),
        asset_id=str(raw["asset_random_id"]),
        keys={s: raw[step_column(s)] for s in STEPS if raw.get(step_column(s))},
    )


def _db_keys(rows: Sequence[dict[str, Any]]) -> set[str]:
    return {raw[step_column(s)] for raw in rows for s in STEPS if raw.get(step_column(s))}


def _read_plan(path: str) -> RekeyPlan:
    return plan_from_json(Path(path).read_text(encoding="utf-8"))


def _pairs(plan: RekeyPlan) -> list[tuple[str, str]]:
    return [(e.old_keys[s], e.new_keys[s]) for e in plan.entries for s in STEPS]


def _safe_local_path(root: Path, key: str) -> Path:
    if key.startswith("/") or ".." in key.split("/") or "\\" in key:
        raise ValueError(f"refusing to write unexpected key: {key!r}")
    return root / key


def cmd_backup(args: argparse.Namespace) -> int:
    out = Path(args.out)
    if out.exists() and any(out.iterdir()):
        print(f"Refusing to back up into a non-empty directory: {out}", file=sys.stderr)
        return 1
    s3, bucket = make_s3_client(), bucket_name()
    manifest: dict[str, dict[str, Any]] = {}
    for key in _list_bucket(s3, bucket):
        body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
        target = _safe_local_path(out, key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        entry = {"sha256": hashlib.sha256(body).hexdigest(), "size": len(body)}
        manifest = {**manifest, key: entry}
        print(f"saved {key} ({len(body)} bytes)")
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Backed up {len(manifest)} objects to {out}")
    return 0


def cmd_plan(args: argparse.Namespace) -> int:
    rows = [_to_asset_row(raw) for raw in _fetch_rows()]
    bucket_keys = _list_bucket(make_s3_client(), bucket_name())
    plan = build_rekey_plan(rows, bucket_keys)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(plan_to_json(plan), encoding="utf-8")
    for e in plan.entries:
        print(f"{e.perfume_id}: {e.old_asset_id} -> {e.new_asset_id}")
    print(
        f"Entries: {len(plan.entries)}, orphan objects: {len(plan.orphan_keys)}, "
        f"objects under {REKEY_CONFIG.list_prefix}: {len(bucket_keys)}"
    )
    print(f"Plan written to {out}")
    return 0


def _etag(s3: Any, bucket: str, key: str) -> str | None:
    from botocore.exceptions import ClientError

    try:
        return str(s3.head_object(Bucket=bucket, Key=key)["ETag"])
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            return None
        raise


def cmd_copy(args: argparse.Namespace) -> int:
    pairs = _pairs(_read_plan(args.plan))
    if not args.execute:
        for old, new in pairs:
            print(f"would copy {old} -> {new}")
        print(f"Dry run: {len(pairs)} copies; pass --execute to copy")
        return 0
    s3, bucket = make_s3_client(), bucket_name()
    copied = skipped = 0
    for old, new in pairs:
        if not needs_copy(_etag(s3, bucket, old), _etag(s3, bucket, new)):
            skipped += 1
            print(f"skip {new} (already copied)")
            continue
        s3.copy_object(
            Bucket=bucket,
            Key=new,
            CopySource={"Bucket": bucket, "Key": old},
            MetadataDirective="REPLACE",
            ContentType=ASSET_CONFIG.content_type,
            CacheControl=ASSET_CONFIG.cache_control,
        )
        copied += 1
        print(f"copied {old} -> {new}")
    print(f"Copied {copied}, skipped {skipped}")
    return 0


def _fetch(url: str) -> tuple[int, bytes, dict[str, str]]:
    request = urllib.request.Request(url, headers={"User-Agent": REKEY_CONFIG.user_agent})
    try:
        with urllib.request.urlopen(request, timeout=REKEY_CONFIG.http_timeout_seconds) as resp:
            return resp.status, resp.read(), {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as error:
        return error.code, b"", {}


def _check_pair(host: str, old: str, new: str) -> list[str]:
    old_status, old_body, _ = _fetch(f"https://{host}/{old}")
    new_status, new_body, new_headers = _fetch(f"https://{host}/{new}")
    problems = []
    if old_status != 200:
        problems.append(f"old status {old_status}")
    if new_status != 200:
        problems.append(f"new status {new_status}")
    if hashlib.sha256(old_body).digest() != hashlib.sha256(new_body).digest():
        problems.append("content differs")
    if new_headers.get("content-type") != ASSET_CONFIG.content_type:
        problems.append(f"content-type {new_headers.get('content-type')}")
    if "immutable" not in new_headers.get("cache-control", ""):
        problems.append(f"cache-control {new_headers.get('cache-control')}")
    return problems


def cmd_verify(args: argparse.Namespace) -> int:
    host = assets_host()
    failures = 0
    for old, new in _pairs(_read_plan(args.plan)):
        problems = _check_pair(host, old, new)
        failures += bool(problems)
        detail = f": {', '.join(problems)}" if problems else ""
        print(f"{'FAIL' if problems else 'ok'} {old} -> {new}{detail}")
    print(f"Mismatched pairs: {failures}")
    return 1 if failures else 0


def cmd_sql(args: argparse.Namespace) -> int:
    plan = _read_plan(args.plan)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "apply.sql").write_text(render_apply_sql(plan), encoding="utf-8")
    (out / "rollback.sql").write_text(render_rollback_sql(plan), encoding="utf-8")
    print(f"Wrote apply.sql and rollback.sql for {len(plan.entries)} rows to {out}")
    return 0


def cmd_cleanup(args: argparse.Namespace) -> int:
    plan = _read_plan(args.plan)
    current = _db_keys(_fetch_rows())
    s3, bucket = make_s3_client(), bucket_name()
    deletions = select_deletions(plan, current, _list_bucket(s3, bucket))
    for key in deletions:
        print(f"{'delete' if args.execute else 'would delete'} {key}")
    if not args.execute:
        print(f"Dry run: {len(deletions)} objects; pass --execute to delete")
        return 0
    make_r2_io(s3, bucket)["delete_keys"](deletions)
    host = assets_host()
    purge_list = Path(args.plan).resolve().parent / REKEY_CONFIG.purge_list_name
    purge_list.write_text("".join(f"https://{host}/{k}\n" for k in deletions), encoding="utf-8")
    print(f"Deleted {len(deletions)} objects; purge list written to {purge_list}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Move existing game images to new keys.")
    sub = parser.add_subparsers(dest="command", required=True)

    backup = sub.add_parser("backup", help="download every object under a/ with a manifest")
    backup.add_argument("--out", required=True, help="empty directory for the backup")
    backup.set_defaults(func=cmd_backup)

    plan = sub.add_parser("plan", help="assign new keys to every row and list orphans")
    plan.add_argument("--out", required=True, help="plan JSON file to write")
    plan.set_defaults(func=cmd_plan)

    copy = sub.add_parser("copy", help="copy objects to their new keys (dry run by default)")
    copy.add_argument("--plan", required=True)
    copy.add_argument("--execute", action="store_true", help="perform the copies")
    copy.set_defaults(func=cmd_copy)

    verify = sub.add_parser("verify", help="compare old and new objects over HTTPS")
    verify.add_argument("--plan", required=True)
    verify.set_defaults(func=cmd_verify)

    sql = sub.add_parser("sql", help="write apply.sql and rollback.sql for the database swap")
    sql.add_argument("--plan", required=True)
    sql.add_argument("--out", required=True, help="directory for the SQL files")
    sql.set_defaults(func=cmd_sql)

    cleanup = sub.add_parser("cleanup", help="delete old and orphaned objects (dry run by default)")
    cleanup.add_argument("--plan", required=True)
    cleanup.add_argument("--execute", action="store_true", help="perform the deletions")
    cleanup.set_defaults(func=cmd_cleanup)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
