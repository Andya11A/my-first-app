"""湿空气焓湿计算服务"""
import psychrolib
from typing import Optional

from app.services.city_climate_db import get_city_climate

# 单位制：SI（温度℃，压力Pa）
psychrolib.SetUnitSystem(psychrolib.SI)

# 标准大气压(kPa)
STANDARD_PRESSURE_KPA = 101.325


def calc_from_db_wb(
    dry_bulb: float,
    wet_bulb: float,
    pressure_kpa: float = STANDARD_PRESSURE_KPA,
) -> dict:
    """根据干球温度和湿球温度计算空气状态（大气压单位 kPa）"""
    pressure = pressure_kpa * 1000.0
    humidity_ratio = psychrolib.GetHumRatioFromTWetBulb(
        dry_bulb, wet_bulb, pressure
    )
    return _calc_from_db_hr(dry_bulb, humidity_ratio, pressure)


def calc_from_db_rh(
    dry_bulb: float,
    relative_humidity: float,
    pressure_kpa: float = STANDARD_PRESSURE_KPA,
) -> dict:
    """根据干球温度和相对湿度计算空气状态（大气压单位 kPa）"""
    pressure = pressure_kpa * 1000.0
    humidity_ratio = psychrolib.GetHumRatioFromRelHum(
        dry_bulb, relative_humidity / 100.0, pressure
    )
    return _calc_from_db_hr(dry_bulb, humidity_ratio, pressure)


def _calc_from_db_hr(dry_bulb: float, humidity_ratio: float, pressure: float) -> dict:
    """根据干球温度和含湿量计算完整空气状态（pressure: Pa）"""
    rel_hum = psychrolib.GetRelHumFromHumRatio(dry_bulb, humidity_ratio, pressure)
    enthalpy = psychrolib.GetMoistAirEnthalpy(dry_bulb, humidity_ratio)
    dew_point = psychrolib.GetTDewPointFromHumRatio(dry_bulb, humidity_ratio, pressure)
    wet_bulb = psychrolib.GetTWetBulbFromHumRatio(dry_bulb, humidity_ratio, pressure)
    specific_volume = psychrolib.GetMoistAirVolume(dry_bulb, humidity_ratio, pressure)

    return {
        "dry_bulb_c": round(dry_bulb, 2),
        "relative_humidity_pct": round(rel_hum * 100.0, 2),
        "humidity_ratio_g_kg": round(humidity_ratio * 1000.0, 3),
        "enthalpy_kj_kg": round(enthalpy / 1000.0, 3),
        "dew_point_c": round(dew_point, 2),
        "wet_bulb_c": round(wet_bulb, 2),
        "specific_volume_m3_kg": round(specific_volume, 4),
        "pressure_kpa": round(pressure / 1000.0, 3),
    }


def calc_state_from_city(
    dry_bulb: float,
    relative_humidity: float,
    city: str,
    season: str = "summer",
) -> dict:
    """按城市+季节自动取大气压计算空气状态。

    返回空气状态并附带 city / season / altitude_m（大气压见 pressure_kpa 字段），
    室外设计参数（该季节干球/湿球或相对湿度）见 climate 字段。
    """
    climate = get_city_climate(city, season)
    state = calc_from_db_rh(dry_bulb, relative_humidity, climate["pressure_kpa"])
    state["city"] = climate["city"]
    state["season"] = season
    state["altitude_m"] = climate["altitude_m"]
    state["climate"] = climate
    return state


def calc_supply_air(
    room_area: float,
    room_height: float,
    room_temp: float,
    room_rh: float,
    supply_temp: float,
    supply_rh: float,
    air_changes: Optional[float] = None,
    city: str = "广州",
) -> dict:
    """计算送风量和冷量（室内设计状态人工输入，大气压按城市夏季自动取）"""
    climate = get_city_climate(city, "summer")
    pressure_kpa = climate["pressure_kpa"]

    room = calc_from_db_rh(room_temp, room_rh, pressure_kpa)
    supply = calc_from_db_rh(supply_temp, supply_rh, pressure_kpa)

    volume = room_area * room_height
    # 密度按当地大气压下的湿空气比容换算，高原城市明显低于 1.2 kg/m³
    density = 1.0 / room["specific_volume_m3_kg"] if room["specific_volume_m3_kg"] else 1.2

    if air_changes:
        airflow = volume * air_changes
    else:
        airflow = volume * 15  # 默认15次

    mass_flow = airflow * density / 3600.0  # kg/s
    cooling_kw = mass_flow * (room["enthalpy_kj_kg"] - supply["enthalpy_kj_kg"])

    dehumidification = max(
        0.0,
        (room["humidity_ratio_g_kg"] - supply["humidity_ratio_g_kg"])
        * mass_flow
        * 3.6,  # kg/h
    )

    return {
        "room_state": room,
        "supply_state": supply,
        "room_volume_m3": round(volume, 2),
        "airflow_m3_h": round(airflow, 1),
        "cooling_capacity_kw": round(cooling_kw, 2),
        "dehumidification_kg_h": round(dehumidification, 2),
        "city": climate["city"],
        "pressure_kpa": pressure_kpa,
    }
