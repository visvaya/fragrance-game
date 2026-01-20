import os
import re
import hashlib
import json
import logging
import asyncio
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm
from datetime import datetime
from typing import List, Dict, Any, Optional

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("etl_v5.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constants
XSOLVE_MODEL_VERSION = 1
BATCH_SIZE = 100

# Load Environment Variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Helper key for complete access

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    exit(1)

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class ETLPipelineV5:
    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.df = None
        self.db_cache = {
            'brands': {},
            'concentrations': {},
            'manufacturers': {}
        }
    
    def normalize_text(self, text: Any) -> str:
        """Lowercase, strip, single internal spaces."""
        if not isinstance(text, str):
            return ""
        text = text.lower().strip()
        return re.sub(r'\s+', ' ', text)

    def generate_fingerprint_strict(self, brand: str, name: str, concentration: str, year: Any) -> str:
        """SHA256(norm(Brand)|norm(Name)|norm(Concentration)|Year)"""
        norm_brand = self.normalize_text(brand)
        norm_name = self.normalize_text(name)
        norm_conc = self.normalize_text(concentration)
        
        # Handle Year
        try:
            year_val = str(int(float(year))) if pd.notnull(year) and year != "" else "0"
        except:
            year_val = "0"
            
        raw_str = f"{norm_brand}|{norm_name}|{norm_conc}|{year_val}"
        return hashlib.sha256(raw_str.encode('utf-8')).hexdigest()

    def generate_fingerprint_loose(self, brand: str, name: str) -> str:
        """SHA256(norm(Brand)|norm(Name))"""
        norm_brand = self.normalize_text(brand)
        norm_name = self.normalize_text(name)
        raw_str = f"{norm_brand}|{norm_name}"
        return hashlib.sha256(raw_str.encode('utf-8')).hexdigest()

    def slugify(self, text: str) -> str:
        """Simple slugify: lowercase, strip, replace non-alphanum with -"""
        text = self.normalize_text(text)
        text = re.sub(r'[^a-z0-9]+', '-', text)
        return text.strip('-')

    def load_and_clean_data(self):
        logger.info(f"Loading data from {self.csv_path}...")
        
        # Read with specific separation and decimal handling for the dataset
        self.df = pd.read_csv(self.csv_path, sep=';', decimal=',')
        
        logger.info(f"Loaded {len(self.df)} rows. Cleaning data...")

        # 1. Clean Column Names
        self.df.columns = [c.strip() for c in self.df.columns]
        
        # 2. Basic Conversions
        self.df['Release Year'] = pd.to_numeric(self.df['Release Year'], errors='coerce').fillna(0).astype(int)
        self.df['Rating Count'] = pd.to_numeric(self.df['Rating Count'], errors='coerce').fillna(0).astype(int)
        self.df['Rating Value'] = pd.to_numeric(self.df['Rating Value'], errors='coerce').fillna(0.0)
        
        # 3. Missing Values
        self.df['Brand'] = self.df['Brand'].fillna('Unknown')
        self.df['Name'] = self.df['Name'].fillna('Unknown')
        self.df['Concentration'] = self.df['Concentration'].fillna('Unknown')
        self.df['Manufacturer'] = self.df['Manufacturer'].fillna('Unknown')
        
        # 4. Generate Fingerprints
        logger.info("Generating fingerprints...")
        self.df['fingerprint_strict'] = self.df.apply(
            lambda x: self.generate_fingerprint_strict(x['Brand'], x['Name'], x['Concentration'], x['Release Year']), axis=1
        )
        self.df['fingerprint_loose'] = self.df.apply(
            lambda x: self.generate_fingerprint_loose(x['Brand'], x['Name']), axis=1
        )
        
        # 5. Deduplication (Group by fingerprint_strict)
        logger.info("Deduplicating...")
        initial_len = len(self.df)
        
        # Key Aggregation Logic:
        # - Rating Count: max
        # - Notes/Accords: combine (simple string concatenation for now, ideal would be set union)
        # - Others: first
        self.df = self.df.sort_values('Rating Count', ascending=False).drop_duplicates('fingerprint_strict', keep='first')
        
        logger.info(f"Deduplication removed {initial_len - len(self.df)} rows. Current count: {len(self.df)}")

    def _clean_note(self, note_text):
        """Clean individual note text removing marketing terms."""
        if not note_text: return ""
        t = str(note_text).strip()

        # 1. Remove Special Characters
        t = re.sub(r'[™®]', '', t)
        
        # 2. Remove Specific Prefixes
        t = re.sub(r'\bLa Réunion\b', '', t, flags=re.IGNORECASE)

        # 3. Remove marketing qualifiers / Suffixes
        # List merging User findings + Standard noise
        remove_words = [
            # User defined
            'absolute', 'scenttrek', 'orpur', 'co2', 'concrete', 'otto', 'nectar', 
            'material', 'resinoid', 'oxide'
        ]
        
        # Sort by length to ensure longer phrases match first
        remove_words.sort(key=len, reverse=True)
        
        # Compiled pattern
        pattern = re.compile(r'\b(' + '|'.join(map(re.escape, remove_words)) + r')\b', re.IGNORECASE)
        t = pattern.sub('', t)
        
        # Remove parentheses content
        t = re.sub(r'\(.*?\)', '', t)
        
        # Collapse spaces and remove punctuation
        t = re.sub(r'\s+', ' ', t).strip()
        t = re.sub(r'[,\-]$', '', t).strip()
        return t

    def _extract_list_cleaned(self, text_blob):
        """Extract lists from CSV string and clean each item."""
        if pd.isna(text_blob) or text_blob == '':
            return []
        # Split by comma
        items = [s.strip() for s in str(text_blob).split(',') if s.strip()]
        # Clean each item using the robust cleaner
        cleaned = [self._clean_note(i) for i in items]
        # Remove empty strings and duplicates while preserving order
        final = []
        seen = set()
        for c in cleaned:
            if c and c not in seen:
                final.append(c)
                seen.add(c)
        return final

    def calculate_xsolve_score(self):
        logger.info("Calculating xSolve scores...")
        
        # Helper for note cleaning


        # Prepare columns required for stats
        self.df['gender_norm'] = self.df['Gender'].apply(self.normalize_text)

        # --- 0. Construct Full Note Pyramid for Stats ---
        # User Rule: Use notes (Top/Mid/Base) for stats, not just Main Accords.
        # Compute this for ALL perfumes first.
        
        def get_all_notes(row):
            # Combine Top, Middle, Base
            all_n = []
            for col in ['Top Notes', 'Middle Notes', 'Base Notes']:
                val = row.get(col)
                if pd.notnull(val):
                    all_n.extend(self._extract_list_cleaned(val))
            return all_n

        logger.info("Extracting note pyramids...")
        self.df['notes_list'] = self.df.apply(get_all_notes, axis=1)
        
        # Fallback to Main Accords if pyramid is empty
        mask_no_notes = self.df['notes_list'].apply(len) == 0
        if mask_no_notes.any():
            self.df.loc[mask_no_notes, 'notes_list'] = self.df.loc[mask_no_notes, 'Main Accords'].fillna('').astype(str).apply(
                lambda x: [self._clean_note(s) for s in x.split(',') if self._clean_note(s)]
            )
            
        self.df['note_count'] = self.df['notes_list'].apply(len)

        # --- Base Population for Difficulty (Eligible Only) ---
        # User Rule: "Obliczaj xSolve tylko dla eligible (Rating >= 400)"
        eligible_mask = self.df['Rating Count'] >= 400
        
        # Fallback if too few eligible
        if eligible_mask.sum() < 50:
            logger.warning(f"Only {eligible_mask.sum()} eligible perfumes (>=400). Lowering threshold to >=10 for testing.")
            eligible_mask = self.df['Rating Count'] >= 10
            
        df_stats = self.df[eligible_mask]
        logger.info(f"Eligible population for xSolve scoring: {len(df_stats)} perfumes")

        # --- Component 1: Obscurity Bonus (Global Rarity) ---
        # Log-scale rarity 
        p99_rating = np.percentile(df_stats['Rating Count'], 99)
        p99_rating = max(p99_rating, 1) # Avoid div 0
        
        # Calculate for ELIGIBLE rows only (others will be NULL)
        p99_rating = np.percentile(df_stats['Rating Count'], 99)
        p99_rating = max(p99_rating, 1) # Avoid div 0
        
        # Initialize column with NaN
        self.df['obscurity_raw'] = np.nan
        
        # Apply score only to eligible rows
        self.df.loc[eligible_mask, 'obscurity_raw'] = 1.0 - (
            np.log1p(np.minimum(self.df.loc[eligible_mask, 'Rating Count'], p99_rating)) / np.log1p(p99_rating)
        )
        
        # --- Component 2: Gender Adjustment (Contextual Rarity) ---
        
        # Calculate ranks based ONLY on eligible stats
        # Create a mapping of {gender: list_of_ratings} to compute rank
        # This is strictly approximation if we want to apply to ALL rows 
        # but using only eligible distribution.
        # Simpler approach: Calculate rank percentile on ALL data but strictly? 
        # User said "okreslajmy on eligible".
        
        # Let's compute p_ranks for the eligible set boundaries
        # We can assign a percentile to each rating *as if* it was in the eligible distribution
        # For simplicity/speed in MVP: We will stick to global rank for Gender adjustment 
        # (as gender distribution is roughly similar in head vs tail), OR:
        # We calculate the percentile score of each perfume's rating against the Eligible distribution of that gender.
        
        gender_ratings = {}
        for g in ['Male', 'Female', 'Unisex']:
            g_norm = self.normalize_text(g)
            # Get ratings of eligible perfumes for this gender
            # Note: df_stats is the eligible subset
            ratings = df_stats[df_stats['gender_norm'] == g_norm]['Rating Count'].values
            gender_ratings[g_norm] = np.sort(ratings)

        def get_gender_rarity(row):
            g = row['gender_norm']
            r = row['Rating Count']
            if g not in gender_ratings or len(gender_ratings[g]) == 0:
                return 0.5 # Default
            
            # Find position of r in sorted eligible ratings
            # If r is smaller than all eligible (e.g. 1 vote), it's index 0 -> rarity 1.0 (very obscure)
            # If r is larger than all, it's index len -> rarity 0.0 (very popular)
            idx = np.searchsorted(gender_ratings[g], r)
            n = len(gender_ratings[g])
            pct = idx / n
            return 1.0 - pct

        self.df['gender_adj_raw'] = np.nan
        self.df.loc[eligible_mask, 'gender_adj_raw'] = self.df.loc[eligible_mask].apply(get_gender_rarity, axis=1)
        
        # Note: Note Count is calculated for ALL, but we only score eligible
        max_notes = self.df['note_count'].max()
        if max_notes == 0: max_notes = 1
        
        self.df['note_count_factor_raw'] = np.nan
        self.df.loc[eligible_mask, 'note_count_factor_raw'] = np.log1p(self.df.loc[eligible_mask, 'note_count']) / np.log1p(max_notes)
        
        # --- Component 4: Note Rarity (Complexity) ---
        # Calculated on ALL data (as requested)
        all_notes = [note for sublist in self.df['notes_list'] for note in sublist]
        total_occurrences = len(all_notes)
        if total_occurrences > 0:
            note_counts = pd.Series(all_notes).value_counts()
            note_freqs = note_counts / total_occurrences
            
            # Calculate average rarity
            def get_avg_rarity(notes):
                if not notes: return 0.0
                rarities = [1.0 - note_freqs.get(n, 0.0) for n in notes]
                return np.mean(rarities)
            
            # Calculate average rarity for ALL (metrics) but score only for ELIGIBLE
            self.df['avg_note_rarity'] = self.df['notes_list'].apply(get_avg_rarity)
            
            # Normalize against p95 of ALL data (User Rule: "przy ich obliczaniu bierz pod uwagę cały dataset")
            p95_rarity = np.percentile(self.df['avg_note_rarity'], 95)
            
            self.df['note_rarity_raw'] = np.nan
            # Vectorized operation instead of apply with lambda
            if p95_rarity > 0:
                normalized_values = self.df.loc[eligible_mask, 'avg_note_rarity'] / p95_rarity
                self.df.loc[eligible_mask, 'note_rarity_raw'] = normalized_values.clip(0, 1)
            else:
                self.df.loc[eligible_mask, 'note_rarity_raw'] = 0.0
        else:
            self.df['note_rarity_raw'] = np.nan

        # Weights
        W_OBSCURITY = 0.40
        W_GENDER = 0.30
        W_COUNT = 0.15
        W_RARITY = 0.15
        
        def clamp(x):
            return max(0.0, min(1.0, float(x)))

        
        # --- Set is_active ---
        # Rule: Technical validity only (Name + Brand + URL exists)
        # Eligibility for game (Rating >= 400, Image) is handled by 'eligible_perfumes' view
        
        # We need to ensure Name and Brand are not 'Unknown' or empty, and URL is present
        # Normalize first to check for 'unknown'
        self.df['is_active'] = (
            (self.df['Name'].str.lower() != 'unknown') & 
            (self.df['Name'].str.strip() != '') &
            (self.df['Brand'].str.lower() != 'unknown') &
            (self.df['Brand'].str.strip() != '') &
            (self.df['URL'].notnull()) &
            (self.df['URL'].str.strip() != '')
        )

        self.df['xsolve_score'] = np.nan
        
        # Calculate Final Score for ELIGIBLE rows
        # Weighted Sum
        score_series = (
            self.df.loc[eligible_mask, 'obscurity_raw'] * W_OBSCURITY + 
            self.df.loc[eligible_mask, 'gender_adj_raw'] * W_GENDER + 
            self.df.loc[eligible_mask, 'note_count_factor_raw'] * W_COUNT + 
            ('note_rarity_raw' in self.df.columns and self.df.loc[eligible_mask, 'note_rarity_raw']) * W_RARITY
        )
        
        # Normalize to 0-1 range if needed, but components are 0-1 already (mostly)
        self.df.loc[eligible_mask, 'xsolve_score'] = score_series.apply(clamp)

        # Log check
        logger.info(f"Calculated xSolve scores for {eligible_mask.sum()} eligible perfumes.")
        logger.info(f"Mean Score (Eligible): {self.df.loc[eligible_mask, 'xsolve_score'].mean():.4f}")
        logger.info(f"Non-eligible set to NULL: {(~eligible_mask).sum()} rows.")

    def _get_or_create_lookup(self, table: str, column: str, value: str, has_slug: bool = False) -> Optional[str]:
        """Simple cache-backed lookup/create for auxiliary tables."""
        if not value or str(value).lower() == 'unknown':
            return None
            
        norm_val = self.normalize_text(str(value)) # Ensure string
        if not norm_val:
            return None
            
        # Check cache
        if norm_val in self.db_cache[table]:
            return self.db_cache[table][norm_val]
        
        # Try finding in DB
        res = supabase.table(table).select('id').eq(column, value).limit(1).execute()
        if res.data:
            uuid = res.data[0]['id']
            self.db_cache[table][norm_val] = uuid
            return uuid
        
        # Create
        try:
            insert_data = {column: value}
            if has_slug:
                insert_data['slug'] = self.slugify(value)
                
            res = supabase.table(table).insert(insert_data).execute()
            if res.data:
                uuid = res.data[0]['id']
                self.db_cache[table][norm_val] = uuid
                return uuid
        except Exception as e:
            logger.warning(f"Failed to insert into {table}: {e}")
            # Try fetching again in case of race condition
            res = supabase.table(table).select('id').eq(column, value).limit(1).execute()
            if res.data:
                uuid = res.data[0]['id']
                self.db_cache[table][norm_val] = uuid
                return uuid
            
        return None

    def prepoulate_cache(self):
        """Pre-fetch existing lookups to minimize requests."""
        logger.info("Pre-populating caches...")
        for table, col in [('brands', 'name'), ('concentrations', 'name'), ('manufacturers', 'name')]:
            # Fetch all (careful with memory if HUGE, but usually these are small < 10k)
            # Pagination might be needed for production
            res = supabase.table(table).select(f'id, {col}').execute()
            for row in res.data:
                self.db_cache[table][self.normalize_text(row[col])] = row['id']

    def sync_to_supabase(self):
        logger.info("Syncing to Supabase...")
        self.prepoulate_cache()
        
        records_to_upsert = []
        
        for _, row in tqdm(self.df.iterrows(), total=len(self.df), desc="Processing Rows"):
            # 1. Resolve Dependencies
            brand_id = self._get_or_create_lookup('brands', 'name', row['Brand'], has_slug=True)
            conc_id = self._get_or_create_lookup('concentrations', 'name', row['Concentration'], has_slug=True)
            manuf_id = self._get_or_create_lookup('manufacturers', 'name', row['Manufacturer'], has_slug=False)

            
            if not brand_id:
                # Critical fail, skip this record or handle as conflict
                continue
                
            # 2. Build Perfume Record
            # Only essential fields + xSolve
            perfume_data = {
                'fingerprint_strict': row['fingerprint_strict'],
                'fingerprint_loose': row['fingerprint_loose'],
                'name': row['Name'],
                'brand_id': brand_id,
                'concentration_id': conc_id,
                'manufacturer_id': manuf_id,
                'release_year': int(row['Release Year']) if row['Release Year'] > 0 else None,
                'gender': row['Gender'] if row['Gender'] in ['Male', 'Female', 'Unisex'] else None,
                
                # NEW SCHEMA COLUMNS (Cleaned Lists)
                'top_notes': self._extract_list_cleaned(row['Top Notes']),
                'middle_notes': self._extract_list_cleaned(row['Middle Notes']),
                'base_notes': self._extract_list_cleaned(row['Base Notes']),
                'perfumers': self._extract_list_cleaned(row['Perfumers']),

                # EXCLUDED BY USER REQUEST:
                # 'image_url': row['Image URL'], 
                # 'rating_count': row['Rating Count'],
                # 'rating_value': row['Rating Value'],
                # 'main_accords': row['notes_list'],
                # 'origin_url': row['URL'],

                'xsolve_score': float(row['xsolve_score']) if pd.notnull(row['xsolve_score']) else None,
                'xsolve_model_version': XSOLVE_MODEL_VERSION,
                'is_active': bool(row['is_active']),
                # CRITICAL: is_uncertain affects eligible_perfumes view
                'is_uncertain': str(row['Is Uncertain']).lower() == 'true' if pd.notnull(row['Is Uncertain']) else False,
                'is_linear': str(row['Is Linear']).lower() == 'true' if pd.notnull(row['Is Linear']) else False,
                # Slugs are handled by DB triggers/functions usually, but we need source_slug
                # CRITICAL: Must include concentration for uniqueness (same brand/name/year with different concentrations)
                'source_record_slug': f"{self.normalize_text(row['Brand'])}-{self.normalize_text(row['Name'])}-{self.normalize_text(row['Concentration'])}-{self.normalize_text(str(row['Release Year']))}"[:250]
            }
            
            records_to_upsert.append(perfume_data)
            
            # Batch Insert/Upsert
            if len(records_to_upsert) >= BATCH_SIZE:
                self._batch_upsert(records_to_upsert)
                records_to_upsert = []

        # Flush remaining
        if records_to_upsert:
            self._batch_upsert(records_to_upsert)

    def _batch_upsert(self, records: List[Dict]):
        try:
            # Using fingerprint_strict as conflict target if possible, key constraint is needed
            # Schema says: UNIQUE NULLS NOT DISTINCT (brand_id, name, concentration_id, release_year)
            # But we also have fingerprint_strict.
            # Best is to rely on ON CONFLICT logic. Supabase-js/py defaults to upsert.
            # We must specify the column(s) that define conflict. 
            # If the schema doesn't have a UNIQUE constraint on fingerprint_strict, using it here won't work for UPSERT in same way.
            # Looking at schema.sql: UNIQUE NULLS NOT DISTINCT (brand_id, name, concentration_id, release_year)
            # We should probably map that.
            
            # For this MVP, we will try standard upsert.
            supabase.table('perfumes').upsert(records, on_conflict='brand_id,name,concentration_id,release_year', ignore_duplicates=False).execute()
        except Exception as e:
            logger.error(f"Batch upsert failed: {e}")
            # Fallback to single insert to isolate specific errors could be added here
            
    def run(self):
        self.load_and_clean_data()
        self.calculate_xsolve_score()
        self.sync_to_supabase()
        logger.info("ETL Pipeline completed successfully.")

if __name__ == "__main__":
    pipeline = ETLPipelineV5(os.path.join(os.path.dirname(__file__), '../data/dataset.csv'))
    pipeline.run()
