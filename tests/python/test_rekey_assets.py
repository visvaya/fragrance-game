"""Rekey commands that need no real R2 or network: backup manifest and verify."""

import argparse
import hashlib
import importlib
import json
import os
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts/assets"))

rekey_assets = importlib.import_module("rekey_assets")
rekey_plan = importlib.import_module("rekey_plan")

P1 = "1b63a04b-b494-4550-bc1e-269dd0f33a7e"
OLD_ID = "1" * 16
NEW_ID = "a" * 32
OLD_KEYS = {s: f"a/{OLD_ID}/{s}_abc{s}.avif" for s in range(1, 7)}
NEW_KEYS = {s: f"a/{NEW_ID}/{str(s) * 32}.avif" for s in range(1, 7)}


class FakeBody:
    def __init__(self, data: bytes) -> None:
        self.data = data

    def read(self) -> bytes:
        return self.data


class FakeS3:
    def __init__(self, objects: dict[str, bytes], fail_on: str | None = None) -> None:
        self.objects = objects
        self.fail_on = fail_on

    def get_paginator(self, name: str) -> Any:
        keys = list(self.objects)

        class Paginator:
            def paginate(self, Bucket: str, Prefix: str) -> list[dict[str, Any]]:
                return [{"Contents": [{"Key": k} for k in keys]}]

        return Paginator()

    def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
        if Key == self.fail_on:
            raise OSError("connection reset")
        return {"Body": FakeBody(self.objects[Key])}


def _patch_s3(monkeypatch: pytest.MonkeyPatch, s3: FakeS3) -> None:
    monkeypatch.setattr(rekey_assets, "make_s3_client", lambda: s3)
    monkeypatch.setattr(rekey_assets, "bucket_name", lambda: "bucket")


