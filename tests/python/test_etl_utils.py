import os
import sys
from pathlib import Path
from typing import Any
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


def test_list_items_use_one_spelling(etl: EtlPipeline) -> None:
    # The game compares notes and perfumers across guesses: one spelling per note or person.
    assert etl._extract_list_cleaned("Waterlily, Rose") == ["Water lily", "Rose"]
    assert etl._extract_list_cleaned("Nathalie Lawson") == ["Nathalie Lorson"]
    assert etl._extract_list_cleaned("Nelly Hachem Ruiz") == ["Nelly Hachem-Ruiz"]
    assert etl._extract_list_cleaned("Water lily, Waterlily") == ["Water lily"]


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


@pytest.mark.parametrize(
    ("broken", "fixed"),
    [
        # The source writes an e with a macron where the name has an e with an acute accent.
        ("Estēe Lauder", "Estée Lauder"),
        ("Very Estēe", "Very Estée"),
        ("Azurēe Soleil", "Azurée Soleil"),
        ("Olympēa Intense", "Olympéa Intense"),
        ("Mētāl Eau de Mētāl", "Métal Eau de Métal"),
        ("Volkswagen - Mémoire de Pētrole", "Volkswagen - Mémoire de Pétrole"),
        # A spreadsheet read the Lush name "25:43" as a time of day.
        ("25:43:00", "25:43"),
        # The Possets name "3:5:8" (owner review 2026-11-26).
        ("03:05:08", "3:5:8"),
        # Latvian names keep their macrons.
        ("Art Elēģija", "Art Elēģija"),
    ],
)
def test_repair_text_fixes_names_the_source_misspells(broken: str, fixed: str) -> None:
    assert etl_module.repair_text(broken) == fixed


def test_repair_text_restores_the_see_by_chloe_name() -> None:
    assert etl_module.repair_text("SeeByChlo\u00e9 Si Belle") == "See by Chlo\u00e9 Si Belle"


PARFUMO = "https://www.parfumo.com/Perfumes/"


@pytest.mark.parametrize(
    ("name", "concentration", "year", "url", "expected"),
    [
        # The variant follows the concentration in the address: it belongs to the concentration.
        (
            "Azzaro pour Homme",
            "Eau de Toilette",
            1992,
            PARFUMO + "Azzaro/Azzaro_pour_Homme_Eau_de_Toilette_Intense",
            ("Azzaro pour Homme", "Eau de Toilette Intense"),
        ),
        (
            "Libre",
            "Eau de Parfum",
            2020,
            PARFUMO + "Yves_Saint_Laurent/libre-eau-de-parfum-intense",
            ("Libre", "Eau de Parfum Intense"),
        ),
        (
            "L'Interdit",
            "Eau de Parfum",
            2021,
            PARFUMO + "Givenchy/l-interdit-eau-de-parfum-rouge",
            ("L'Interdit", "Eau de Parfum Rouge"),
        ),
        # Accents dropped or folded in the address still match the name.
        (
            "Allure Homme Édition Blanche",
            "Eau de Toilette",
            2008,
            PARFUMO + "Chanel/Allure_Homme_Edition_Blanche_Eau_de_Toilette_Concentree",
            ("Allure Homme Édition Blanche", "Eau de Toilette Concentrée"),
        ),
        # No concentration in the address: the variant belongs to the name.
        (
            "Body",
            "Eau de Parfum",
            2011,
            PARFUMO + "Burberry/Body_Intense",
            ("Body Intense", "Eau de Parfum"),
        ),
        # The address may repeat the year before the concentration.
        (
            "Sì",
            "Eau de Parfum",
            2014,
            PARFUMO + "Giorgio_Armani/si-2014-eau-de-parfum-intense",
            ("Sì", "Eau de Parfum Intense"),
        ),
    ],
)
def test_restore_variant_takes_the_variant_from_the_source_address(
    name: str, concentration: str, year: int, url: str, expected: tuple[str, str]
) -> None:
    assert etl_module.restore_variant(name, concentration, year, url) == expected


