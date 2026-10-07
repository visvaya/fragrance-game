"""Safe publish order for one perfume's game images.

New files are uploaded first, then the database row is switched to them, and only then is the
old asset directory removed. A failure before the switch removes the partial new upload and
leaves the old asset in place, so the game never points at missing files.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass

from asset_keys import STEPS, asset_prefix, new_asset_id, new_step_keys, step_column

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PublishResult:
    perfume_id: str
    asset_id: str
    keys: dict[int, str]
    old_prefix_removed: bool  # False when there was no old asset or its removal failed


def publish_asset(
    perfume_id: str,
    step_images: Mapping[int, bytes],
    *,
    old_asset_id: str | None,
    put_object: Callable[[str, bytes], None],
    delete_keys: Callable[[Sequence[str]], None],
    delete_prefix: Callable[[str], None],
    upsert_row: Callable[[Mapping[str, str]], None],
    new_id: Callable[[], str] = new_asset_id,
    new_keys: Callable[[str], dict[int, str]] = new_step_keys,
) -> PublishResult:
    """Upload six step images under fresh keys, switch the row, then remove the old directory."""
    if set(step_images) != set(STEPS):
        raise ValueError(f"step_images must contain exactly steps {STEPS[0]}..{STEPS[-1]}")

    asset_id = new_id()
    keys = new_keys(asset_id)

    uploaded: list[str] = []
    try:
        for step in STEPS:
            put_object(keys[step], step_images[step])
            uploaded.append(keys[step])
    except Exception:
        logger.error("Upload failed for %s; removing %d partial files", perfume_id, len(uploaded))
        delete_keys(tuple(uploaded))
        raise

    row = {
        "perfume_id": perfume_id,
        "asset_random_id": asset_id,
        **{step_column(step): keys[step] for step in STEPS},
    }
    try:
        upsert_row(row)
    except Exception:
        logger.error("Row write failed for %s; removing the new files", perfume_id)
        delete_keys(tuple(keys[step] for step in STEPS))
        raise

    old_prefix_removed = False
    if old_asset_id and old_asset_id != asset_id:
        try:
            delete_prefix(asset_prefix(old_asset_id))
            old_prefix_removed = True
        except Exception as error:  # the game already uses the new keys
            logger.warning(
                "Could not remove old directory %s: %s", asset_prefix(old_asset_id), error
            )

    return PublishResult(
        perfume_id=perfume_id,
        asset_id=asset_id,
        keys=dict(keys),
        old_prefix_removed=old_prefix_removed,
    )
