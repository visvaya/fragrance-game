"""generate_asset_list.main: the CSV that tells which perfumes still need an image."""

import csv
import importlib
import os
import sys
from pathlib import Path
from typing import Any

import pytest

os.environ.setdefault("SUPABASE_URL", "http://mock")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "mock")
sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts/assets"))

gal = importlib.import_module("generate_asset_list")

HAVE_BOTH = "11111111-1111-1111-1111-111111111111"
ONLY_FILE = "22222222-2222-2222-2222-222222222222"
NEITHER = "33333333-3333-3333-3333-333333333333"


class Query:
    """Returns the rows of one table; paging arguments are accepted and ignored."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def select(self, columns: str) -> "Query":
        return self

    def eq(self, column: str, value: object) -> "Query":
        return self

    def order(self, column: str) -> "Query":
        return self

    def range(self, start: int, end: int) -> "Query":
        return self

    def limit(self, count: int) -> "Query":
        return self

    def execute(self) -> Any:
        return type("Result", (), {"data": self.rows})()


class Database:
    def __init__(self, perfumes: list[dict[str, Any]], assets: list[dict[str, str]]) -> None:
        self.tables = {"perfumes": perfumes, "perfume_assets": assets}

    def table(self, name: str) -> Query:
        return Query(self.tables[name])


def _install(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, database: Database) -> Path:
    illustrations = tmp_path / "work" / "illustrations"
    dirs = type("Dirs", (), {"illustrations": illustrations})()
    monkeypatch.setattr(gal, "load_env", lambda: None)
    monkeypatch.setattr(gal, "local_dirs", lambda: dirs)
    monkeypatch.setattr(gal, "make_supabase", lambda: database)
    return illustrations


def test_csv_flags_local_files_and_published_assets(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    perfumes: list[dict[str, Any]] = [
        {
            "id": ONLY_FILE,
            "name": "Zeta",
            "release_year": 2001,
            "brands": {"name": "Beta"},
            "concentrations": {"name": "EDP"},
        },
        {
            "id": HAVE_BOTH,
            "name": "Alpha",
            "release_year": None,
            "brands": {"name": "Beta"},
            "concentrations": None,
        },
        {
            "id": NEITHER,
            "name": "Omega",
            "release_year": 1999,
            "brands": None,
            "concentrations": {"name": "EDT"},
        },
    ]
    database = Database(perfumes, [{"perfume_id": HAVE_BOTH}])
    illustrations = _install(monkeypatch, tmp_path, database)
    illustrations.mkdir(parents=True)
    (illustrations / f"{HAVE_BOTH}.PNG").write_bytes(b"")
    (illustrations / f"{ONLY_FILE}.avif").write_bytes(b"")
    (illustrations / "readme.txt").write_text("ignored")

    gal.main()

    with open(illustrations.parent / "missing_assets.csv", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f, delimiter=";"))
    assert rows[0][0] == "ID"
    assert rows[1:] == [
        [NEITHER, "Omega", "Unknown", "EDT", "1999", "FALSE", "FALSE"],
        [HAVE_BOTH, "Alpha", "Beta", "Unknown", "", "TRUE", "TRUE"],
        [ONLY_FILE, "Zeta", "Beta", "EDP", "2001", "TRUE", "FALSE"],
    ]


def test_missing_illustrations_directory_marks_every_perfume_as_absent(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    database = Database(
        [{"id": NEITHER, "name": "Omega", "brands": {"name": "B"}, "concentrations": None}], []
    )
    illustrations = _install(monkeypatch, tmp_path, database)

    gal.main()

    text = (illustrations.parent / "missing_assets.csv").read_text(encoding="utf-8-sig")
    assert text.splitlines()[1].endswith("FALSE;FALSE")


def test_main_exits_when_the_database_is_not_configured(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def unconfigured() -> None:
        raise RuntimeError("SUPABASE_URL is not set")

    monkeypatch.setattr(gal, "load_env", lambda: None)
    monkeypatch.setattr(gal, "make_supabase", unconfigured)

    with pytest.raises(SystemExit) as exit_info:
        gal.main()

    assert exit_info.value.code == 1
    assert "SUPABASE_URL is not set" in capsys.readouterr().out
