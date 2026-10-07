import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts/assets"))

from asset_publish import publish_asset  # noqa: E402

PERFUME = "c2614cda-f6a4-4fba-9d8a-1d9734f8cc97"
NEW_ID = "1" * 32
OLD_ID = "0" * 16
IMAGES = {step: bytes([step]) for step in range(1, 7)}


def fake_keys(asset_id):
    return {step: f"a/{asset_id}/{str(step) * 32}.avif" for step in range(1, 7)}


def make_io(fail_put_at=None, fail_upsert=False, fail_delete_prefix=False):
    calls = []

    def put_object(key, body):
        if fail_put_at is not None and len([c for c in calls if c[0] == "put"]) == fail_put_at:
            raise OSError("upload failed")
        calls.append(("put", key))

    def delete_keys(keys):
        calls.append(("delete_keys", tuple(keys)))

    def delete_prefix(prefix):
        if fail_delete_prefix:
            raise OSError("delete failed")
        calls.append(("delete_prefix", prefix))

    def upsert_row(row):
        if fail_upsert:
            raise RuntimeError("db down")
        calls.append(("upsert", dict(row)))

    io = dict(put_object=put_object, delete_keys=delete_keys, delete_prefix=delete_prefix,
              upsert_row=upsert_row, new_id=lambda: NEW_ID, new_keys=fake_keys)
    return calls, io


def test_uploads_then_writes_row_then_removes_old_directory():
    calls, io = make_io()
    result = publish_asset(PERFUME, IMAGES, old_asset_id=OLD_ID, **io)
    kinds = [c[0] for c in calls]
    assert kinds == ["put"] * 6 + ["upsert", "delete_prefix"]
    assert calls[-1] == ("delete_prefix", f"a/{OLD_ID}/")
    row = calls[6][1]
    assert row["asset_random_id"] == NEW_ID
    assert row["image_key_step_6"] == fake_keys(NEW_ID)[6]
    assert result.old_prefix_removed is True


def test_failed_upload_removes_partial_files_and_keeps_old_asset():
    calls, io = make_io(fail_put_at=3)
    with pytest.raises(OSError):
        publish_asset(PERFUME, IMAGES, old_asset_id=OLD_ID, **io)
    assert ("delete_keys", tuple(fake_keys(NEW_ID)[s] for s in (1, 2, 3))) in calls
    assert not any(c[0] in ("upsert", "delete_prefix") for c in calls)


def test_failed_row_write_removes_new_files_and_keeps_old_asset():
    calls, io = make_io(fail_upsert=True)
    with pytest.raises(RuntimeError):
        publish_asset(PERFUME, IMAGES, old_asset_id=OLD_ID, **io)
    assert calls[-1] == ("delete_keys", tuple(fake_keys(NEW_ID).values()))
    assert not any(c[0] == "delete_prefix" for c in calls)


def test_failed_old_directory_removal_is_reported_not_raised():
    _, io = make_io(fail_delete_prefix=True)
    result = publish_asset(PERFUME, IMAGES, old_asset_id=OLD_ID, **io)
    assert result.old_prefix_removed is False


def test_new_asset_without_old_directory():
    calls, io = make_io()
    result = publish_asset(PERFUME, IMAGES, old_asset_id=None, **io)
    assert not any(c[0] == "delete_prefix" for c in calls)
    assert result.old_prefix_removed is False


def test_rejects_incomplete_step_set():
    _, io = make_io()
    with pytest.raises(ValueError):
        publish_asset(PERFUME, {1: b"x"}, old_asset_id=None, **io)
