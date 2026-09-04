"""城市气候参数库
====================================================

数据来源：
- 冬/夏干球温度：《民用建筑供暖通风与空气调节设计规范》GB 50736-2012 附录A
  （冬季空调室外计算干球温度 / 夏季空调室外计算干球温度，统计期 1971-2000）
- 夏季湿球温度 / 冬季相对湿度 / 冬夏季大气压 / 海拔：全国主要城市室外气象参数
  （同一批国家基准气候站累年统计值，与 GB 50736-2012 附录A 同源）
- 个别城市参数说明见 _CITY_NOTES

用途：焓湿计算按 城市+季节 自动取大气压和室外设计参数。
"""
from __future__ import annotations

from typing import Optional

# 每城市字段：
#   altitude_m: 海拔高度(m)
#   summer: dry_bulb=夏季空调室外计算干球温度(℃), wet_bulb=夏季空调室外计算湿球温度(℃),
#           pressure_kpa=夏季室外大气压(kPa)
#   winter: dry_bulb=冬季空调室外计算干球温度(℃), relative_humidity=冬季空调室外计算相对湿度(%),
#           pressure_kpa=冬季室外大气压(kPa)
CITY_CLIMATE_DB: dict = {
    "北京": {
        "altitude_m": 31.2,
        "summer": {"dry_bulb": 33.5, "wet_bulb": 26.4, "pressure_kpa": 99.86},
        "winter": {"dry_bulb": -9.9, "relative_humidity": 45, "pressure_kpa": 102.04},
    },
    "上海": {
        "altitude_m": 4.5,
        "summer": {"dry_bulb": 34.4, "wet_bulb": 28.2, "pressure_kpa": 100.53},
        "winter": {"dry_bulb": -2.2, "relative_humidity": 75, "pressure_kpa": 102.51},
    },
    "广州": {
        "altitude_m": 6.6,
        "summer": {"dry_bulb": 34.2, "wet_bulb": 27.7, "pressure_kpa": 100.45},
        "winter": {"dry_bulb": 5.2, "relative_humidity": 70, "pressure_kpa": 101.95},
    },
    "深圳": {
        "altitude_m": 63.0,
        "summer": {"dry_bulb": 33.7, "wet_bulb": 27.9, "pressure_kpa": 100.34},
        "winter": {"dry_bulb": 6.0, "relative_humidity": 70, "pressure_kpa": 101.30},
    },
    "天津": {
        "altitude_m": 3.3,
        "summer": {"dry_bulb": 33.9, "wet_bulb": 26.9, "pressure_kpa": 100.48},
        "winter": {"dry_bulb": -9.6, "relative_humidity": 53, "pressure_kpa": 102.66},
    },
    "重庆": {
        "altitude_m": 259.1,
        "summer": {"dry_bulb": 35.5, "wet_bulb": 27.3, "pressure_kpa": 97.32},
        "winter": {"dry_bulb": 2.2, "relative_humidity": 82, "pressure_kpa": 99.12},
    },
    "南京": {
        "altitude_m": 8.9,
        "summer": {"dry_bulb": 34.8, "wet_bulb": 28.3, "pressure_kpa": 100.40},
        "winter": {"dry_bulb": -4.1, "relative_humidity": 73, "pressure_kpa": 102.52},
    },
    "杭州": {
        "altitude_m": 41.7,
        "summer": {"dry_bulb": 35.6, "wet_bulb": 28.5, "pressure_kpa": 100.05},
        "winter": {"dry_bulb": -2.4, "relative_humidity": 77, "pressure_kpa": 102.09},
    },
    "武汉": {
        "altitude_m": 23.3,
        "summer": {"dry_bulb": 35.2, "wet_bulb": 28.2, "pressure_kpa": 100.17},
        "winter": {"dry_bulb": -2.6, "relative_humidity": 76, "pressure_kpa": 102.33},
    },
    "成都": {
        "altitude_m": 505.9,
        "summer": {"dry_bulb": 31.8, "wet_bulb": 26.7, "pressure_kpa": 94.77},
        "winter": {"dry_bulb": 1.0, "relative_humidity": 80, "pressure_kpa": 96.32},
    },
    "西安": {
        "altitude_m": 396.9,
        "summer": {"dry_bulb": 35.0, "wet_bulb": 26.0, "pressure_kpa": 95.92},
        "winter": {"dry_bulb": -5.7, "relative_humidity": 67, "pressure_kpa": 97.87},
    },
    "郑州": {
        "altitude_m": 110.4,
        "summer": {"dry_bulb": 34.9, "wet_bulb": 27.4, "pressure_kpa": 99.17},
        "winter": {"dry_bulb": -6.0, "relative_humidity": 60, "pressure_kpa": 101.28},
    },
    "济南": {
        "altitude_m": 51.6,
        "summer": {"dry_bulb": 34.7, "wet_bulb": 26.7, "pressure_kpa": 99.85},
        "winter": {"dry_bulb": -7.7, "relative_humidity": 54, "pressure_kpa": 102.02},
    },
    "青岛": {
        "altitude_m": 76.0,
        "summer": {"dry_bulb": 29.4, "wet_bulb": 26.0, "pressure_kpa": 99.72},
        "winter": {"dry_bulb": -7.2, "relative_humidity": 64, "pressure_kpa": 101.69},
    },
    "沈阳": {
        "altitude_m": 41.6,
        "summer": {"dry_bulb": 31.5, "wet_bulb": 25.4, "pressure_kpa": 100.07},
        "winter": {"dry_bulb": -20.7, "relative_humidity": 64, "pressure_kpa": 102.08},
    },
    "大连": {
        "altitude_m": 92.8,
        "summer": {"dry_bulb": 29.0, "wet_bulb": 25.0, "pressure_kpa": 99.47},
        "winter": {"dry_bulb": -13.0, "relative_humidity": 58, "pressure_kpa": 101.38},
    },
    "哈尔滨": {
        "altitude_m": 171.7,
        "summer": {"dry_bulb": 30.7, "wet_bulb": 23.4, "pressure_kpa": 98.51},
        "winter": {"dry_bulb": -27.1, "relative_humidity": 74, "pressure_kpa": 100.15},
    },
    "长春": {
        "altitude_m": 236.8,
        "summer": {"dry_bulb": 30.5, "wet_bulb": 24.2, "pressure_kpa": 97.79},
        "winter": {"dry_bulb": -24.3, "relative_humidity": 68, "pressure_kpa": 99.40},
    },
    "石家庄": {
        "altitude_m": 80.5,
        "summer": {"dry_bulb": 35.1, "wet_bulb": 26.6, "pressure_kpa": 99.56},
        "winter": {"dry_bulb": -8.8, "relative_humidity": 52, "pressure_kpa": 101.69},
    },
    "太原": {
        "altitude_m": 777.9,
        "summer": {"dry_bulb": 31.5, "wet_bulb": 23.4, "pressure_kpa": 91.92},
        "winter": {"dry_bulb": -12.8, "relative_humidity": 51, "pressure_kpa": 93.29},
    },
    "合肥": {
        "altitude_m": 29.8,
        "summer": {"dry_bulb": 35.0, "wet_bulb": 28.2, "pressure_kpa": 100.09},
        "winter": {"dry_bulb": -4.2, "relative_humidity": 75, "pressure_kpa": 102.23},
    },
    "南昌": {
        "altitude_m": 46.7,
        "summer": {"dry_bulb": 35.5, "wet_bulb": 27.9, "pressure_kpa": 99.91},
        "winter": {"dry_bulb": -1.5, "relative_humidity": 74, "pressure_kpa": 101.88},
    },
    "福州": {
        "altitude_m": 84.0,
        "summer": {"dry_bulb": 35.9, "wet_bulb": 28.0, "pressure_kpa": 99.64},
        "winter": {"dry_bulb": 4.4, "relative_humidity": 74, "pressure_kpa": 101.26},
    },
    "厦门": {
        "altitude_m": 63.2,
        "summer": {"dry_bulb": 33.5, "wet_bulb": 27.6, "pressure_kpa": 99.91},
        "winter": {"dry_bulb": 6.6, "relative_humidity": 73, "pressure_kpa": 101.38},
    },
    "长沙": {
        "altitude_m": 44.9,
        "summer": {"dry_bulb": 35.8, "wet_bulb": 27.7, "pressure_kpa": 99.94},
        "winter": {"dry_bulb": -1.9, "relative_humidity": 81, "pressure_kpa": 101.99},
    },
    "南宁": {
        "altitude_m": 72.2,
        "summer": {"dry_bulb": 34.5, "wet_bulb": 27.5, "pressure_kpa": 99.60},
        "winter": {"dry_bulb": 5.7, "relative_humidity": 75, "pressure_kpa": 101.14},
    },
    "海口": {
        "altitude_m": 14.1,
        "summer": {"dry_bulb": 35.1, "wet_bulb": 27.9, "pressure_kpa": 100.24},
        "winter": {"dry_bulb": 10.3, "relative_humidity": 85, "pressure_kpa": 101.60},
    },
    "昆明": {
        "altitude_m": 1891.4,
        "summer": {"dry_bulb": 26.2, "wet_bulb": 19.9, "pressure_kpa": 80.80},
        "winter": {"dry_bulb": 0.9, "relative_humidity": 68, "pressure_kpa": 81.15},
    },
    "贵阳": {
        "altitude_m": 1071.2,
        "summer": {"dry_bulb": 30.1, "wet_bulb": 23.0, "pressure_kpa": 88.79},
        "winter": {"dry_bulb": -2.5, "relative_humidity": 78, "pressure_kpa": 89.75},
    },
    "拉萨": {
        "altitude_m": 3658.0,
        "summer": {"dry_bulb": 24.1, "wet_bulb": 13.5, "pressure_kpa": 65.23},
        "winter": {"dry_bulb": -7.6, "relative_humidity": 28, "pressure_kpa": 65.00},
    },
    "兰州": {
        "altitude_m": 1517.2,
        "summer": {"dry_bulb": 31.2, "wet_bulb": 20.2, "pressure_kpa": 84.31},
        "winter": {"dry_bulb": -11.5, "relative_humidity": 58, "pressure_kpa": 85.14},
    },
    "西宁": {
        "altitude_m": 2261.2,
        "summer": {"dry_bulb": 26.5, "wet_bulb": 16.4, "pressure_kpa": 77.35},
        "winter": {"dry_bulb": -13.6, "relative_humidity": 48, "pressure_kpa": 77.51},
    },
    "银川": {
        "altitude_m": 1111.5,
        "summer": {"dry_bulb": 31.2, "wet_bulb": 22.0, "pressure_kpa": 88.35},
        "winter": {"dry_bulb": -17.3, "relative_humidity": 58, "pressure_kpa": 89.57},
    },
    "乌鲁木齐": {
        "altitude_m": 917.9,
        "summer": {"dry_bulb": 33.5, "wet_bulb": 18.5, "pressure_kpa": 90.67},
        "winter": {"dry_bulb": -23.7, "relative_humidity": 80, "pressure_kpa": 91.99},
    },
    "呼和浩特": {
        "altitude_m": 1063.0,
        "summer": {"dry_bulb": 30.6, "wet_bulb": 20.8, "pressure_kpa": 88.94},
        "winter": {"dry_bulb": -20.3, "relative_humidity": 56, "pressure_kpa": 90.09},
    },
}

