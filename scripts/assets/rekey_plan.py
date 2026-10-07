"""Pure planning for moving existing game images to new unguessable keys.

The plan maps every perfume_assets row to a fresh asset id and fresh step keys, lists bucket
objects no row references, renders reviewable SQL for the database swap and its rollback, and
decides which objects are safe to delete once the database uses the new keys.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Collection, Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Final

from asset_config import ASSET_CONFIG
from asset_keys import (
    STEPS,
    is_valid_asset_id,
    is_valid_step_key,
    new_asset_id,
    new_step_keys,
    step_column,
)

PLAN_VERSION: Final[int] = 1
TABLE_NAME: Final[str] = "public.perfume_assets"

_SAFE_VALUE_RE: Final = re.compile(r"[0-9a-z_./-]+")
_UUID_RE: Final = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_OLD_ID_RE: Final = re.compile(r"[0-9a-f]{16,32}")
# Old keys come in two shapes: "<step>_<hex>.avif" and the legacy "<hex>.avif" without a step.
_OLD_KEY_RE: Final = re.compile(
    rf"{re.escape(ASSET_CONFIG.key_prefix)}/[0-9a-f]{{16,32}}/[0-9a-z_]+\.avif"
)
_BUCKET_PREFIX: Final[str] = f"{ASSET_CONFIG.key_prefix}/"


@dataclass(frozen=True)
class AssetRow:
    perfume_id: str
    asset_id: str
    keys: Mapping[int, str]  # steps 1..6


@dataclass(frozen=True)
class RekeyEntry:
    perfume_id: str
    old_asset_id: str
    old_keys: Mapping[int, str]
    new_asset_id: str
    new_keys: Mapping[int, str]


@dataclass(frozen=True)
class RekeyPlan:
    entries: tuple[RekeyEntry, ...]
    orphan_keys: tuple[str, ...]  # bucket keys under "a/" that no row references, sorted


def _frozen(keys: Mapping[int, str]) -> Mapping[int, str]:
    return MappingProxyType({step: keys[step] for step in STEPS})


def _require_safe(value: str, what: str) -> None:
    if not isinstance(value, str) or _SAFE_VALUE_RE.fullmatch(value) is None:
        raise ValueError(f"{what} contains unexpected characters: {value!r}")


def _require_steps(keys: Mapping[int, str], what: str) -> None:
    if set(keys) != set(STEPS):
        raise ValueError(f"{what} must have exactly steps {STEPS[0]}..{STEPS[-1]}")


def _validate_row(row: AssetRow, bucket: frozenset[str]) -> None:
    _require_safe(row.perfume_id, "perfume id")
    _require_safe(row.asset_id, "asset id")
    _require_steps(row.keys, f"row {row.perfume_id}")
    for key in row.keys.values():
        _require_safe(key, "key")
        if key not in bucket:
            raise ValueError(
                f"row {row.perfume_id} references a key missing from the bucket: {key}"
            )


def build_rekey_plan(
    rows: Sequence[AssetRow],
    bucket_keys: Collection[str],
    *,
    new_id: Callable[[], str] = new_asset_id,
    new_keys: Callable[[str], dict[int, str]] = new_step_keys,
) -> RekeyPlan:
    """Assign fresh ids and keys to every row; rows are processed in perfume_id order."""
    bucket = frozenset(bucket_keys)
    asset_ids = [row.asset_id for row in rows]
    if len(set(asset_ids)) != len(asset_ids):
        raise ValueError("two rows share an asset id")
    for row in rows:
        _validate_row(row, bucket)

    entries = []
    for row in sorted(rows, key=lambda r: r.perfume_id):
        fresh_id = new_id()
        fresh_keys = new_keys(fresh_id)
        _require_safe(fresh_id, "new asset id")
        _require_steps(fresh_keys, "new keys")
        for key in fresh_keys.values():
            _require_safe(key, "new key")
        entries.append(
            RekeyEntry(
                perfume_id=row.perfume_id,
                old_asset_id=row.asset_id,
                old_keys=_frozen(row.keys),
                new_asset_id=fresh_id,
                new_keys=_frozen(fresh_keys),
            )
        )

    referenced = {key for row in rows for key in row.keys.values()}
    orphans = tuple(
        sorted(k for k in bucket if k.startswith(_BUCKET_PREFIX) and k not in referenced)
    )
    return RekeyPlan(entries=tuple(entries), orphan_keys=orphans)


def plan_to_json(plan: RekeyPlan) -> str:
    data = {
        "version": PLAN_VERSION,
        "entries": [
            {
                "perfume_id": e.perfume_id,
                "old_asset_id": e.old_asset_id,
                "old_keys": {str(s): e.old_keys[s] for s in STEPS},
                "new_asset_id": e.new_asset_id,
                "new_keys": {str(s): e.new_keys[s] for s in STEPS},
            }
            for e in plan.entries
        ],
        "orphan_keys": list(plan.orphan_keys),
    }
    return json.dumps(data, indent=2) + "\n"


def _parse_keys(raw: Any, what: str) -> dict[int, str]:
    if not isinstance(raw, dict) or set(raw) != {str(s) for s in STEPS}:
        raise ValueError(f"{what} must have exactly steps {STEPS[0]}..{STEPS[-1]}")
    keys = {int(step): value for step, value in raw.items()}
    if not all(isinstance(v, str) for v in keys.values()):
        raise ValueError(f"{what} must be strings")
    return keys


def _parse_entry(raw: Any) -> RekeyEntry:
    if not isinstance(raw, dict):
        raise ValueError("plan entry must be an object")
    perfume_id = raw.get("perfume_id")
    old_id = raw.get("old_asset_id")
    new_id = raw.get("new_asset_id")
    if not isinstance(perfume_id, str) or _UUID_RE.fullmatch(perfume_id) is None:
        raise ValueError(f"invalid perfume id: {perfume_id!r}")
    if not isinstance(old_id, str) or _OLD_ID_RE.fullmatch(old_id) is None:
        raise ValueError(f"invalid old asset id: {old_id!r}")
    if not isinstance(new_id, str) or not is_valid_asset_id(new_id):
        raise ValueError(f"invalid new asset id: {new_id!r}")
    old_keys = _parse_keys(raw.get("old_keys"), "old_keys")
    new_keys = _parse_keys(raw.get("new_keys"), "new_keys")
    if not all(_OLD_KEY_RE.fullmatch(k) for k in old_keys.values()):
        raise ValueError(f"invalid old key in entry {perfume_id}")
    if not all(is_valid_step_key(new_id, k) for k in new_keys.values()):
        raise ValueError(f"invalid new key in entry {perfume_id}")
    return RekeyEntry(
        perfume_id=perfume_id,
        old_asset_id=old_id,
        old_keys=_frozen(old_keys),
        new_asset_id=new_id,
        new_keys=_frozen(new_keys),
    )


def plan_from_json(text: str) -> RekeyPlan:
    """Parse and validate a plan file; any unexpected value raises ValueError."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(f"plan is not valid JSON: {error}") from error
    if not isinstance(data, dict) or data.get("version") != PLAN_VERSION:
        raise ValueError(f"plan must be an object with version {PLAN_VERSION}")
    raw_entries = data.get("entries")
    raw_orphans = data.get("orphan_keys")
    if not isinstance(raw_entries, list) or not isinstance(raw_orphans, list):
        raise ValueError("plan must have entries and orphan_keys lists")
    orphans = tuple(raw_orphans)
    if not all(isinstance(k, str) and k.startswith(_BUCKET_PREFIX) for k in orphans):
        raise ValueError(f"orphan keys must start with {_BUCKET_PREFIX}")
    for key in orphans:
        _require_safe(key, "orphan key")
    return RekeyPlan(entries=tuple(_parse_entry(e) for e in raw_entries), orphan_keys=orphans)