@pytest.mark.parametrize(
    ("name", "concentration", "url"),
    [
        # Nothing after the name and concentration.
        ("Body", "Eau de Parfum", PARFUMO + "Burberry/Body"),
        # A translated concentration is not a variant.
        ("Aromatics Elixir", "Parfum", PARFUMO + "Clinique/Aromatics_Elixir_Perfume"),
        # Words that are not known variants, or a reordered name, stay for manual review.
        ("Boss Man", "Eau de Toilette", PARFUMO + "Hugo_Boss/Boss_Orange_Man"),
        (
            "Colonia Oud",
            "Eau de Cologne",
            PARFUMO + "Acqua_di_Parma/Colonia_Oud_Colonia_Intensa_Oud",
        ),
        ("Glow", "", PARFUMO + "Jennifer_Lopez/Glow_by_J_Lo"),
        # The variant is already part of the name or of the concentration.
        ("Body Intense", "Eau de Parfum", PARFUMO + "Burberry/Body_Intense"),
        ("Ange ou Démon", "Eau de Toilette Tendre", PARFUMO + "Givenchy/Ange_ou_Demon_Tendre"),
        ("Trésor", "Elixir de Parfum", PARFUMO + "Lancome/Tresor_Elixir"),
        # Partly known: which field the rest belongs to is unclear, so it is left for review.
        ("Body", "Eau de Parfum Intense", PARFUMO + "Burberry/Body_Intense_Extreme"),
        # Not a Parfumo address.
        ("Body", "Eau de Parfum", "https://example.com/Body_Intense"),
        ("Body", "Eau de Parfum", None),
    ],
)
def test_restore_variant_keeps_rows_without_a_known_trailing_variant(
    name: str, concentration: str, url: object
) -> None:
    assert etl_module.restore_variant(name, concentration, 2011, url) == (name, concentration)


def test_restore_variant_treats_an_unknown_concentration_as_none() -> None:
    url = PARFUMO + "Burberry/Body_Intense"

    assert etl_module.restore_variant("Body", "Unknown", 0, url) == ("Body Intense", "Unknown")


@pytest.mark.parametrize(
    ("concentration", "year", "url", "expected"),
    [
        # The concentration inside the address is not part of the name; the year the spreadsheet
        # copied from the name ("1902") is not the release year.
        (
            "Eau de Cologne",
            1902,
            PARFUMO + "Berdoues/1902_Eau_de_Cologne_Tradition_Gingembre_Vert",
            ("1902 Tradition Gingembre Vert", 0),
        ),
        (
            "Hair Perfume",
            1996,
            PARFUMO + "Byredo/1996-inez-vinoodh-hair-perfume",
            ("1996 Inez Vinoodh", 0),
        ),
        (
            "Solid Perfume",
            1948,
            PARFUMO + "Sweet_Anthem/1948__Beginnings_Solid_Perfume",
            ("1948 Beginnings", 0),
        ),
        (
            "Unknown",
            2022,
            PARFUMO + "M__Asam/2022-magnificent-magnolia",
            ("2022 Magnificent Magnolia", 0),
        ),
        # No number at the start: the year stays.
        ("Unknown", 2018, PARFUMO + "AlexandreJ/_E_2", ("E 2", 2018)),
    ],
)
def test_restore_broken_name_rebuilds_a_spreadsheet_error_from_the_address(
    concentration: str, year: int, url: str, expected: tuple[str, int]
) -> None:
    assert etl_module.restore_broken_name("#NAZWA?", concentration, year, url) == expected
    assert etl_module.restore_broken_name("#NAME?", concentration, year, url) == expected


@pytest.mark.parametrize(
    ("name", "year", "url", "expected"),
    [
        # Yearly editions carry the year only in the address.
        (
            "Flowerbomb Limited Edition",
            0,
            PARFUMO + "Viktor_Rolf/Flowerbomb_Limited_Edition_2015",
            2015,
        ),
        ("212 Splash", 0, PARFUMO + "Carolina_Herrera/212_Splash_2008", 2008),
        ("Sì", 0, PARFUMO + "Giorgio_Armani/si-2014-eau-de-parfum-intense", 2014),
        # A known year stays.
        ("212 Splash", 2007, PARFUMO + "Carolina_Herrera/212_Splash_2008", 2007),
        # A number in the name, or one outside 1900-2099, is not a year.
        ("1902 Coton", 0, PARFUMO + "Berdoues/1902-coton", 0),
        ("Bleu", 0, PARFUMO + "Brand/Bleu_1234", 0),
        # A number after "No." is part of the name ("Green Tea No. 1900").
        ("Green Tea No.", 0, PARFUMO + "C_O_Bigelow/Green_Tea_No_1900", 0),
        ("Rose N°", 0, PARFUMO + "Brand/Rose_N_1925", 0),
        # The name does not open the address.
        ("Other", 0, PARFUMO + "Brand/Something_2015", 0),
        ("Bleu", 0, None, 0),
    ],
)
def test_year_from_address(name: str, year: int, url: object, expected: int) -> None:
    assert etl_module.year_from_address(name, year, url) == expected


