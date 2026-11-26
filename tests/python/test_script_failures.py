"""Data scripts must report failures through their exit code, not only in the log."""

import importlib
import os
import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

os.environ["SUPABASE_URL"] = "http://mock"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock"

sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts"))
sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts/assets"))

# The scripts live outside a package, so they load after the path setup above.
with patch("supabase.create_client", return_value=MagicMock()):
    etl = importlib.import_module("etl")
generate_asset_list = importlib.import_module("generate_asset_list")
process_game_assets = importlib.import_module("process_game_assets")

PERFUME = "c2614cda-f6a4-4fba-9d8a-1d9734f8cc97"


def test_etl_exits_with_an_error_when_a_batch_is_not_saved() -> None:
    pipeline = etl.EtlPipeline("dummy.csv")
    pipeline.load_and_clean_data = MagicMock()
    pipeline.calculate_xsolve_score = MagicMock()

    def sync() -> None:
        with patch.object(etl, "supabase") as client:
            client.table.return_value.upsert.side_effect = RuntimeError("constraint")
            pipeline._batch_upsert([{"name": "a"}, {"name": "b"}])

    pipeline.sync_to_supabase = sync

    with pytest.raises(SystemExit) as exit_info:
        pipeline.run()

    assert exit_info.value.code == 1
    assert pipeline.failed_records == 2


def test_etl_counts_a_perfume_whose_brand_could_not_be_stored() -> None:
    pipeline = etl.EtlPipeline("dummy.csv")
    pipeline.df = pd.DataFrame(
        {
            "Brand": ["Broken", "Good"],
            "Name": ["P1", "P2"],
            "Concentration": ["Unknown", "Unknown"],
            "Manufacturer": ["Unknown", "Unknown"],
            "Release Year": [2020, 2021],
            "Gender": ["Unisex", "Male"],
            "Top Notes": ["Rose", "Musk"],
            "Middle Notes": ["", ""],
            "Base Notes": ["", ""],
            "Perfumers": ["", ""],
            "xsolve_score": [0.5, 0.5],
            "is_active": [True, True],
            "Is Uncertain": [False, False],
            "Is Linear": [False, False],
            "fingerprint_strict": ["a", "b"],
            "fingerprint_loose": ["a", "b"],
        }
    )
    saved: list[dict[str, Any]] = []
    pipeline._record_import = MagicMock()
    pipeline.prepopulate_cache = MagicMock()
    pipeline._batch_upsert = saved.extend

    with patch.object(etl, "supabase") as client:
        brands = client.table.return_value
        # "Broken": by name and by slug, then both again after the refused insert.
        brands.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            MagicMock(data=[]),
            MagicMock(data=[]),
            MagicMock(data=[]),
            MagicMock(data=[]),
            MagicMock(data=[{"id": "brand-good"}]),
        ]
        brands.insert.return_value.execute.side_effect = RuntimeError("insert refused")
        pipeline.sync_to_supabase()

    assert pipeline.failed_records == 1
    assert [record["name"] for record in saved] == ["P2"]


def test_etl_saves_one_row_per_database_key() -> None:
    # Two spellings of one label resolve to the same concentration row, so both rows would share
    # the upsert key; one batch must not touch a row twice.
    pipeline = etl.EtlPipeline("dummy.csv")
    pipeline.df = pd.DataFrame(
        {
            "Brand": ["Dior", "Dior"],
            "Name": ["Dior Homme", "Dior Homme"],
            "Concentration": ["Lotion Après-Rasage", "Lotion Après Rasage"],
            "Manufacturer": ["Unknown", "Unknown"],
            "Release Year": [2020, 2020],
            "Gender": ["Male", "Male"],
            "Top Notes": ["Iris", "Iris"],
            "Middle Notes": ["", ""],
            "Base Notes": ["", ""],
            "Perfumers": ["", ""],
            "xsolve_score": [0.5, 0.5],
            "is_active": [True, True],
            "Is Uncertain": [True, True],
            "Is Linear": [False, False],
            "fingerprint_strict": ["a", "b"],
            "fingerprint_loose": ["c", "c"],
        }
    )
    saved: list[dict[str, Any]] = []
    pipeline._record_import = MagicMock()
    pipeline.prepopulate_cache = MagicMock()
    pipeline._batch_upsert = saved.extend
    lookups = {"brands": "brand-dior", "concentrations": "conc-aftershave", "manufacturers": None}
    pipeline._get_or_create_lookup = MagicMock(side_effect=lambda table, *_a, **_k: lookups[table])

    pipeline.sync_to_supabase()

    assert [record["fingerprint_strict"] for record in saved] == ["a"]


def test_process_file_reports_an_unreadable_illustration(tmp_path: Path) -> None:
    broken = tmp_path / f"{PERFUME}.png"
    broken.write_bytes(b"not an image")

    assert process_game_assets.process_file(broken, tmp_path, clients=None) is False


class FakeTable:
    """A query over `rows` that, like PostgREST, returns at most `cap` rows per request."""

    def __init__(self, rows: list[dict[str, str]], cap: int = 1000) -> None:
        self.rows = rows
        self.cap = cap
        self.ordered_by: str | None = None
        self.start = 0
        self.end = 0

    def select(self, columns: str) -> "FakeTable":
        return self

    def order(self, column: str) -> "FakeTable":
        self.ordered_by = column
        return self

    def limit(self, count: int) -> "FakeTable":
        assert count <= self.cap
        return self

    def range(self, start: int, end: int) -> "FakeTable":
        self.start, self.end = start, end
        return self

    def execute(self) -> MagicMock:
        assert self.ordered_by, "pages without an order can skip or repeat rows"
        page = self.rows[self.start : min(self.end + 1, self.start + self.cap)]
        return MagicMock(data=page)


