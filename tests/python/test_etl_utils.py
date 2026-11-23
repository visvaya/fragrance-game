import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Mock environment before importing
os.environ["SUPABASE_URL"] = "http://mock"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock"

# Mock Supabase before importing the module that initializes it
with patch("supabase.create_client") as mock_create:
    mock_create.return_value = MagicMock()
    # Add scripts directory to path to allow import
    sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts"))
    import etl as etl_module
    from etl import EtlPipeline


@pytest.fixture
def etl() -> EtlPipeline:
    return EtlPipeline("dummy.csv")


def test_normalize_text(etl: EtlPipeline) -> None:
    assert etl.normalize_text("  BRAND Name  ") == "brand name"
    assert etl.normalize_text("Multiple   Spaces") == "multiple spaces"
    assert etl.normalize_text(None) == ""
    assert etl.normalize_text(123) == ""


def test_clean_note(etl: EtlPipeline) -> None:
    # Test cleaning specific trademark symbols
    assert etl._clean_note("Jasmine™") == "Jasmine"
    assert etl._clean_note("Rose®") == "Rose"

    # Test removing La Reunion prefix
    assert etl._clean_note("La Réunion Vanilla") == "Vanilla"

    # Test removing marketing descriptors
    assert etl._clean_note("Bergamot Absolute") == "Bergamot"
    assert etl._clean_note("Lavender Scenttrek") == "Lavender"
    assert etl._clean_note("Oud Orpur") == "Oud"
    assert etl._clean_note("Rose CO2") == "Rose"
    assert etl._clean_note("Iris concrete") == "Iris"

    # Test combinations
    assert etl._clean_note("  Fleur de Sel (Absolute) ™  ") == "Fleur de Sel"


def test_generate_fingerprint_strict(etl: EtlPipeline) -> None:
    fp1 = etl.generate_fingerprint_strict("Chanel", "N°5", "EDP", 1921)
    fp2 = etl.generate_fingerprint_strict(" CHANEL ", " n°5 ", " edp ", "1921.0")

    # Should be insensitive to case, spacing, and float-like year strings
    assert fp1 == fp2
    assert len(fp1) == 64  # SHA256 length


def test_slugify(etl: EtlPipeline) -> None:
    assert etl.slugify("Hello World!") == "hello-world"
    assert etl.slugify("Brand (New) Name") == "brand-new-name"


def test_repair_text_fixes_utf8_read_as_cp1250() -> None:
    broken = "Eau Fra\u0102\u00aeche"

    assert etl_module.repair_text(broken) == "Eau Fra\u00eeche"
    assert etl_module.repair_text("Eau L\u0102\u00a9g\u0102\u00a8re") == "Eau L\u00e9g\u00e8re"


def test_repair_text_keeps_correct_text_and_non_strings() -> None:
    assert (
        etl_module.repair_text("\u00c5ngstr\u00f6m Chlo\u00e9") == "\u00c5ngstr\u00f6m Chlo\u00e9"
    )
    assert etl_module.repair_text(None) is None


def test_repair_text_restores_the_see_by_chloe_name() -> None:
    assert etl_module.repair_text("SeeByChlo\u00e9 Si Belle") == "See by Chlo\u00e9 Si Belle"


def _lookup_client(selects: list[list[dict[str, str]]], insert: object) -> MagicMock:
    """A client whose select calls return `selects`; `insert` is a result or an error."""
    client = MagicMock()
    select_exec = (
        client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute
    )
    select_exec.side_effect = [MagicMock(data=rows) for rows in selects]
    insert_exec = client.table.return_value.insert.return_value.execute
    if isinstance(insert, Exception):
        insert_exec.side_effect = insert
    else:
        insert_exec.return_value = insert
    return client


def test_lookup_returns_and_caches_an_existing_row(etl: EtlPipeline) -> None:
    client = _lookup_client([[{"id": "id-1"}]], None)
    with patch.object(etl_module, "supabase", client):
        assert etl._get_or_create_lookup("brands", "name", "Chanel") == "id-1"
        assert etl._get_or_create_lookup("brands", "name", "chanel") == "id-1"
    client.table.return_value.insert.assert_not_called()


def test_lookup_creates_a_missing_row(etl: EtlPipeline) -> None:
    client = _lookup_client([[]], MagicMock(data=[{"id": "id-2"}]))
    with patch.object(etl_module, "supabase", client):
        assert etl._get_or_create_lookup("brands", "name", "Dior") == "id-2"
        assert etl.db_cache["brands"]["dior"] == "id-2"


def test_lookup_refetches_after_a_failed_insert(etl: EtlPipeline) -> None:
    client = _lookup_client([[], [{"id": "id-3"}]], RuntimeError("duplicate"))
    with patch.object(etl_module, "supabase", client):
        assert etl._get_or_create_lookup("brands", "name", "Guerlain") == "id-3"


def test_lookup_raises_when_the_row_cannot_be_found_or_created(etl: EtlPipeline) -> None:
    client = _lookup_client([[], []], RuntimeError("down"))
    with patch.object(etl_module, "supabase", client), pytest.raises(LookupError):
        etl._get_or_create_lookup("brands", "name", "Hermes")
