import argparse
import hashlib
import json
import logging
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import unquote

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from tqdm import tqdm

from supabase import Client, create_client

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("etl.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Constants
XSOLVE_MODEL_VERSION = 1
BATCH_SIZE = 100
ELIGIBLE_MIN_RATINGS = 400
KEPT_FIELDS = ["Brand", "Name", "Concentration", "Release Year", "Rating Count"]
LOOKUP_PAGE_SIZE = 1000  # PostgREST returns at most 1000 rows per request

# UTF-8 text decoded as CP1250 somewhere upstream: an i with circumflex arrives as U+0102 U+00AE
# (seen in the Concentration column of the source file in 2026-11). A lead character of such a
# pair followed by a Latin-1, Latin Extended or punctuation character marks a broken sequence.
_MOJIBAKE_LEADS = "".join(map(chr, (0x102, 0xC3, 0xC4, 0x139, 0xC5, 0xE2)))
_MOJIBAKE_TAILS = chr(0x80) + "-" + chr(0x2FF) + chr(0x2000) + "-" + chr(0x20FF)
MOJIBAKE = re.compile(f"[{_MOJIBAKE_LEADS}][{_MOJIBAKE_TAILS}]")
# Names the source spells differently from the product line.
E_ACUTE, E_MACRON, A_MACRON = chr(0xE9), chr(0x113), chr(0x101)
NAME_FIXES = {
    "SeeByChlo" + E_ACUTE: "See by Chlo" + E_ACUTE,
    # An e with a macron where the name has an e with an acute accent (2026-11 source file).
    "Est" + E_MACRON + "e": "Est" + E_ACUTE + "e",
    "Azur" + E_MACRON + "e": "Azur" + E_ACUTE + "e",
    "Olymp" + E_MACRON + "a": "Olymp" + E_ACUTE + "a",
    "M" + E_MACRON + "t" + A_MACRON + "l": "M" + E_ACUTE + "tal",
    "P" + E_MACRON + "trole": "P" + E_ACUTE + "trole",
    # A spreadsheet read the Lush name "25:43" as a time of day.
    "25:43:00": "25:43",
}


def _repair_token(match: re.Match[str]) -> str:
    token = match.group(0)
    try:
        return token.encode("cp1250").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return token


def repair_text(value: Any) -> Any:
    """Undo CP1250 mojibake and known misspelt names; anything that is not a string passes."""
    if not isinstance(value, str):
        return value
    repaired = MOJIBAKE.sub(_repair_token, value)
    for wrong, right in NAME_FIXES.items():
        repaired = repaired.replace(wrong, right)
    return repaired


# The source drops some variant words from Name and Concentration but keeps them at the end of
# the Parfumo address (".../Azzaro_pour_Homme_Eau_de_Toilette_Intense" is named "Azzaro pour
# Homme", "Eau de Toilette"). Address word -> display spelling; older addresses drop accented
# letters ("Extrme"), newer ones fold them ("extreme"). Only words seen as a trailing variant in
# the 2026-11 source file; anything else at the end of an address is left for manual review.
VARIANT_WORDS = {
    "intense": "Intense",
    "intensa": "Intensa",
    "concentree": "Concentrée",
    "fraiche": "Fraîche",
    "frache": "Fraîche",
    "legere": "Légère",
    "lgre": "Légère",
    "absolue": "Absolue",
    "elixir": "Elixir",
    "tendre": "Tendre",
    "poudree": "Poudrée",
    "rouge": "Rouge",
    "extreme": "Extrême",
    "extrme": "Extrême",
}
# One spelling per note and perfumer: guess feedback compares them across perfumes (measured on
# the 2026-11 catalogue; spellings that differ only in case are already equal there).
ITEM_SPELLINGS = {
    "Waterlily": "Water lily",
    "Nathalie Lawson": "Nathalie Lorson",
    "Nelly Hachem Ruiz": "Nelly Hachem-Ruiz",
}
PARFUMO_PERFUMES = "https://www.parfumo.com/Perfumes/"
MISSING_CONCENTRATION = "Unknown"


def _words(text: str) -> list[str]:
    return [word for word in re.split(r"[\W_]+", text) if word]


def _address_forms(word: str) -> set[str]:
    """How a name word can appear in an address: accents folded or accented letters dropped."""
    lower = word.lower()
    folded = "".join(c for c in unicodedata.normalize("NFD", lower) if not unicodedata.combining(c))
    dropped = "".join(c for c in lower if c.isascii())
    return {form for form in (folded, dropped) if form}


def _address_words(url: Any) -> list[str] | None:
    """Words of the perfume part of a Parfumo address (.../Perfumes/<brand>/<perfume>), or None."""
    if not isinstance(url, str) or not url.startswith(PARFUMO_PERFUMES):
        return None
    parts = url[len(PARFUMO_PERFUMES) :].strip("/").split("/")
    if len(parts) < 2:
        return None
    return _words(unquote(parts[-1]))


def _match_words(address: list[str], words: list[str], start: int) -> int | None:
    """Position after `words` matched in order from `start`, or None."""
    at = start
    for word in words:
        forms = _address_forms(word)
        if not forms:
            continue
        if at >= len(address) or address[at] not in forms:
            return None
        at += 1
    return at


# A spreadsheet turned some names into formula errors (Polish and English Excel spell them
# differently); the Parfumo address still holds the name. 27 rows in the 2026-11 source file.
SPREADSHEET_ERRORS = {"#NAZWA?", "#NAME?"}


def restore_broken_name(name: str, concentration: str, year: int, url: Any) -> tuple[str, int]:
    """Name rebuilt from the address when the source holds a spreadsheet error, and the year.

    The concentration is dropped from the address words, words in lower case get a capital, and a
    year equal to the number the name starts with (copied from the name, "1902") becomes unknown.
    Accents the address dropped stay lost.
    """
    words = _address_words(url) if name in SPREADSHEET_ERRORS else None
    if not words:
        return name, year
    if concentration and concentration != MISSING_CONCENTRATION:
        drop = [word.lower() for word in _words(concentration)]
        lower = [word.lower() for word in words]
        for start in range(len(words) - len(drop) + 1):
            if lower[start : start + len(drop)] == drop:
                words = words[:start] + words[start + len(drop) :]
                break
    if not words:
        return name, year
    rebuilt = " ".join(word if word != word.lower() else word.capitalize() for word in words)
    return rebuilt, 0 if words[0] == str(year) else year


def year_from_address(name: str, year: int, url: Any) -> int:
    """The year that follows the name in the address, when the source has none.

    Yearly limited editions ("Flowerbomb Limited Edition") carry their year only in the address;
    without it they share one key and deduplication keeps one of them. 562 rows in the 2026-11
    source file.
    """
    words = _address_words(url) if year <= 0 else None
    # A number after "No." or "#" is part of the name ("Green Tea No. 1900").
    if not words or re.search(r"(\bN[or]\.?|N" + chr(0xB0) + r"|#)\s*$", name):
        return year
    address = [word.lower() for word in words]
    after_name = _match_words(address, _words(name), 0)
    if after_name is None or after_name >= len(address):
        return year
    token = address[after_name]
    if len(token) == 4 and token.isdigit() and 1900 <= int(token) <= 2099:
        return int(token)
    return year


def restore_variant(name: str, concentration: str, year: int, url: Any) -> tuple[str, str]:
    """Name and concentration with the variant word(s) the source kept only in the address.

    The variant joins the concentration when it follows the concentration in the address
    ("Eau de Toilette Intense"), otherwise the name ("Body Intense").
    """
    words = _address_words(url)
    if words is None:
        return name, concentration
    address = [word.lower() for word in words]
    after_name = _match_words(address, _words(name), 0)
    if after_name is None:
        return name, concentration
    if year > 0 and after_name < len(address) and address[after_name] == str(year):
        after_name += 1
    after_concentration = None
    if concentration and concentration != MISSING_CONCENTRATION:
        after_concentration = _match_words(address, _words(concentration), after_name)
    joins_concentration = after_concentration is not None and after_concentration > after_name
    rest = address[after_concentration if joins_concentration else after_name :]
    while rest and rest[-1].isdigit():
        rest.pop()
    if not rest or any(word not in VARIANT_WORDS for word in rest):
        return name, concentration
    # "Ange ou Demon", "Eau de Toilette Tendre" at ".../Ange_ou_Demon_Tendre" lost nothing; when
    # only some of the words are already there, where the rest belongs is unclear.
    known = {form for word in _words(f"{name} {concentration}") for form in _address_forms(word)}
    if any(word in known for word in rest):
        return name, concentration
    variant = " ".join(VARIANT_WORDS[word] for word in rest)
    if joins_concentration:
        return name, f"{concentration} {variant}"
    return f"{name} {variant}", concentration


# Load Environment Variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Helper key for complete access

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def _first_id(data: Any) -> str | None:
    """The id of the first row of a PostgREST response, if there is one."""
    return str(data[0]["id"]) if data else None


# jscpd:ignore-start -- separate entry points that share no module
def _fetch_pages(table: str, columns: str) -> list[dict[str, Any]]:
    """All rows of a table, page by page; pages need a stable order or rows move between them."""
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        batch: Any = (
            supabase.table(table)
            .select(columns)
            .order("id")
            .range(start, start + LOOKUP_PAGE_SIZE - 1)
            .limit(LOOKUP_PAGE_SIZE)
            .execute()
            .data
        )
        rows.extend(batch or [])
        if not batch or len(batch) < LOOKUP_PAGE_SIZE:
            return rows
        start += LOOKUP_PAGE_SIZE


# jscpd:ignore-end


def _catalogue_key(
    brand: Any, name: Any, concentration: Any, year: Any
) -> tuple[str, str, str, int]:
    """The upsert key (brand, name, concentration, year), compared the way the import matches it."""

    def text(value: Any) -> str:
        return re.sub(r"\s+", " ", value.lower().strip()) if isinstance(value, str) else ""

    # The import finds a concentration label by its slug too ("After-Shave Lotion" is the stored
    # "After Shave Lotion"), so labels compare by slug.
    concentration_slug = re.sub(r"[^a-z0-9]+", "-", text(concentration)).strip("-")
    return (
        text(brand),
        text(name),
        "" if concentration_slug == MISSING_CONCENTRATION.lower() else concentration_slug,
        int(year) if year else 0,
    )


def compare_with_stored(
    source: list[dict[str, Any]], stored: list[dict[str, Any]]
) -> dict[str, Any]:
    """What an import would add, and which stored rows no source row matches any more.

    `source` rows have brand, name, concentration and year as the import would write them;
    `stored` rows are perfumes as read from the database, with id, is_active and is_uncertain.
    """
    source_keys = {
        _catalogue_key(r["brand"], r["name"], r["concentration"], r["year"]) for r in source
    }
    stored_keys = {
        _catalogue_key(r["brand"], r["name"], r["concentration"], r["year"]) for r in stored
    }
    new = [
        r
        for r in source
        if _catalogue_key(r["brand"], r["name"], r["concentration"], r["year"]) not in stored_keys
    ]
    unmatched = [
        r
        for r in stored
        if _catalogue_key(r["brand"], r["name"], r["concentration"], r["year"]) not in source_keys
    ]
    return {
        "matched": len(source_keys & stored_keys),
        "new": new,
        "unmatched_stored": unmatched,
        "unmatched_stored_active": sum(1 for r in unmatched if r["is_active"]),
        "unmatched_stored_certain": sum(1 for r in unmatched if not r["is_uncertain"]),
    }


def catalog_version(source: bytes) -> str:
    """Identifies the source file an import run read."""
    return "sha256:" + hashlib.sha256(source).hexdigest()


def find_duplicates(df: pd.DataFrame) -> "list[tuple[pd.Series[Any], pd.Series[Any]]]":
    """(kept, dropped) row pairs that keep-first deduplication by strict fingerprint resolves."""
    ranked = df.sort_values("Rating Count", ascending=False)
    dropped = ranked[ranked.duplicated("fingerprint_strict", keep="first")]
    kept = ranked.drop_duplicates("fingerprint_strict", keep="first").set_index(
        "fingerprint_strict", drop=False
    )
    return [(kept.loc[row["fingerprint_strict"]], row) for _, row in dropped.iterrows()]


class EtlPipeline:
    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.df = pd.DataFrame()
        self.db_cache: dict[str, dict[str, str]] = {
            "brands": {},
            "concentrations": {},
            "manufacturers": {},
        }
        self.failed_records = 0
        self.catalog_version = ""
        self.duplicates: list[tuple[pd.Series[Any], pd.Series[Any]]] = []

    def normalize_text(self, text: Any) -> str:
        """Lowercase, strip, single internal spaces."""
        if not isinstance(text, str):
            return ""
        text = text.lower().strip()
        return re.sub(r"\s+", " ", text)

    def generate_fingerprint_strict(
        self, brand: str, name: str, concentration: str, year: Any
    ) -> str:
        """SHA256(norm(Brand)|norm(Name)|norm(Concentration)|Year)"""
        norm_brand = self.normalize_text(brand)
        norm_name = self.normalize_text(name)
        norm_conc = self.normalize_text(concentration)

        # Handle Year
        try:
            year_val = str(int(float(year))) if pd.notnull(year) and year != "" else "0"
        except (TypeError, ValueError):
            year_val = "0"

        raw_str = f"{norm_brand}|{norm_name}|{norm_conc}|{year_val}"
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    def generate_fingerprint_loose(self, brand: str, name: str) -> str:
        """SHA256(norm(Brand)|norm(Name))"""
        norm_brand = self.normalize_text(brand)
        norm_name = self.normalize_text(name)
        raw_str = f"{norm_brand}|{norm_name}"
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    def slugify(self, text: str) -> str:
        """Simple slugify: lowercase, strip, replace non-alphanum with -"""
        text = self.normalize_text(text)
        text = re.sub(r"[^a-z0-9]+", "-", text)
        return text.strip("-")

    def load_and_clean_data(self) -> None:
        logger.info(f"Loading data from {self.csv_path}...")

        # Read with specific separation and decimal handling for the dataset
        self.df = pd.read_csv(self.csv_path, sep=";", decimal=",")

        logger.info(f"Loaded {len(self.df)} rows. Cleaning data...")

        # 1. Clean Column Names
        self.df.columns = [c.strip() for c in self.df.columns]

        # 1b. Repair broken encoding and known misspellings in every text column
        for column in self.df.select_dtypes(include="object").columns:
            self.df[column] = self.df[column].map(repair_text)

        # 2. Basic Conversions
        self.df["Release Year"] = (
            pd.to_numeric(self.df["Release Year"], errors="coerce").fillna(0).astype(int)
        )
        self.df["Rating Count"] = (
            pd.to_numeric(self.df["Rating Count"], errors="coerce").fillna(0).astype(int)
        )
        self.df["Rating Value"] = pd.to_numeric(self.df["Rating Value"], errors="coerce").fillna(
            0.0
        )

        # 3. Missing Values
        self.df["Brand"] = self.df["Brand"].fillna("Unknown")
        self.df["Name"] = self.df["Name"].fillna("Unknown")
        self.df["Concentration"] = self.df["Concentration"].fillna(MISSING_CONCENTRATION)
        self.df["Manufacturer"] = self.df["Manufacturer"].fillna("Unknown")

        # 3b. What the source kept only in the address, before fingerprints tell rows apart: names a
        # spreadsheet turned into formula errors, missing years, then variant words dropped from
        # the name
        names, concentrations, years = [], [], []
        for name, concentration, year, url in zip(
            self.df["Name"],
            self.df["Concentration"],
            self.df["Release Year"],
            self.df["URL"],
            strict=True,
        ):
            name, year = restore_broken_name(name, concentration, year, url)
            year = year_from_address(name, year, url)
            name, concentration = restore_variant(name, concentration, year, url)
            names.append(name)
            concentrations.append(concentration)
            years.append(year)
        self.df["Name"] = names
        self.df["Concentration"] = concentrations
        self.df["Release Year"] = years

        # 4. Generate Fingerprints
        logger.info("Generating fingerprints...")
        self.df["fingerprint_strict"] = self.df.apply(
            lambda x: self.generate_fingerprint_strict(
                x["Brand"], x["Name"], x["Concentration"], x["Release Year"]
            ),
            axis=1,
        )
        self.df["fingerprint_loose"] = self.df.apply(
            lambda x: self.generate_fingerprint_loose(x["Brand"], x["Name"]), axis=1
        )

        # 5. Deduplication (Group by fingerprint_strict)
        logger.info("Deduplicating...")
        initial_len = len(self.df)
        self.catalog_version = catalog_version(Path(self.csv_path).read_bytes())
        self.duplicates = find_duplicates(self.df)

        # Key Aggregation Logic:
        # - Rating Count: max
        # - Notes/Accords: combine (simple string concatenation for now, ideal would be set union)
        # - Others: first
        self.df = self.df.sort_values("Rating Count", ascending=False).drop_duplicates(
            "fingerprint_strict", keep="first"
        )

        logger.info(
            f"Deduplication removed {initial_len - len(self.df)} rows. "
            f"Current count: {len(self.df)}"
        )

    def _clean_note(self, note_text: str) -> str:
        """Clean individual note text removing marketing terms."""
        if not note_text:
            return ""
        t = str(note_text).strip()

        # 1. Remove Special Characters
        t = re.sub(r"[™®]", "", t)

        # 2. Remove Specific Prefixes
        t = re.sub(r"\bLa Réunion\b", "", t, flags=re.IGNORECASE)

        # 3. Remove marketing qualifiers / Suffixes
        # List merging User findings + Standard noise
        remove_words = [
            # User defined
            "absolute",
            "scenttrek",
            "orpur",
            "co2",
            "concrete",
            "otto",
            "nectar",
            "material",
            "resinoid",
            "oxide",
        ]

        # Sort by length to ensure longer phrases match first
        remove_words.sort(key=len, reverse=True)

        # Compiled pattern
        pattern = re.compile(
            r"\b(" + "|".join(map(re.escape, remove_words)) + r")\b", re.IGNORECASE
        )
        t = pattern.sub("", t)

        # Remove parentheses content
        t = re.sub(r"\(.*?\)", "", t)

        # Collapse spaces and remove punctuation
        t = re.sub(r"\s+", " ", t).strip()
        t = re.sub(r"[,\-]$", "", t).strip()
        return t

    def _extract_list_cleaned(self, text_blob: Any) -> list[str]:
        """Extract lists from CSV string and clean each item."""
        if pd.isna(text_blob) or text_blob == "":
            return []
        # Split by comma
        items = [s.strip() for s in str(text_blob).split(",") if s.strip()]
        # Clean each item using the robust cleaner, then use one spelling per note or person
        cleaned = [ITEM_SPELLINGS.get(c, c) for c in (self._clean_note(i) for i in items)]
        # Remove empty strings and duplicates while preserving order
        final: list[str] = []
        seen: set[str] = set()
        for c in cleaned:
            if c and c not in seen:
                final.append(c)
                seen.add(c)
        return final

    def calculate_xsolve_score(self) -> None:
        logger.info("Calculating xSolve scores...")

        # Helper for note cleaning

        # Prepare columns required for stats
        self.df["gender_norm"] = self.df["Gender"].apply(self.normalize_text)

        # --- 0. Construct Full Note Pyramid for Stats ---
        # User Rule: Use notes (Top/Mid/Base) for stats, not just Main Accords.
        # Compute this for ALL perfumes first.

        def get_all_notes(row: "pd.Series[Any]") -> list[str]:
            # Combine Top, Middle, Base
            all_n: list[str] = []
            for col in ["Top Notes", "Middle Notes", "Base Notes"]:
                val = row.get(col)
                if pd.notnull(val):
                    all_n.extend(self._extract_list_cleaned(val))
            return all_n

        logger.info("Extracting note pyramids...")
        self.df["notes_list"] = self.df.apply(get_all_notes, axis=1)

        # Fallback to Main Accords if pyramid is empty
        mask_no_notes = self.df["notes_list"].apply(len) == 0
        if mask_no_notes.any():
            self.df.loc[mask_no_notes, "notes_list"] = (
                self.df.loc[mask_no_notes, "Main Accords"]
                .fillna("")
                .astype(str)
                .apply(lambda x: [self._clean_note(s) for s in x.split(",") if self._clean_note(s)])
            )

        self.df["note_count"] = self.df["notes_list"].apply(len)

        # --- Base Population for Difficulty (Eligible Only) ---
        # User Rule: "Obliczaj xSolve tylko dla eligible (Rating >= 400)"
        eligible_mask = self.df["Rating Count"] >= ELIGIBLE_MIN_RATINGS

        if eligible_mask.sum() < 50:
            logger.warning(
                f"Only {eligible_mask.sum()} eligible perfumes (>={ELIGIBLE_MIN_RATINGS} ratings)."
            )

        df_stats = self.df[eligible_mask]
        logger.info(f"Eligible population for xSolve scoring: {len(df_stats)} perfumes")

        # --- Component 1: Obscurity Bonus (Global Rarity) ---
        # Log-scale rarity
        p99_rating = max(np.percentile(df_stats["Rating Count"], 99), 1)  # Avoid div 0

        # Calculate for ELIGIBLE rows only (others will be NULL)

        # Initialize column with NaN
        self.df["obscurity_raw"] = np.nan

        # Apply score only to eligible rows
        self.df.loc[eligible_mask, "obscurity_raw"] = 1.0 - (
            np.log1p(np.minimum(self.df.loc[eligible_mask, "Rating Count"], p99_rating))
            / np.log1p(p99_rating)
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
        # We calculate the percentile score of each perfume's rating against the Eligible
        # distribution of that gender.

        gender_ratings: dict[str, np.ndarray[Any, Any]] = {}
        for g in ["Male", "Female", "Unisex"]:
            g_norm = self.normalize_text(g)
            # Get ratings of eligible perfumes for this gender
            # Note: df_stats is the eligible subset
            ratings = df_stats[df_stats["gender_norm"] == g_norm]["Rating Count"].to_numpy()
            gender_ratings[g_norm] = np.sort(ratings)

        def get_gender_rarity(row: "pd.Series[Any]") -> float:
            g = row["gender_norm"]
            r = row["Rating Count"]
            if g not in gender_ratings or len(gender_ratings[g]) == 0:
                return 0.5  # Default

            # Find position of r in sorted eligible ratings
            # If r is smaller than all eligible (e.g. 1 vote), it's index 0 -> rarity 1.0
            # (very obscure)
            # If r is larger than all, it's index len -> rarity 0.0 (very popular)
            idx = np.searchsorted(gender_ratings[g], r)
            n = len(gender_ratings[g])
            pct = idx / n
            return float(1.0 - pct)

        self.df["gender_adj_raw"] = np.nan
        self.df.loc[eligible_mask, "gender_adj_raw"] = self.df.loc[eligible_mask].apply(
            get_gender_rarity, axis=1
        )

        # Note: Note Count is calculated for ALL, but we only score eligible
        max_notes = self.df["note_count"].max()
        if max_notes == 0:
            max_notes = 1

        self.df["note_count_factor_raw"] = np.nan
        self.df.loc[eligible_mask, "note_count_factor_raw"] = np.log1p(
            self.df.loc[eligible_mask, "note_count"]
        ) / np.log1p(max_notes)

        # --- Component 4: Note Rarity (Complexity) ---
        # Calculated on ALL data (as requested)
        all_notes = [note for sublist in self.df["notes_list"] for note in sublist]
        total_occurrences = len(all_notes)
        if total_occurrences > 0:
            note_counts = pd.Series(all_notes).value_counts()
            note_freqs = note_counts / total_occurrences

            # Calculate average rarity
            def get_avg_rarity(notes: list[str]) -> float:
                if not notes:
                    return 0.0
                rarities = [1.0 - note_freqs.get(n, 0.0) for n in notes]
                return float(np.mean(rarities))

            # Calculate average rarity for ALL (metrics) but score only for ELIGIBLE
            self.df["avg_note_rarity"] = self.df["notes_list"].apply(get_avg_rarity)

            # Normalize against p95 of ALL data (owner rule: the whole dataset counts in this
            # calculation)
            p95_rarity = np.percentile(self.df["avg_note_rarity"], 95)

            self.df["note_rarity_raw"] = np.nan
            # Vectorized operation instead of apply with lambda
            if p95_rarity > 0:
                normalized_values = self.df.loc[eligible_mask, "avg_note_rarity"] / p95_rarity
                self.df.loc[eligible_mask, "note_rarity_raw"] = normalized_values.clip(0, 1)
            else:
                self.df.loc[eligible_mask, "note_rarity_raw"] = 0.0
        else:
            self.df["note_rarity_raw"] = np.nan

        # Weights
        W_OBSCURITY = 0.40
        W_GENDER = 0.30
        W_COUNT = 0.15
        W_RARITY = 0.15

        def clamp(x: Any) -> float:
            return max(0.0, min(1.0, float(x)))

        # --- Set is_active ---
        # Rule: Technical validity only (Name + Brand + URL exists)
        # Eligibility for the game (verified, image, notes, score) is checked by the daily cron

        # We need to ensure Name and Brand are not 'Unknown' or empty, and URL is present
        # Normalize first to check for 'unknown'
        self.df["is_active"] = (
            (self.df["Name"].str.lower() != "unknown")
            & (self.df["Name"].str.strip() != "")
            & (self.df["Brand"].str.lower() != "unknown")
            & (self.df["Brand"].str.strip() != "")
            & (self.df["URL"].notnull())
            & (self.df["URL"].str.strip() != "")
        )

        self.df["xsolve_score"] = np.nan

        # Calculate Final Score for ELIGIBLE rows
        # Weighted Sum
        score_series = (
            self.df.loc[eligible_mask, "obscurity_raw"] * W_OBSCURITY
            + self.df.loc[eligible_mask, "gender_adj_raw"] * W_GENDER
            + self.df.loc[eligible_mask, "note_count_factor_raw"] * W_COUNT
            + (
                "note_rarity_raw" in self.df.columns
                and self.df.loc[eligible_mask, "note_rarity_raw"]
            )
            * W_RARITY
        )

        # Normalize to 0-1 range if needed, but components are 0-1 already (mostly)
        self.df.loc[eligible_mask, "xsolve_score"] = score_series.apply(clamp)

        # Log check
        logger.info(f"Calculated xSolve scores for {eligible_mask.sum()} eligible perfumes.")
        logger.info(
            f"Mean Score (Eligible): {self.df.loc[eligible_mask, 'xsolve_score'].mean():.4f}"
        )
        logger.info(f"Non-eligible set to NULL: {(~eligible_mask).sum()} rows.")

    def _get_or_create_lookup(
        self, table: str, column: str, value: str, has_slug: bool = False
    ) -> str | None:
        """Simple cache-backed lookup/create for auxiliary tables."""
        if not value or str(value).lower() == "unknown":
            return None

        norm_val = self.normalize_text(str(value))  # Ensure string
        if not norm_val:
            return None

        # Check cache
        if norm_val in self.db_cache[table]:
            return self.db_cache[table][norm_val]

        def find_existing() -> str | None:
            res = supabase.table(table).select("id").eq(column, value).limit(1).execute()
            uuid = _first_id(res.data)
            # Names that differ only in accents or punctuation share a slug, which is unique.
            if not uuid and has_slug:
                slug = self.slugify(value)
                res = supabase.table(table).select("id").eq("slug", slug).limit(1).execute()
                uuid = _first_id(res.data)
            if uuid:
                self.db_cache[table][norm_val] = uuid
            return uuid

        # Try finding in DB
        if uuid := find_existing():
            return uuid

        # Create
        try:
            insert_data = {column: value}
            if has_slug:
                insert_data["slug"] = self.slugify(value)

            res = supabase.table(table).insert(insert_data).execute()
            if uuid := _first_id(res.data):
                self.db_cache[table][norm_val] = uuid
                return uuid
        except Exception as e:
            logger.warning(f"Failed to insert into {table}: {e}")
            # Try fetching again in case of race condition
            if uuid := find_existing():
                return uuid

        # A real value that could not be stored: the caller must not save the perfume without it.
        raise LookupError(f"Could not find or create {table} row for {value!r}")

    def prepopulate_cache(self) -> None:
        """Pre-fetch existing lookups to minimize requests."""
        logger.info("Pre-populating caches...")
        for table, col in [
            ("brands", "name"),
            ("concentrations", "name"),
            ("manufacturers", "name"),
        ]:
            for row in _fetch_pages(table, f"id, {col}"):
                self.db_cache[table][self.normalize_text(row[col])] = row["id"]

    def _record_import(self) -> None:
        """Store the run and the duplicates that keep-first deduplication dropped."""
        try:
            run: Any = (
                supabase.table("import_runs")
                .insert({"catalog_version": self.catalog_version})
                .execute()
                .data
            )
            run_id = run[0]["id"]
        except Exception as e:
            raise RuntimeError(f"Could not record the import run: {e}") from e

        recorded = 0
        for start in range(0, len(self.duplicates), BATCH_SIZE):
            batch = self.duplicates[start : start + BATCH_SIZE]
            try:
                raw_rows: Any = (
                    supabase.table("raw_import_rows")
                    .insert(
                        [
                            {
                                "import_run_id": run_id,
                                "brand_raw": dropped["Brand"],
                                "name_raw": dropped["Name"],
                                "concentration_raw": dropped["Concentration"],
                                "release_year": int(dropped["Release Year"]),
                                "fp_strict": dropped["fingerprint_strict"],
                                "fp_loose": dropped["fingerprint_loose"],
                                "raw_json": json.loads(dropped.to_json()),
                            }
                            for _, dropped in batch
                        ]
                    )
                    .execute()
                    .data
                )
                supabase.table("import_conflicts").insert(
                    [
                        {
                            "import_run_id": run_id,
                            "raw_row_id": raw["id"],
                            "conflict_type": "duplicate_strict_fingerprint",
                            "details": {
                                **json.loads(kept[KEPT_FIELDS].to_json()),
                                "dropped_rating_count": int(dropped["Rating Count"]),
                            },
                        }
                        for raw, (kept, dropped) in zip(raw_rows, batch, strict=True)
                    ]
                ).execute()
                recorded += len(batch)
            except Exception as e:
                logger.error(f"Recording duplicate conflicts failed: {e}")
                self.failed_records += len(batch)
        logger.info(f"Import run {run_id}: recorded {recorded} duplicate conflicts.")

    def sync_to_supabase(self) -> None:
        logger.info("Syncing to Supabase...")
        self._record_import()
        self.prepopulate_cache()

        records_to_upsert: list[dict[str, Any]] = []
        # Spellings of one label can resolve to one concentration row, so two source rows may share
        # the upsert key; one statement must not touch a row twice. Rows come most-rated first.
        saved_keys: set[tuple[Any, ...]] = set()

        for _, row in tqdm(self.df.iterrows(), total=len(self.df), desc="Processing Rows"):
            # 1. Resolve Dependencies (None means the source has no value)
            try:
                brand_id = self._get_or_create_lookup("brands", "name", row["Brand"], has_slug=True)
                conc_id = self._get_or_create_lookup(
                    "concentrations", "name", row["Concentration"], has_slug=True
                )
                manuf_id = self._get_or_create_lookup(
                    "manufacturers", "name", row["Manufacturer"], has_slug=False
                )
            except LookupError as e:
                logger.error(f"Skipping {row['Brand']} {row['Name']}: {e}")
                self.failed_records += 1
                continue

            if not brand_id:
                # No brand in the source: deliberately not imported
                continue

            # 2. Build Perfume Record
            # Only essential fields + xSolve
            perfume_data = {
                "fingerprint_strict": row["fingerprint_strict"],
                "fingerprint_loose": row["fingerprint_loose"],
                "name": row["Name"],
                "brand_id": brand_id,
                "concentration_id": conc_id,
                "manufacturer_id": manuf_id,
                "release_year": int(row["Release Year"]) if row["Release Year"] > 0 else None,
                "gender": row["Gender"] if row["Gender"] in ["Male", "Female", "Unisex"] else None,
                # NEW SCHEMA COLUMNS (Cleaned Lists)
                "top_notes": self._extract_list_cleaned(row["Top Notes"]),
                "middle_notes": self._extract_list_cleaned(row["Middle Notes"]),
                "base_notes": self._extract_list_cleaned(row["Base Notes"]),
                "perfumers": self._extract_list_cleaned(row["Perfumers"]),
                # EXCLUDED BY USER REQUEST:
                # 'image_url': row['Image URL'],
                # 'rating_count': row['Rating Count'],
                # 'rating_value': row['Rating Value'],
                # 'main_accords': row['notes_list'],
                # 'origin_url': row['URL'],
                "xsolve_score": float(row["xsolve_score"])
                if pd.notnull(row["xsolve_score"])
                else None,
                "xsolve_model_version": XSOLVE_MODEL_VERSION,
                "is_active": bool(row["is_active"]),
                # CRITICAL: the daily cron draws only perfumes with is_uncertain = false
                "is_uncertain": str(row["Is Uncertain"]).lower() == "true"
                if pd.notnull(row["Is Uncertain"])
                else False,
                "is_linear": str(row["Is Linear"]).lower() == "true"
                if pd.notnull(row["Is Linear"])
                else False,
                # Slugs are handled by DB triggers/functions usually, but we need source_slug
                # CRITICAL: Must include concentration for uniqueness (same brand/name/year with
                # different concentrations)
                "source_record_slug": "-".join(
                    self.normalize_text(value)
                    for value in (
                        row["Brand"],
                        row["Name"],
                        row["Concentration"],
                        str(row["Release Year"]),
                    )
                )[:250],
            }

            key = (brand_id, row["Name"], conc_id, perfume_data["release_year"])
            if key in saved_keys:
                logger.warning(f"Skipping {row['Brand']} {row['Name']}: same key as a saved row")
                continue
            saved_keys.add(key)
            records_to_upsert.append(perfume_data)

            # Batch Insert/Upsert
            if len(records_to_upsert) >= BATCH_SIZE:
                self._batch_upsert(records_to_upsert)
                records_to_upsert = []

        # Flush remaining
        if records_to_upsert:
            self._batch_upsert(records_to_upsert)

    def _batch_upsert(self, records: list[dict[str, Any]]) -> None:
        try:
            # Using fingerprint_strict as conflict target if possible, key constraint is needed
            # Schema says: UNIQUE NULLS NOT DISTINCT (brand_id, name, concentration_id,
            # release_year)
            # But we also have fingerprint_strict.
            # Best is to rely on ON CONFLICT logic. Supabase-js/py defaults to upsert.
            # We must specify the column(s) that define conflict.
            # If the schema doesn't have a UNIQUE constraint on fingerprint_strict, using it here
            # won't work for UPSERT in same way.
            # The production baseline migration defines unique_perfume:
            # UNIQUE NULLS NOT DISTINCT (brand_id, name, concentration_id, release_year)
            # We should probably map that.

            # For this MVP, we will try standard upsert.
            supabase.table("perfumes").upsert(
                records,
                on_conflict="brand_id,name,concentration_id,release_year",
                ignore_duplicates=False,
            ).execute()
        except Exception as e:
            logger.error(f"Batch upsert failed: {e}")
            self.failed_records += len(records)

    def dry_run(self, report_path: str) -> dict[str, int]:
        """Compare the source with the stored catalogue and write a JSON report; writes no row."""
        self.load_and_clean_data()
        columns = (
            "id, name, release_year, is_active, is_uncertain, brands(name), concentrations(name)"
        )
        stored = [
            {
                "id": row["id"],
                "brand": (row.get("brands") or {}).get("name"),
                "name": row["name"],
                "concentration": (row.get("concentrations") or {}).get("name"),
                "year": row["release_year"],
                "is_active": row["is_active"],
                "is_uncertain": row["is_uncertain"],
            }
            for row in _fetch_pages("perfumes", columns)
        ]
        source = [
            {"brand": brand, "name": name, "concentration": concentration, "year": int(year)}
            for brand, name, concentration, year in zip(
                self.df["Brand"],
                self.df["Name"],
                self.df["Concentration"],
                self.df["Release Year"],
                strict=True,
            )
        ]
        report = compare_with_stored(source, stored)
        summary = {
            key: len(value) if isinstance(value, list) else value for key, value in report.items()
        }
        Path(report_path).write_text(
            json.dumps({"summary": summary, **report}, ensure_ascii=False, indent=1, default=str),
            encoding="utf-8",
        )
        logger.info(f"Dry run, nothing written to the database: {summary}")
        return summary

    def run(self) -> None:
        self.load_and_clean_data()
        self.calculate_xsolve_score()
        self.sync_to_supabase()
        if self.failed_records:
            logger.error(f"ETL Pipeline finished with {self.failed_records} records not saved.")
            raise SystemExit(1)
        logger.info("ETL Pipeline completed successfully.")


if __name__ == "__main__":
    # The source file is not part of this repository; its location is given on every run.
    parser = argparse.ArgumentParser(description="Import the perfume source file into Supabase.")
    parser.add_argument("csv_path", help="semicolon-separated source file with a header row")
    parser.add_argument(
        "--dry-run",
        metavar="REPORT",
        help="compare the source with the database and write a JSON report; writes nothing",
    )
    args = parser.parse_args()
    pipeline = EtlPipeline(args.csv_path)
    if args.dry_run:
        pipeline.dry_run(args.dry_run)
    else:
        pipeline.run()