def test_backup_manifest_survives_a_crash(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _patch_s3(monkeypatch, FakeS3({"a/x/1.avif": b"one", "a/x/2.avif": b"two"}, "a/x/2.avif"))
    with pytest.raises(OSError):
        rekey_assets.cmd_backup(argparse.Namespace(out=str(tmp_path / "backup")))
    manifest = json.loads(
        (tmp_path / "backup" / "manifest.partial.json").read_text(encoding="utf-8")
    )
    assert manifest == {"a/x/1.avif": {"sha256": hashlib.sha256(b"one").hexdigest(), "size": 3}}
    assert not (tmp_path / "backup" / "manifest.json").exists()


def _plan_file(tmp_path: Path) -> Path:
    plan = rekey_plan.RekeyPlan(
        entries=(rekey_plan.RekeyEntry(P1, OLD_ID, OLD_KEYS, NEW_ID, NEW_KEYS),),
        orphan_keys=(),
    )
    path = tmp_path / "plan.json"
    path.write_text(rekey_plan.plan_to_json(plan), encoding="utf-8")
    return path


def _serve(
    monkeypatch: pytest.MonkeyPatch, bodies: dict[str, bytes], fail: type[Exception] | None = None
) -> None:
    headers = {"content-type": "image/avif", "cache-control": "public, immutable"}

    def fake_fetch(host: str, key: str) -> tuple[int, bytes, dict[str, str]]:
        if fail:
            raise fail("no route")
        return 200, bodies[key], headers

    monkeypatch.setattr(rekey_assets, "assets_host", lambda: "host")
    monkeypatch.setattr(rekey_assets, "_fetch", fake_fetch)


def _bodies(new: bytes = b"same") -> dict[str, bytes]:
    return {**{k: b"same" for k in OLD_KEYS.values()}, **{k: new for k in NEW_KEYS.values()}}


def _backup_dir(tmp_path: Path, data: bytes) -> Path:
    backup = tmp_path / "backup"
    backup.mkdir()
    manifest = {
        k: {"sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}
        for k in OLD_KEYS.values()
    }
    (backup / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return backup


def test_verify_passes_when_new_objects_match_old_and_the_backup(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _serve(monkeypatch, _bodies())
    args = argparse.Namespace(
        plan=str(_plan_file(tmp_path)), backup=str(_backup_dir(tmp_path, b"same"))
    )
    assert rekey_assets.cmd_verify(args) == 0


def test_verify_fails_when_the_backup_differs(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _serve(monkeypatch, _bodies())
    args = argparse.Namespace(
        plan=str(_plan_file(tmp_path)), backup=str(_backup_dir(tmp_path, b"other"))
    )
    assert rekey_assets.cmd_verify(args) == 1
    assert "differs from the backup" in capsys.readouterr().out


def test_verify_turns_a_network_error_into_a_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _serve(monkeypatch, {}, fail=OSError)
    args = argparse.Namespace(plan=str(_plan_file(tmp_path)), backup=None)
    assert rekey_assets.cmd_verify(args) == 1
    assert "network error: no route" in capsys.readouterr().out


def _rows(keys: dict[int, str], asset_id: str) -> list[dict[str, str]]:
    row = {"perfume_id": P1, "asset_random_id": asset_id}
    return [{**row, **{f"image_key_step_{s}": k for s, k in keys.items()}}]


class FakeSupabase:
    def __init__(self, rows: list[dict[str, str]]) -> None:
        self.rows = rows

    def table(self, name: str) -> "FakeSupabase":
        return self

    def select(self, columns: str) -> "FakeSupabase":
        return self

    def limit(self, count: int) -> "FakeSupabase":
        return self

    def execute(self) -> Any:
        return type("Response", (), {"data": self.rows})()


def test_plan_writes_a_plan_for_every_row(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _patch_s3(monkeypatch, FakeS3({k: b"x" for k in OLD_KEYS.values()}))
    monkeypatch.setattr(
        rekey_assets, "make_supabase", lambda: FakeSupabase(_rows(OLD_KEYS, OLD_ID))
    )
    out = tmp_path / "plans" / "plan.json"
    assert rekey_assets.main(["plan", "--out", str(out)]) == 0
    plan = rekey_plan.plan_from_json(out.read_text(encoding="utf-8"))
    assert [e.perfume_id for e in plan.entries] == [P1]
    assert "Entries: 1" in capsys.readouterr().out


def test_fetching_rows_stops_at_the_row_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    rows = _rows(OLD_KEYS, OLD_ID) * rekey_assets.REKEY_CONFIG.row_limit
    monkeypatch.setattr(rekey_assets, "make_supabase", lambda: FakeSupabase(rows))
    with pytest.raises(RuntimeError, match="row limit"):
        rekey_assets._fetch_rows()


class CopyS3:
    def __init__(self, existing: dict[str, str]) -> None:
        self.etags = existing
        self.copied: list[str] = []

    def head_object(self, Bucket: str, Key: str) -> dict[str, str]:
        from botocore.exceptions import ClientError

        if Key not in self.etags:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        return {"ETag": self.etags[Key]}

    def copy_object(self, **kwargs: Any) -> None:
        self.copied.append(kwargs["Key"])
        self.etags[kwargs["Key"]] = self.etags[kwargs["CopySource"]["Key"]]


def test_copy_is_a_dry_run_unless_executed(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    s3 = CopyS3({k: "e" for k in OLD_KEYS.values()})
    _patch_s3(monkeypatch, s3)  # type: ignore[arg-type]
    plan = str(_plan_file(tmp_path))
    assert rekey_assets.main(["copy", "--plan", plan]) == 0
    assert s3.copied == []
    assert "Dry run: 6 copies" in capsys.readouterr().out
    assert rekey_assets.main(["copy", "--plan", plan, "--execute"]) == 0
    assert sorted(s3.copied) == sorted(NEW_KEYS.values())
    assert rekey_assets.main(["copy", "--plan", plan, "--execute"]) == 0
    assert len(s3.copied) == 6  # the second run skips objects that already match


def test_etag_failures_other_than_not_found_are_raised() -> None:
    from botocore.exceptions import ClientError

    class Denied:
        def head_object(self, Bucket: str, Key: str) -> dict[str, str]:
            raise ClientError({"Error": {"Code": "403"}}, "HeadObject")

    with pytest.raises(ClientError):
        rekey_assets._etag(Denied(), "bucket", "a/x")


def test_sql_writes_apply_and_rollback_files(tmp_path: Path) -> None:
    out = tmp_path / "sql"
    assert rekey_assets.main(["sql", "--plan", str(_plan_file(tmp_path)), "--out", str(out)]) == 0
    assert "UPDATE public.perfume_assets" in (out / "apply.sql").read_text(encoding="utf-8")
    assert (out / "rollback.sql").exists()


def test_cleanup_deletes_old_keys_and_records_a_purge_list(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    objects = {k: b"x" for k in [*OLD_KEYS.values(), *NEW_KEYS.values()]}
    _patch_s3(monkeypatch, FakeS3(objects))
    monkeypatch.setattr(
        rekey_assets, "make_supabase", lambda: FakeSupabase(_rows(NEW_KEYS, NEW_ID))
    )
    monkeypatch.setattr(rekey_assets, "assets_host", lambda: "host")
    deleted: list[str] = []
    monkeypatch.setattr(
        rekey_assets, "make_r2_io", lambda s3, bucket: {"delete_keys": deleted.extend}
    )
    plan = str(_plan_file(tmp_path))
    assert rekey_assets.main(["cleanup", "--plan", plan]) == 0
    assert deleted == []
    assert "Dry run: 6 objects" in capsys.readouterr().out
    assert rekey_assets.main(["cleanup", "--plan", plan, "--execute"]) == 0
    assert sorted(deleted) == sorted(OLD_KEYS.values())
    purge = (tmp_path / rekey_assets.REKEY_CONFIG.purge_list_name).read_text(encoding="utf-8")
    assert purge.count("https://host/a/") == 6
    assert "Deleted 6 objects" in capsys.readouterr().out


def test_fetch_reads_a_body_and_drops_the_body_of_an_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Response:
        def __init__(self, status: int) -> None:
            self.status = status

        def read(self) -> bytes:
            return b"body"

        def getheaders(self) -> list[tuple[str, str]]:
            return [("Content-Type", "image/avif")]

    def connection(status: int) -> Any:
        class Connection:
            def __init__(self, *_args: Any, **_kwargs: Any) -> None:
                pass

            def request(self, method: str, path: str, headers: dict[str, str]) -> None:
                pass

            def getresponse(self) -> Response:
                return Response(status)

            def close(self) -> None:
                pass

        return Connection

    monkeypatch.setattr(rekey_assets.http.client, "HTTPSConnection", connection(200))
    assert rekey_assets._fetch("host", "a/x") == (200, b"body", {"content-type": "image/avif"})
    monkeypatch.setattr(rekey_assets.http.client, "HTTPSConnection", connection(404))
    assert rekey_assets._fetch("host", "a/x") == (404, b"", {})


def test_backup_refuses_a_non_empty_directory(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / "keep").write_text("x", encoding="utf-8")
    assert rekey_assets.cmd_backup(argparse.Namespace(out=str(tmp_path))) == 1


def test_backup_rejects_a_key_that_escapes_the_directory() -> None:
    with pytest.raises(ValueError, match="unexpected key"):
        rekey_assets._safe_local_path(Path("out"), "a/../../evil")