def _sql_literal(value: str) -> str:
    if "'" in value or "\\" in value:
        raise ValueError(f"refusing to render an SQL literal with a quote or backslash: {value!r}")
    _require_safe(value, "SQL literal")
    return f"'{value}'"


def _render_swap(
    plan: RekeyPlan, pick: Callable[[RekeyEntry], tuple[str, Mapping[int, str], str]]
) -> str:
    lines = ["DO $$", "DECLARE", "  n integer;", "  updated integer := 0;", "BEGIN"]
    for entry in plan.entries:
        target_id, target_keys, current_id = pick(entry)
        assignments = ", ".join(
            [f"asset_random_id = {_sql_literal(target_id)}"]
            + [f"{step_column(s)} = {_sql_literal(target_keys[s])}" for s in STEPS]
            + ["updated_at = now()"]
        )
        lines.append(
            f"  UPDATE {TABLE_NAME} SET {assignments} "
            f"WHERE perfume_id = {_sql_literal(entry.perfume_id)} "
            f"AND asset_random_id = {_sql_literal(current_id)};"
        )
        lines.append("  GET DIAGNOSTICS n = ROW_COUNT; updated := updated + n;")
    count = len(plan.entries)
    lines.append(
        f"  IF updated <> {count} THEN RAISE EXCEPTION 'expected % rows, updated %', "
        f"{count}, updated; END IF;"
    )
    lines.append("END")
    lines.append("$$;")
    return "\n".join(lines) + "\n"


def render_apply_sql(plan: RekeyPlan) -> str:
    """One DO block that moves every row to its new keys or fails as a whole."""
    return _render_swap(plan, lambda e: (e.new_asset_id, e.new_keys, e.old_asset_id))


def render_rollback_sql(plan: RekeyPlan) -> str:
    """One DO block that moves every row back to its old keys or fails as a whole."""
    return _render_swap(plan, lambda e: (e.old_asset_id, e.old_keys, e.new_asset_id))


def select_deletions(
    plan: RekeyPlan, current_db_keys: Collection[str], bucket_keys: Collection[str]
) -> tuple[str, ...]:
    """Old and orphaned keys that still exist and that the database no longer references."""
    current = frozenset(current_db_keys)
    if not all(k in current for e in plan.entries for k in e.new_keys.values()):
        raise ValueError("database does not reference the new keys yet")
    candidates = {k for e in plan.entries for k in e.old_keys.values()} | set(plan.orphan_keys)
    return tuple(sorted((candidates & frozenset(bucket_keys)) - current))


def needs_copy(old_etag: str | None, new_etag: str | None) -> bool:
    """A copy is needed unless the new object already exists with the old object's ETag."""
    return new_etag is None or new_etag != old_etag


def merge_purge_list(existing: Sequence[str], new: Sequence[str]) -> tuple[str, ...]:
    """Union of purge-list URLs already recorded and new ones, deduplicated and sorted."""
    return tuple(sorted({u for u in (*existing, *new) if u}))
