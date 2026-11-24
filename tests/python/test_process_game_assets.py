"""Behaviour of the game image pipeline without network, R2 or a database."""

import importlib
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from PIL import Image

sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts/assets"))

pga = importlib.import_module("process_game_assets")

PERFUME = "c2614cda-f6a4-4fba-9d8a-1d9734f8cc97"
OLD_ASSET = "0" * 16


def _bottle(size: tuple[int, int] = (40, 30)) -> Image.Image:
    """A dark rectangle on white, the shape the pipeline expects."""
    data = np.full((size[1], size[0], 3), 255, dtype=np.uint8)
    data[8:22, 10:30] = (30, 60, 90)
    return Image.fromarray(data)


def test_quantize_method_falls_back_to_median_cut() -> None:
    median_cut = int(Image.Quantize.MEDIANCUT)
    assert pga._resolve_quantize_method("auto") == median_cut
    assert pga._resolve_quantize_method("") == median_cut
    assert pga._resolve_quantize_method("FASTOCTREE") == int(Image.Quantize.FASTOCTREE)


def test_snap_near_white_only_touches_near_white_pixels() -> None:
    data = np.full((4, 4, 3), 254, dtype=np.uint8)
    data[0, 0] = (10, 10, 10)
    snapped = np.asarray(pga._snap_near_white(Image.fromarray(data), 253))
    assert tuple(snapped[0, 0]) == (10, 10, 10)
    assert tuple(snapped[3, 3]) == (255, 255, 255)


def test_snap_near_white_is_a_no_op_when_disabled_or_nothing_matches() -> None:
    img = _bottle()
    assert pga._snap_near_white(img, 0) is img
    dark = Image.new("RGB", (4, 4), (10, 10, 10))
    assert pga._snap_near_white(dark, 253) is dark


def test_reduce_image_complexity_limits_the_palette() -> None:
    rng = np.random.default_rng(1)
    noisy = Image.fromarray(rng.integers(0, 256, (32, 32, 3), dtype=np.uint8))
    reduced = pga.reduce_image_complexity(noisy, colors=4, median=3, posterize_bits=4)
    assert reduced.mode == "RGB"
    assert len(reduced.getcolors(maxcolors=1024) or []) <= 4


def test_add_noise_changes_pixels_only_above_the_intensity_floor() -> None:
    img = _bottle()
    assert pga.add_noise(img, intensity=0.0) is img
    noisy = pga.add_noise(img, intensity=0.1)
    assert noisy.size == img.size
    assert not np.array_equal(np.asarray(noisy), np.asarray(img))


def test_square_canvas_keeps_the_aspect_ratio_and_pads_with_white() -> None:
    canvas = pga.normalize_to_square_canvas(Image.new("RGB", (40, 20), (0, 0, 0)), target_size=20)
    assert canvas.size == (20, 20)
    assert canvas.getpixel((10, 10)) == (0, 0, 0)
    assert canvas.getpixel((10, 0)) == (255, 255, 255)
    assert canvas.getpixel((10, 19)) == (255, 255, 255)


def test_square_canvas_of_an_empty_image_is_white() -> None:
    canvas = pga.normalize_to_square_canvas(Image.new("RGB", (0, 0)), target_size=8)
    assert canvas.size == (8, 8)
    assert canvas.getpixel((0, 0)) == (255, 255, 255)


def test_normalize_signal_moves_the_object_to_the_target_mean() -> None:
    result = np.asarray(pga.normalize_signal(_bottle(), target_mean=200.0, target_std=5.0))
    assert tuple(result[0, 0]) == (255, 255, 255)
    assert 190 < result[15, 20].mean() < 210


def test_normalize_signal_returns_a_blank_image_unchanged() -> None:
    blank = Image.new("RGB", (8, 8), (255, 255, 255))
    assert pga.normalize_signal(blank) is blank


def test_reveal_extremes_return_the_background_or_the_original() -> None:
    img = _bottle()
    assert pga.apply_progressive_reveal(img, blur_px=0, reveal_pct=1.0) is img
    hidden = pga.apply_progressive_reveal(img, blur_px=0, reveal_pct=0, grayscale=True)
    assert hidden.getpixel((20, 15))[0] == hidden.getpixel((20, 15))[2]


def test_partial_reveal_shows_the_original_only_in_the_centre() -> None:
    img = Image.new("RGB", (40, 40), (200, 0, 0))
    result = pga.apply_progressive_reveal(img, blur_px=0, reveal_pct=0.5, grayscale=True)
    assert result.getpixel((20, 20)) == (200, 0, 0)
    corner = result.getpixel((1, 1))
    assert corner[0] == corner[1] == corner[2]


def test_reveal_uses_a_precomputed_base_instead_of_recomputing_it() -> None:
    img = Image.new("RGB", (20, 20), (200, 0, 0))
    base = Image.new("RGB", (20, 20), (7, 7, 7))
    result = pga.apply_progressive_reveal(img, blur_px=0, reveal_pct=0, base_img_override=base)
    assert result.getpixel((5, 5)) == (7, 7, 7)


