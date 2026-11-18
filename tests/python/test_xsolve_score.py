import os
import sys
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

# Mock environment
os.environ["SUPABASE_URL"] = "http://mock"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock"

# Mock Supabase before importing
with patch("supabase.create_client") as mock_create:
    mock_create.return_value = MagicMock()
    sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts"))
    from etl import EtlPipeline


@pytest.fixture
def etl() -> EtlPipeline:
    pipeline = EtlPipeline("dummy.csv")
    # Mock a dataframe with minimal columns
    data = {
        "Brand": ["A", "B", "A", "C"],
        "Name": ["P1", "P2", "P3", "P4"],
        "Concentration": ["EDP", "EDT", "EDP", "Parfum"],
        "Release Year": [2020, 2021, 2020, 2022],
        "Rating Count": [1000, 50, 500, 10],  # Eligible from 400 ratings
        "Gender": ["Unisex", "Male", "Female", "Unisex"],
        "Top Notes": ["Bergamot, Lemon", "Orange", "Rose", "Lemon"],
        "Middle Notes": ["Rose", "Cedar", "Jasmine", "Rose"],
        "Base Notes": ["Musk", "Amber", "Musk", "Musk"],
        "Main Accords": ["", "", "", ""],
        "URL": ["http://x", "http://x", "http://x", "http://x"],
        "Is Uncertain": [False, False, False, False],
        "Is Linear": [False, False, False, False],
    }
    pipeline.df = pd.DataFrame(data)
    # Basic cleaning that calculate_xsolve_score expects
    pipeline.df["fingerprint_strict"] = "fp"
    pipeline.df["fingerprint_loose"] = "fp"
    return pipeline


def frame(pipeline: EtlPipeline) -> pd.DataFrame:
    assert pipeline.df is not None
    return pipeline.df


def test_xsolve_scoring_components(etl: EtlPipeline) -> None:
    # Only 2 of the 4 perfumes are eligible: the real threshold stays, with a warning
    with patch("logging.Logger.warning"):
        etl.calculate_xsolve_score()

    assert "xsolve_score" in frame(etl).columns

    # High population/rating should have LOWER obscurity score (more popular)
    # P1 (1000) vs P3 (500), both eligible
    p1_score = frame(etl)[frame(etl)["Name"] == "P1"]["obscurity_raw"].iloc[0]
    p3_score = frame(etl)[frame(etl)["Name"] == "P3"]["obscurity_raw"].iloc[0]
    assert p1_score < p3_score
    assert pd.isna(frame(etl)[frame(etl)["Name"] == "P4"]["obscurity_raw"].iloc[0])

    # Note count factor
    # P1 has 4 unique notes (Bergamot, Lemon, Rose, Musk)
    # Check if notes were extracted correctly
    p1_notes = frame(etl)[frame(etl)["Name"] == "P1"]["notes_list"].iloc[0]
    assert "Bergamot" in p1_notes
    assert len(p1_notes) >= 4


def test_note_extraction_robustness(etl: EtlPipeline) -> None:
    # Test fallback to Main Accords if pyramid is empty
    frame(etl).loc[0, "Top Notes"] = None
    frame(etl).loc[0, "Middle Notes"] = None
    frame(etl).loc[0, "Base Notes"] = None
    frame(etl).loc[0, "Main Accords"] = "Citrus, Woody"

    etl.calculate_xsolve_score()

    p1_notes = frame(etl).iloc[0]["notes_list"]
    assert "Citrus" in p1_notes
    assert "Woody" in p1_notes


def test_perfume_below_the_rating_threshold_gets_no_score(etl: EtlPipeline) -> None:
    etl.calculate_xsolve_score()

    scores = frame(etl).set_index("Name")["xsolve_score"]
    assert scores[["P1", "P3"]].notna().all()
    assert scores[["P2", "P4"]].isna().all()
