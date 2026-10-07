import os
import re
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts/assets"))

from asset_config import ASSET_CONFIG, local_dirs  # noqa: E402
from asset_keys import (  # noqa: E402
    STEPS,
    asset_prefix,
    is_valid_asset_id,
    is_valid_step_key,
    new_asset_id,
    new_step_keys,
    step_column,
)


def counter_token_hex():
    """Deterministic token source: 0000..01, 0000..02, ... with the requested length."""
    state = {"n": 0}

    def token_hex(nbytes: int) -> str:
        state["n"] += 1
        return format(state["n"], "x").rjust(nbytes * 2, "0")

    return token_hex


def test_asset_id_has_128_bits_of_hex():
    asset_id = new_asset_id()
    assert re.fullmatch(r"[0-9a-f]{32}", asset_id)


def test_step_keys_live_in_the_asset_directory_without_step_numbers():
    asset_id = "f" * 32
    keys = new_step_keys(asset_id)
    assert sorted(keys) == list(STEPS)
    for key in keys.values():
        assert re.fullmatch(rf"a/{asset_id}/[0-9a-f]{{32}}\.avif", key)
    assert len(set(keys.values())) == 6


def test_step_keys_reject_a_colliding_token_source():
    with pytest.raises(ValueError, match="collid"):
        new_step_keys("f" * 32, token_hex=lambda n: "0" * (n * 2))


def test_step_keys_reject_an_invalid_asset_id():
    with pytest.raises(ValueError):
        new_step_keys("../etc")


def test_injected_token_source_is_used():
    keys = new_step_keys("a" * 32, token_hex=counter_token_hex())
    assert keys[1] == f"a/{'a' * 32}/{'0' * 31}1.avif"


@pytest.mark.parametrize(
    "value,ok",
    [("0" * 32, True), ("A" * 32, False), ("0" * 31, False), ("0" * 16, False), ("g" * 32, False)],
)
def test_is_valid_asset_id(value, ok):
    assert is_valid_asset_id(value) is ok


def test_is_valid_step_key_requires_own_directory_and_full_name():
    asset_id = "1" * 32
    assert is_valid_step_key(asset_id, f"a/{asset_id}/{'2' * 32}.avif")
    assert not is_valid_step_key(asset_id, f"a/{'3' * 32}/{'2' * 32}.avif")
    assert not is_valid_step_key(asset_id, f"a/{asset_id}/1_abcd.avif")
    assert not is_valid_step_key(asset_id, f"a/{asset_id}/{'2' * 32}.png")


def test_helpers():
    assert asset_prefix("b" * 32) == f"a/{'b' * 32}/"
    assert step_column(3) == "image_key_step_3"
    assert ASSET_CONFIG.cache_control == "public, max-age=31536000, immutable"


def test_local_dirs_treat_empty_env_as_unset(monkeypatch):
    monkeypatch.setenv("ASSET_ILLUSTRATIONS_DIR", "")
    assert local_dirs().illustrations.as_posix().endswith("img/bottles/3illustrations")
    monkeypatch.setenv("ASSET_ILLUSTRATIONS_DIR", "img/bottles/custom")
    assert local_dirs().illustrations.as_posix().endswith("img/bottles/custom")