def test_reveal_normalizes_the_background_and_adds_noise() -> None:
    result = pga.apply_progressive_reveal(
        _bottle(), blur_px=1.0, reveal_pct=0, normalize=True, noise_intensity=0.02
    )
    assert result.size == (40, 30)


def test_encode_image_produces_avif() -> None:
    data = pga.encode_image(_bottle(), quality=50, speed=8)
    assert data[4:12] in (b"ftypavif", b"ftypavis")


def test_encode_image_retries_with_basic_arguments_and_then_raises() -> None:
    class StrictImage:
        def __init__(self, fail_always: bool) -> None:
            self.fail_always = fail_always
            self.calls: list[dict[str, Any]] = []

        def save(self, buf: Any, **kwargs: Any) -> None:
            self.calls.append(kwargs)
            if self.fail_always or "speed" in kwargs:
                raise ValueError("unsupported")
            buf.write(b"avif")

    retry = StrictImage(fail_always=False)
    assert pga.encode_image(retry, quality=40) == b"avif"
    assert len(retry.calls) == 2

    with pytest.raises(ValueError, match="unsupported"):
        pga.encode_image(StrictImage(fail_always=True), quality=40)


def test_quality_search_returns_the_best_data_that_fits(monkeypatch: pytest.MonkeyPatch) -> None:
    tried: list[int] = []

    def fake_encode(img: Any, quality: int, speed: int = 0, subsampling: str = "") -> bytes:
        tried.append(quality)
        return b"x" * (quality * 1024)

    monkeypatch.setattr(pga, "encode_image", fake_encode)
    data = pga.choose_quality_for_max_kb(_bottle(), max_kb=50, min_quality=20, max_quality=80)
    assert len(data) == 50 * 1024
    assert tried[0] == 80


def test_quality_search_returns_max_quality_when_it_already_fits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(pga, "encode_image", lambda img, quality, **_kw: bytes([quality]))
    assert pga.choose_quality_for_max_kb(_bottle(), max_kb=1, max_quality=70) == bytes([70])


def test_quality_search_falls_back_to_minimum_when_nothing_fits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(pga, "encode_image", lambda img, quality, **_kw: b"x" * (2048 + quality))
    data = pga.choose_quality_for_max_kb(_bottle(), max_kb=1, min_quality=20, max_quality=30)
    assert len(data) == 2048 + 20


@pytest.mark.parametrize("no_compression", [True, False])
def test_build_step_images_encodes_all_six_steps(no_compression: bool) -> None:
    images = pga.build_step_images(_bottle((32, 32)), no_compression=no_compression)
    assert sorted(images) == [1, 2, 3, 4, 5, 6]
    assert all(data for data in images.values())


class FakeSupabase:
    """Answers the one query find_existing_asset_id issues."""

    def __init__(self, data: list[dict[str, str]]) -> None:
        self.data = data
        self.upserts: list[dict[str, str]] = []

    def table(self, name: str) -> "FakeSupabase":
        return self

    def select(self, columns: str) -> "FakeSupabase":
        return self

    def eq(self, column: str, value: str) -> "FakeSupabase":
        return self

    def limit(self, count: int) -> "FakeSupabase":
        return self

    def upsert(self, row: dict[str, str]) -> "FakeSupabase":
        self.upserts.append(row)
        return self

    def execute(self) -> Any:
        return type("Result", (), {"data": self.data})()


def test_existing_asset_id_is_none_without_a_row() -> None:
    assert pga.find_existing_asset_id(FakeSupabase([]), PERFUME) is None
    row = [{"asset_random_id": OLD_ASSET}]
    assert pga.find_existing_asset_id(FakeSupabase(row), PERFUME) == OLD_ASSET


