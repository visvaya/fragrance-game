import os
import sys
import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock, patch

# Mock environment
os.environ["SUPABASE_URL"] = "http://mock"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock"

# Mock Supabase before importing
with patch('supabase.create_client') as mock_create:
    mock_create.return_value = MagicMock()
    sys.path.append(os.path.join(os.path.dirname(__file__), '../../scripts'))
    from etl_v5 import ETLPipelineV5

@pytest.fixture
def etl():
    pipeline = ETLPipelineV5("dummy.csv")
    # Mock a dataframe with minimal columns
    data = {
        'Brand': ['A', 'B', 'A', 'C'],
        'Name': ['P1', 'P2', 'P3', 'P4'],
        'Concentration': ['EDP', 'EDT', 'EDP', 'Parfum'],
        'Release Year': [2020, 2021, 2020, 2022],
        'Rating Count': [1000, 50, 500, 10],  # Eligible threshold is 400
        'Gender': ['Unisex', 'Male', 'Female', 'Unisex'],
        'Top Notes': ['Bergamot, Lemon', 'Orange', 'Rose', 'Lemon'],
        'Middle Notes': ['Rose', 'Cedar', 'Jasmine', 'Rose'],
        'Base Notes': ['Musk', 'Amber', 'Musk', 'Musk'],
        'Main Accords': ['', '', '', ''],
        'URL': ['http://x', 'http://x', 'http://x', 'http://x'],
        'Is Uncertain': [False, False, False, False],
        'Is Linear': [False, False, False, False]
    }
    pipeline.df = pd.DataFrame(data)
    # Basic cleaning that calculate_xsolve_score expects
    pipeline.df['fingerprint_strict'] = 'fp'
    pipeline.df['fingerprint_loose'] = 'fp'
    return pipeline

def test_xsolve_scoring_components(etl):
    # We need to lower the threshold for our small test set
    with patch('logging.Logger.warning'): # Silence warning about lowering threshold
        etl.calculate_xsolve_score()
    
    # Check if xsolve_score column exists
    assert 'xsolve_score' in etl.df.columns
    
    # Check eligibility (Rating >= 400 in our test case is P1 and P3)
    # The script lowers threshold to >= 10 if < 50 eligible. 
    # With our data, all 4 are eligible (>= 10).
    
    # High population/rating should have LOWER obscurity score (more popular)
    # P1 (1000) vs P4 (10)
    p1_score = etl.df[etl.df['Name'] == 'P1']['obscurity_raw'].iloc[0]
    p4_score = etl.df[etl.df['Name'] == 'P4']['obscurity_raw'].iloc[0]
    assert p1_score < p4_score
    
    # Note count factor
    # P1 has 4 unique notes (Bergamot, Lemon, Rose, Musk) 
    # Check if notes were extracted correctly
    p1_notes = etl.df[etl.df['Name'] == 'P1']['notes_list'].iloc[0]
    assert "Bergamot" in p1_notes
    assert len(p1_notes) >= 4

def test_note_extraction_robustness(etl):
    # Test fallback to Main Accords if pyramid is empty
    etl.df.loc[0, 'Top Notes'] = None
    etl.df.loc[0, 'Middle Notes'] = None
    etl.df.loc[0, 'Base Notes'] = None
    etl.df.loc[0, 'Main Accords'] = 'Citrus, Woody'
    
    etl.calculate_xsolve_score()
    
    p1_notes = etl.df.iloc[0]['notes_list']
    assert "Citrus" in p1_notes
    assert "Woody" in p1_notes
