import json
import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), "../../scripts/assets"))

from rekey_plan import (  # noqa: E402
    AssetRow,
    build_rekey_plan,
    needs_copy,
    plan_from_json,
    plan_to_json,
    render_apply_sql,
    render_rollback_sql,
    select_deletions,
)

P1 = "1b63a04b-b494-4550-bc1e-269dd0f33a7e"
P2 = "34bab2ce-84e1-495d-804f-0d466e1d6f17"


def old_row(perfume_id, old_id, legacy=False):
    keys = {s: (f"a/{old_id}/{s:x}abc.avif" if legacy else f"a/{old_id}/{s}_abc{s}.avif")
            for s in range(1, 7)}
    return AssetRow(perfume_id=perfume_id, asset_id=old_id, keys=keys)


def ids():
    seq = iter(["a" * 32, "b" * 32])
    return lambda: next(seq)


def keys_for(asset_id):
    return {s: f"a/{asset_id}/{str(s) * 32}.avif" for s in range(1, 7)}


ROWS = [old_row(P2, "2" * 16, legacy=True), old_row(P1, "1" * 16)]
ORPHANS = ["a/" + "9" * 16 + "/1_dead.avif", "a/" + "9" * 16 + "/6_beef.avif"]
BUCKET = [k for r in ROWS for k in r.keys.values()] + ORPHANS


def make_plan():
    return build_rekey_plan(ROWS, BUCKET, new_id=ids(), new_keys=keys_for)


def test_plan_is_ordered_by_perfume_and_lists_orphans():
    plan = make_plan()
    assert [e.perfume_id for e in plan.entries] == [P1, P2]
    assert plan.entries[0].new_asset_id == "a" * 32
    assert plan.orphan_keys == tuple(sorted(ORPHANS))


def test_missing_bucket_object_stops_the_plan():
    with pytest.raises(ValueError, match="missing"):
        build_rekey_plan(ROWS, BUCKET[1:], new_id=ids(), new_keys=keys_for)


def test_json_round_trip_and_validation():
    plan = make_plan()
    assert plan_from_json(plan_to_json(plan)) == plan
    data = json.loads(plan_to_json(plan))
    data["entries"][0]["new_keys"]["1"] = "a/" + "a" * 32 + "/1_abcd.avif"
    with pytest.raises(ValueError):
        plan_from_json(json.dumps(data))


def test_apply_sql_updates_each_row_once_and_checks_the_count():
    sql = render_apply_sql(make_plan())
    assert sql.count("UPDATE public.perfume_assets") == 2
    assert f"WHERE perfume_id = '{P1}' AND asset_random_id = '{'1' * 16}'" in sql
    assert "IF updated <> 2 THEN RAISE EXCEPTION" in sql
    assert sql.strip().startswith("DO $$") and sql.strip().endswith("$$;")


def test_rollback_sql_restores_old_keys():
    sql = render_rollback_sql(make_plan())
    assert f"asset_random_id = '{'1' * 16}'" in sql
    assert f"AND asset_random_id = '{'a' * 32}'" in sql


def test_cleanup_refuses_before_the_swap():
    plan = make_plan()
    current = [k for r in ROWS for k in r.keys.values()]
    with pytest.raises(ValueError, match="new keys"):
        select_deletions(plan, current, BUCKET)


def test_cleanup_deletes_old_and_orphans_but_never_a_referenced_key():
    plan = make_plan()
    new_keys = [k for e in plan.entries for k in e.new_keys.values()]
    still_referenced = ORPHANS[0]
    deletions = select_deletions(plan, new_keys + [still_referenced], BUCKET + new_keys)
    assert still_referenced not in deletions
    assert ORPHANS[1] in deletions
    assert all(k in deletions for r in ROWS for k in r.keys.values())
    assert not any(k in deletions for k in new_keys)


def test_copy_is_skipped_only_when_the_new_object_matches():
    assert needs_copy("x", None) is True
    assert needs_copy("x", "x") is False
