"""Data scripts must report failures through their exit code, not only in the log."""

import importlib
import os
import sys
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


def test_etl_exits_with_an_error_when_a_batch_is_not_saved():
    pipeline = etl.EtlPipeline("dummy.csv")
    pipeline.load_and_clean_data = MagicMock()
    pipeline.calculate_xsolve_score = MagicMock()

    def sync():
        with patch.object(etl, "supabase") as client:
            client.table.return_value.upsert.side_effect = RuntimeError("constraint")
            pipeline._batch_upsert([{"name": "a"}, {"name": "b"}])

    pipeline.sync_to_supabase = sync

    with pytest.raises(SystemExit) as exit_info:
        pipeline.run()

    assert exit_info.value.code == 1
    assert pipeline.failed_records == 2


def test_etl_counts_a_perfume_whose_brand_could_not_be_stored():
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
    saved = []
    pipeline.prepoulate_cache = MagicMock()
    pipeline._batch_upsert = saved.extend

    with patch.object(etl, "supabase") as client:
        brands = client.table.return_value
        brands.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            MagicMock(data=[]),
            MagicMock(data=[]),
            MagicMock(data=[{"id": "brand-good"}]),
        ]
        brands.insert.return_value.execute.side_effect = RuntimeError("insert refused")
        pipeline.sync_to_supabase()

    assert pipeline.failed_records == 1
    assert [record["name"] for record in saved] == ["P2"]


def test_process_file_reports_an_unreadable_illustration(tmp_path):
    broken = tmp_path / f"{PERFUME}.png"
    broken.write_bytes(b"not an image")

    assert process_game_assets.process_file(broken, tmp_path, clients=None) is False


class FakeTable:
    """A query over `rows` that, like PostgREST, returns at most `cap` rows per request."""

    def __init__(self, rows, cap=1000):
        self.rows = rows
        self.cap = cap
        self.ordered_by = None

    def order(self, column):
        self.ordered_by = column
        return self

    def limit(self, count):
        assert count <= self.cap
        return self

    def range(self, start, end):
        self.start, self.end = start, end
        return self

    def execute(self):
        assert self.ordered_by, "pages without an order can skip or repeat rows"
        page = self.rows[self.start : min(self.end + 1, self.start + self.cap)]
        return MagicMock(data=page)


def test_fetch_pages_reads_every_row_past_the_response_cap():
    rows = [{"perfume_id": str(i)} for i in range(2500)]

    fetched = generate_asset_list.fetch_pages(lambda: FakeTable(rows), "perfume_id")

    assert fetched == rows