# 个别城市数据说明（工程留痕）
_CITY_NOTES: dict = {
    "深圳": "干球温度为 GB 50736-2012 附录A 值；海拔/大气压/湿球温度/冬季相对湿度为参考值"
            "（深圳市气象局资料及邻近台站估算），正式施工图设计请以现行规范附录A复核。",
}

_VALID_SEASONS = ("summer", "winter")


def _normalize_city_name(city: str) -> str:
    """城市名归一化：去空格、去行政区划后缀（市/地区）。"""
    name = (city or "").strip()
    for suffix in ("市", "地区"):
        if name.endswith(suffix) and len(name) > len(suffix):
            name = name[: -len(suffix)]
            break
    return name


def list_cities() -> list:
    """列出气候库所有城市名。"""
    return list(CITY_CLIMATE_DB.keys())


def get_city_climate(city: str, season: str = "summer") -> dict:
    """查询某城市某季节的室外计算参数。

    城市名支持别名（"广州" / "广州市" 均可）。
    返回 dict: city / season / altitude_m / pressure_kpa / dry_bulb
               （夏季含 wet_bulb，冬季含 relative_humidity）/ note(如有)
    未收录城市或季节错误时抛 ValueError。
    """
    if season not in _VALID_SEASONS:
        raise ValueError(f"季节参数无效: {season!r}，只支持 'summer' / 'winter'")

    name = _normalize_city_name(city)
    entry = CITY_CLIMATE_DB.get(name)
    if entry is None:
        raise ValueError(
            f"未收录城市: {city!r}，可选城市: {', '.join(CITY_CLIMATE_DB.keys())}"
        )

    result = {
        "city": name,
        "season": season,
        "altitude_m": entry["altitude_m"],
        **entry[season],
    }
    if name in _CITY_NOTES:
        result["note"] = _CITY_NOTES[name]
    return result


def find_city(city: str) -> Optional[str]:
    """归一化查找城市，命中返回标准名，未命中返回 None。"""
    name = _normalize_city_name(city)
    return name if name in CITY_CLIMATE_DB else None