def test_confirm_overwrite_respects_flags_before_asking(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("builtins.input", lambda _prompt: pytest.fail("must not prompt"))
    assert pga.confirm_overwrite(PERFUME, OLD_ASSET, force=False, skip_existing=True) is False
    assert pga.confirm_overwrite(PERFUME, OLD_ASSET, force=True, skip_existing=False) is True


@pytest.mark.parametrize(
    ("answer", "expected"), [("y", True), (" Y ", True), ("n", False), ("", False)]
)
def test_confirm_overwrite_prompts_otherwise(
    monkeypatch: pytest.MonkeyPatch, answer: str, expected: bool
) -> None:
    monkeypatch.setattr("builtins.input", lambda _prompt: answer)
    assert pga.confirm_overwrite(PERFUME, OLD_ASSET, force=False, skip_existing=False) is expected


@pytest.fixture
def illustration(tmp_path: Path) -> Path:
    path = tmp_path / f"{PERFUME}.png"
    _bottle().save(path)
    return path


def _stub_steps(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pga, "build_step_images", lambda img, no_compression=False: {n: bytes([n]) for n in (1, 2)}
    )


def test_local_mode_writes_one_file_per_step(
    monkeypatch: pytest.MonkeyPatch, illustration: Path, tmp_path: Path
) -> None:
    _stub_steps(monkeypatch)
    out = tmp_path / "out"
    out.mkdir()
    assert pga.process_file(illustration, out, clients=None) is True
    assert sorted(p.name for p in out.iterdir()) == [
        f"{PERFUME}_step1.avif",
        f"{PERFUME}_step2.avif",
    ]


def test_files_without_a_uuid_name_are_skipped(tmp_path: Path) -> None:
    other = tmp_path / "notes.png"
    other.write_bytes(b"")
    assert pga.process_file(other, tmp_path, clients=None) is True


def _clients(supabase: FakeSupabase) -> dict[str, Any]:
    return {"supabase": supabase, "r2_io": {"marker": True}}


def test_remote_mode_publishes_and_upserts(
    monkeypatch: pytest.MonkeyPatch, illustration: Path, tmp_path: Path
) -> None:
    _stub_steps(monkeypatch)
    published: dict[str, Any] = {}

    def fake_publish(perfume_id: str, images: Any, **kwargs: Any) -> Any:
        published.update(perfume_id=perfume_id, images=images, **kwargs)
        kwargs["upsert_row"]({"perfume_id": perfume_id})
        return type("Result", (), {"asset_id": "new", "old_prefix_removed": True})()

    monkeypatch.setattr(pga, "publish_asset", fake_publish)
    supabase = FakeSupabase([])

    assert pga.process_file(illustration, tmp_path, _clients(supabase)) is True
    assert published["perfume_id"] == PERFUME
    assert published["old_asset_id"] is None
    assert published["marker"] is True
    assert supabase.upserts == [{"perfume_id": PERFUME}]


def test_remote_mode_reports_a_failed_publish(
    monkeypatch: pytest.MonkeyPatch, illustration: Path, tmp_path: Path
) -> None:
    _stub_steps(monkeypatch)

    def failing_publish(*args: Any, **kwargs: Any) -> None:
        raise OSError("r2 down")

    monkeypatch.setattr(pga, "publish_asset", failing_publish)
    assert pga.process_file(illustration, tmp_path, _clients(FakeSupabase([]))) is False


def test_an_existing_asset_is_kept_when_skip_existing_is_set(
    monkeypatch: pytest.MonkeyPatch, illustration: Path, tmp_path: Path
) -> None:
    monkeypatch.setattr(pga, "publish_asset", lambda *_a, **_k: pytest.fail("must not publish"))
    supabase = FakeSupabase([{"asset_random_id": OLD_ASSET}])
    assert pga.process_file(illustration, tmp_path, _clients(supabase), skip_existing=True) is True


def test_a_failed_database_check_skips_the_file(illustration: Path, tmp_path: Path) -> None:
    class BrokenSupabase(FakeSupabase):
        def execute(self) -> Any:
            raise RuntimeError("db down")

    clients = _clients(BrokenSupabase([]))
    assert pga.process_file(illustration, tmp_path, clients) is False


def _run_main(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, *argv: str) -> Path:
    illustrations = tmp_path / "illustrations"
    illustrations.mkdir()
    dirs = type("Dirs", (), {"illustrations": illustrations, "debug_output": tmp_path / "debug"})()
    monkeypatch.setattr(pga, "load_env", lambda: None)
    monkeypatch.setattr(pga, "local_dirs", lambda: dirs)
    monkeypatch.setattr(sys, "argv", ["process_game_assets.py", *argv])
    return illustrations


def test_main_in_local_mode_processes_every_png(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    illustrations = _run_main(monkeypatch, tmp_path, "--local")
    _bottle().save(illustrations / f"{PERFUME}.png")
    monkeypatch.setattr(pga, "build_step_images", lambda img, no_compression=False: {1: b"a"})
    pga.main()
    assert (tmp_path / "debug" / f"{PERFUME}_step1.avif").read_bytes() == b"a"


def test_main_exits_with_an_error_when_a_file_fails(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    illustrations = _run_main(monkeypatch, tmp_path, "--local")
    (illustrations / f"{PERFUME}.png").write_bytes(b"not an image")
    with pytest.raises(SystemExit) as exit_info:
        pga.main()
    assert exit_info.value.code == 1


def test_main_returns_quietly_when_the_input_directory_is_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    illustrations = _run_main(monkeypatch, tmp_path, "--local")
    illustrations.rmdir()
    pga.main()
    assert not (tmp_path / "debug").exists()


def test_main_builds_remote_clients_without_local_flag(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _run_main(monkeypatch, tmp_path)
    seen: list[str] = []
    monkeypatch.setattr(pga, "make_supabase", lambda: seen.append("supabase"))
    monkeypatch.setattr(pga, "make_s3_client", lambda: seen.append("s3"))
    monkeypatch.setattr(pga, "bucket_name", lambda: "bucket")
    monkeypatch.setattr(pga, "make_r2_io", lambda client, bucket: {"bucket": bucket})
    pga.main()
    assert seen == ["supabase", "s3"]