def test_restore_broken_name_keeps_real_names_and_rows_without_an_address() -> None:
    url = PARFUMO + "Berdoues/1902_Eau_de_Cologne_Tradition_Violette"

    assert etl_module.restore_broken_name("Violette", "Eau de Cologne", 1902, url) == (
        "Violette",
        1902,
    )
    # An address that ends at the brand holds no perfume name.
    assert etl_module.restore_broken_name("#NAZWA?", "Unknown", 1902, PARFUMO + "Berdoues/") == (
        "#NAZWA?",
        1902,
    )
    assert etl_module.restore_broken_name("#NAZWA?", "Eau de Cologne", 1902, None) == (
        "#NAZWA?",
        1902,
    )


def test_load_keeps_a_variant_the_source_named_like_its_base(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    source.write_text(
        "Name;Brand;Release Year;Concentration;Rating Value;Rating Count;Manufacturer;URL\n"
        f"Body;Burberry;2011;Eau de Parfum;7,1;900;;{PARFUMO}Burberry/Body\n"
        f"Body;Burberry;2011;Eau de Parfum;7,4;300;;{PARFUMO}Burberry/Body_Intense\n",
        encoding="utf-8",
    )
    pipeline = EtlPipeline(str(source))

    pipeline.load_and_clean_data()

    assert sorted(pipeline.df["Name"]) == ["Body", "Body Intense"]
    assert pipeline.duplicates == []


def test_load_uses_the_current_name_of_a_renamed_brand(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    source.write_text(
        "Name;Brand;Release Year;Concentration;Rating Value;Rating Count;Manufacturer;URL\n"
        f"Admire;Hamidi;;;7,1;9;;{PARFUMO}hamidi/admire\n"
        f"Abaq;Hamidi Oud & Perfumes;;;7,1;9;;{PARFUMO}Hamidi_Oud__Perfumes/abaq\n",
        encoding="utf-8",
    )
    pipeline = EtlPipeline(str(source))

    pipeline.load_and_clean_data()

    # Exact names only: the current name is not renamed again.
    assert set(pipeline.df["Brand"]) == {"Hamidi Oud & Perfumes"}


@pytest.mark.filterwarnings("error")
def test_load_repairs_text_without_pandas_deprecations(tmp_path: Path) -> None:
    # pandas 4 stops selecting text columns as "object"; the repair must still reach them.
    source = tmp_path / "source.csv"
    broken = "Eau Fra" + chr(0x102) + chr(0xAE) + "che"
    source.write_text(
        "Name;Brand;Release Year;Concentration;Rating Value;Rating Count;Manufacturer;URL\n"
        f"Sauvage;Dior;2015;{broken};7,1;900;;{PARFUMO}Dior/Sauvage\n",
        encoding="utf-8",
    )
    pipeline = EtlPipeline(str(source))

    pipeline.load_and_clean_data()

    assert list(pipeline.df["Concentration"]) == ["Eau Fra" + chr(0xEE) + "che"]
    assert list(pipeline.df["Manufacturer"]) == ["Unknown"]


def test_load_keeps_spreadsheet_errors_apart(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    row = (
        "#NAZWA?;Berdoues;1902;Eau de Cologne;7,1;{};;"
        + PARFUMO
        + "Berdoues/1902_Eau_de_Cologne_{}\n"
    )
    source.write_text(
        "Name;Brand;Release Year;Concentration;Rating Value;Rating Count;Manufacturer;URL\n"
        + row.format(29, "Tonique")
        + row.format(14, "Violette"),
        encoding="utf-8",
    )
    pipeline = EtlPipeline(str(source))

    pipeline.load_and_clean_data()

    assert sorted(pipeline.df["Name"]) == ["1902 Tonique", "1902 Violette"]
    assert list(pipeline.df["Release Year"]) == [0, 0]


def test_load_keeps_yearly_editions_apart(tmp_path: Path) -> None:
    row = "Flowerbomb Limited Edition;Viktor & Rolf;;;7,1;{};;" + PARFUMO + "Viktor_Rolf/F_{}\n"
    source = tmp_path / "source.csv"
    source.write_text(
        "Name;Brand;Release Year;Concentration;Rating Value;Rating Count;Manufacturer;URL\n"
        + row.format(40, "2015").replace("/F_", "/Flowerbomb_Limited_Edition_")
        + row.format(30, "2018").replace("/F_", "/Flowerbomb_Limited_Edition_"),
        encoding="utf-8",
    )
    pipeline = EtlPipeline(str(source))

    pipeline.load_and_clean_data()

    assert sorted(pipeline.df["Release Year"]) == [2015, 2018]


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


def test_lookup_reuses_a_row_whose_slug_matches(etl: EtlPipeline) -> None:
    # "Lotion Après Rasage" slugifies like the stored "Lotion Après-Rasage"; inserting it would
    # break the unique slug.
    client = _lookup_client([[], [{"id": "id-4"}]], MagicMock(data=[{"id": "unused"}]))
    with patch.object(etl_module, "supabase", client):
        lookup = etl._get_or_create_lookup(
            "concentrations", "name", "Lotion Après Rasage", has_slug=True
        )
        assert lookup == "id-4"
    client.table.return_value.insert.assert_not_called()


def test_lookup_raises_when_the_row_cannot_be_found_or_created(etl: EtlPipeline) -> None:
    client = _lookup_client([[], []], RuntimeError("down"))
    with patch.object(etl_module, "supabase", client), pytest.raises(LookupError):
        etl._get_or_create_lookup("brands", "name", "Hermes")


def test_dry_run_writes_a_report_and_nothing_to_the_database(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    source.write_text(
        "Name;Brand;Release Year;Concentration;Rating Value;Rating Count;Manufacturer;URL\n"
        f"Sauvage;Dior;2015;Eau de Toilette;7,1;900;;{PARFUMO}Dior/Sauvage\n",
        encoding="utf-8",
    )
    stored = [
        {
            "id": "x",
            "name": "Fahrenheit",
            "release_year": 1988,
            "is_active": True,
            "is_uncertain": True,
            "brands": {"name": "Dior"},
            "concentrations": None,
        },
    ]
    client = MagicMock()
    report_path = tmp_path / "report.json"
    with (
        patch.object(etl_module, "_fetch_pages", return_value=stored),
        patch.object(etl_module, "supabase", client),
    ):
        summary = EtlPipeline(str(source)).dry_run(str(report_path))

    assert summary == {
        "matched": 0,
        "new": 1,
        "unmatched_stored": 1,
        "unmatched_stored_active": 1,
        "unmatched_stored_certain": 0,
    }
    assert '"Fahrenheit"' in report_path.read_text(encoding="utf-8")
    client.table.assert_not_called()


def test_compare_with_stored_lists_new_and_unmatched_rows() -> None:
    source = [
        {"brand": "Dior", "name": "Sauvage", "concentration": "Eau de Toilette", "year": 2015},
        {"brand": "Chanel", "name": "N°5", "concentration": "Unknown", "year": 0},
        {
            "brand": "Burberry",
            "name": "Body Intense",
            "concentration": "Eau de Parfum",
            "year": 2011,
        },
        # The import finds a label by its slug too, so spellings that share one match.
        {
            "brand": "Dior",
            "name": "Fahrenheit",
            "concentration": "After-Shave Lotion",
            "year": 1988,
        },
    ]
    stored: list[dict[str, Any]] = [
        {
            "id": "d",
            "brand": "Dior",
            "name": "Fahrenheit",
            "concentration": "After Shave Lotion",
            "year": 1988,
            "is_active": True,
            "is_uncertain": True,
        },
        # Same key: case and spacing do not matter, a missing concentration or year is None.
        {
            "id": "a",
            "brand": " dior ",
            "name": "SAUVAGE",
            "concentration": "Eau de Toilette",
            "year": 2015,
            "is_active": True,
            "is_uncertain": False,
        },
        {
            "id": "b",
            "brand": "Chanel",
            "name": "N°5",
            "concentration": None,
            "year": None,
            "is_active": True,
            "is_uncertain": False,
        },
        # The source no longer has this one.
        {
            "id": "c",
            "brand": "Burberry",
            "name": "Body",
            "concentration": "Eau de Parfum",
            "year": 2011,
            "is_active": True,
            "is_uncertain": True,
        },
    ]

    report = etl_module.compare_with_stored(source, stored)

    assert report["matched"] == 3
    assert [row["name"] for row in report["new"]] == ["Body Intense"]
    assert [row["id"] for row in report["unmatched_stored"]] == ["c"]
    assert report["unmatched_stored_certain"] == 0
