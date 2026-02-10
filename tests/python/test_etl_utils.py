import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Mock environment before importing
os.environ["SUPABASE_URL"] = "http://mock"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock"

# Mock Supabase before importing the module that initializes it
with patch('supabase.create_client') as mock_create:
    mock_create.return_value = MagicMock()
    # Add scripts directory to path to allow import
    sys.path.append(os.path.join(os.path.dirname(__file__), '../../scripts'))
    from etl_v5 import ETLPipelineV5

@pytest.fixture
def etl():
    return ETLPipelineV5("dummy.csv")

def test_normalize_text(etl):
    assert etl.normalize_text("  BRAND Name  ") == "brand name"
    assert etl.normalize_text("Multiple   Spaces") == "multiple spaces"
    assert etl.normalize_text(None) == ""
    assert etl.normalize_text(123) == ""

def test_clean_note(etl):
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

def test_generate_fingerprint_strict(etl):
    fp1 = etl.generate_fingerprint_strict("Chanel", "N°5", "EDP", 1921)
    fp2 = etl.generate_fingerprint_strict(" CHANEL ", " n°5 ", " edp ", "1921.0")
    
    # Should be insensitive to case, spacing, and float-like year strings
    assert fp1 == fp2
    assert len(fp1) == 64 # SHA256 length

def test_slugify(etl):
    assert etl.slugify("Hello World!") == "hello-world"
    assert etl.slugify("Brand (New) Name") == "brand-new-name"