def test_fetch_pages_reads_every_row_past_the_response_cap() -> None:
    rows = [{"perfume_id": str(i)} for i in range(2500)]

    fetched = generate_asset_list.fetch_pages(lambda: FakeTable(rows), "perfume_id")

    assert fetched == rows


def test_etl_prepopulates_every_lookup_row_past_the_response_cap() -> None:
    brands = [{"id": f"id-{i}", "name": f"Brand {i}"} for i in range(2500)]
    pipeline = etl.EtlPipeline("dummy.csv")

    with patch.object(etl, "supabase") as client:
        client.table.side_effect = lambda name: FakeTable(brands if name == "brands" else [])
        pipeline.prepopulate_cache()

    assert len(pipeline.db_cache["brands"]) == 2500
    assert pipeline.db_cache["brands"]["brand 2499"] == "id-2499"


def _duplicates_frame(counts: list[int]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Brand": ["B"] * len(counts),
            "Name": ["N"] * len(counts),
            "Concentration": ["EDP"] * len(counts),
            "Release Year": [2020] * len(counts),
            "Rating Count": counts,
            "fingerprint_strict": ["same"] * len(counts),
            "fingerprint_loose": ["loose"] * len(counts),
        }
    )


def test_find_duplicates_keeps_the_row_with_most_ratings() -> None:
    pairs = etl.find_duplicates(_duplicates_frame([5, 50]))

    assert [(kept["Rating Count"], dropped["Rating Count"]) for kept, dropped in pairs] == [(50, 5)]


def test_find_duplicates_is_empty_without_duplicates() -> None:
    frame = _duplicates_frame([5, 50])
    frame["fingerprint_strict"] = ["a", "b"]

    assert etl.find_duplicates(frame) == []


def test_find_duplicates_reports_each_dropped_row_of_a_three_way_duplicate() -> None:
    pairs = etl.find_duplicates(_duplicates_frame([5, 50, 20]))

    assert [(kept["Rating Count"], dropped["Rating Count"]) for kept, dropped in pairs] == [
        (50, 20),
        (50, 5),
    ]


def test_catalog_version_is_the_sha256_of_the_source() -> None:
    assert etl.catalog_version(b"abc") == (
        "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )


def _recording_pipeline(counts: list[int]) -> Any:
    pipeline = etl.EtlPipeline("dummy.csv")
    pipeline.catalog_version = "sha256:x"
    pipeline.duplicates = etl.find_duplicates(_duplicates_frame(counts))
    return pipeline


def test_record_import_links_raw_rows_and_conflicts_to_the_run() -> None:
    pipeline = _recording_pipeline([5, 50, 20])
    with patch.object(etl, "supabase") as client:
        tables = {
            name: MagicMock() for name in ("import_runs", "raw_import_rows", "import_conflicts")
        }
        client.table.side_effect = tables.__getitem__
        tables["import_runs"].insert.return_value.execute.return_value.data = [{"id": "run-1"}]
        tables["raw_import_rows"].insert.return_value.execute.return_value.data = [
            {"id": "raw-1"},
            {"id": "raw-2"},
        ]
        pipeline._record_import()

    tables["import_runs"].insert.assert_called_once_with({"catalog_version": "sha256:x"})
    raw_rows = tables["raw_import_rows"].insert.call_args.args[0]
    assert {row["import_run_id"] for row in raw_rows} == {"run-1"}
    assert [row["raw_json"]["Rating Count"] for row in raw_rows] == [20, 5]
    conflicts = tables["import_conflicts"].insert.call_args.args[0]
    assert [(c["import_run_id"], c["raw_row_id"]) for c in conflicts] == [
        ("run-1", "raw-1"),
        ("run-1", "raw-2"),
    ]
    assert conflicts[0]["conflict_type"] == "duplicate_strict_fingerprint"
    assert conflicts[0]["details"]["Rating Count"] == 50
    assert conflicts[0]["details"]["dropped_rating_count"] == 20
    assert pipeline.failed_records == 0


def test_record_import_stops_when_the_run_cannot_be_stored() -> None:
    pipeline = _recording_pipeline([5, 50])
    with patch.object(etl, "supabase") as client:
        client.table.return_value.insert.return_value.execute.side_effect = RuntimeError("denied")
        with pytest.raises(RuntimeError, match="Could not record the import run"):
            pipeline._record_import()


def test_record_import_counts_conflicts_that_could_not_be_stored() -> None:
    pipeline = _recording_pipeline([5, 50, 20])
    with patch.object(etl, "supabase") as client:
        tables = {
            name: MagicMock() for name in ("import_runs", "raw_import_rows", "import_conflicts")
        }
        client.table.side_effect = tables.__getitem__
        tables["import_runs"].insert.return_value.execute.return_value.data = [{"id": "run-1"}]
        tables["raw_import_rows"].insert.return_value.execute.side_effect = RuntimeError("denied")
        pipeline._record_import()

    assert pipeline.failed_records == 2
