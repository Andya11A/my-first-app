"""焓湿计算与城市气候参数库单元测试。"""
import pytest

from app.services.city_climate_db import CITY_CLIMATE_DB, get_city_climate, list_cities
from app.services.psychrometrics_service import (
    calc_from_db_rh,
    calc_state_from_city,
    calc_supply_air,
)


# ---------------- 城市气候参数库 ----------------

def test_city_count():
    """气候库城市数 ≥ 25，且冬夏参数齐全。"""
    cities = list_cities()
    assert len(cities) >= 25
    for name, entry in CITY_CLIMATE_DB.items():
        assert isinstance(entry["altitude_m"], (int, float)), name
        for season, keys in (
            ("summer", {"dry_bulb", "wet_bulb", "pressure_kpa"}),
            ("winter", {"dry_bulb", "relative_humidity", "pressure_kpa"}),
        ):
            assert keys <= set(entry[season].keys()), (name, season)


def test_lhasa_low_pressure():
    """拉萨夏季大气压约 65 kPa。"""
    climate = get_city_climate("拉萨", "summer")
    assert climate["pressure_kpa"] == pytest.approx(65.2, abs=0.5)
    assert climate["altitude_m"] == pytest.approx(3658, abs=5)


def test_city_alias():
    """城市别名：'广州市' 与 '广州' 等效。"""
    a = get_city_climate("广州", "summer")
    b = get_city_climate("广州市", "summer")
    assert a == b


def test_invalid_city_and_season():
    with pytest.raises(ValueError):
        get_city_climate("火星", "summer")
    with pytest.raises(ValueError):
        get_city_climate("北京", "rainy")


# ---------------- 焓湿计算联动 ----------------

def test_pressure_changes_enthalpy():
    """同一工况（26℃/60%RH）下，广州与拉萨焓值差异显著（大气压关联生效）。"""
    gz = calc_from_db_rh(26, 60, get_city_climate("广州", "summer")["pressure_kpa"])
    ls = calc_from_db_rh(26, 60, get_city_climate("拉萨", "summer")["pressure_kpa"])
    assert gz["enthalpy_kj_kg"] == pytest.approx(58.5, abs=1.0)
    assert ls["enthalpy_kj_kg"] - gz["enthalpy_kj_kg"] > 10  # 低压 → 含湿量更大 → 焓值更高
    assert ls["humidity_ratio_g_kg"] > gz["humidity_ratio_g_kg"]


def test_calc_state_from_city():
    """calc_state_from_city 附带城市/季节/海拔/室外参数。"""
    out = calc_state_from_city(26, 60, "拉萨", "summer")
    assert out["city"] == "拉萨"
    assert out["season"] == "summer"
    assert out["pressure_kpa"] == pytest.approx(65.2, abs=0.5)
    assert out["altitude_m"] > 3000
    assert out["climate"]["dry_bulb"] == 24.1
    assert out["climate"]["wet_bulb"] == 13.5


def test_supply_air_city_pressure():
    """送风计算按城市取夏季大气压，高原城市密度更小。"""
    gz = calc_supply_air(100, 3, 24, 60, 16, 90, city="广州")
    ls = calc_supply_air(100, 3, 24, 60, 16, 90, city="拉萨")
    assert gz["pressure_kpa"] == pytest.approx(100.45, abs=0.5)
    assert ls["pressure_kpa"] == pytest.approx(65.23, abs=0.5)
    assert ls["airflow_m3_h"] == gz["airflow_m3_h"]  # 风量按体积不变
    assert ls["cooling_capacity_kw"] < gz["cooling_capacity_kw"]  # 密度小 → 质量流量小 → 冷量小
