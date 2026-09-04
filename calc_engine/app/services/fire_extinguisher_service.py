"""灭火器配置计算服务"""

def calculate_fire_extinguishers(
    room_area: float,
    fire_risk_level: str = "medium",  # low/medium/high
    protection_area_per_unit: float | None = None,
) -> dict:
    """计算灭火器配置数量（依据GB 50140-2005）"""
    # 各危险等级单具灭火器最大保护面积
    default_protection = {
        "low": 100.0,     # 轻危险级
        "medium": 75.0,   # 中危险级
        "high": 50.0,     # 严重危险级
    }
    protection = protection_area_per_unit or default_protection.get(fire_risk_level, 75.0)

    count = room_area / protection
    count_rounded = max(1, round(count + 0.5))

    # 灭火器设置点最大保护距离
    max_distance = {
        "low": 25.0,
        "medium": 20.0,
        "high": 15.0,
    }.get(fire_risk_level, 20.0)

    return {
        "fire_risk_level": fire_risk_level,
        "protection_area_per_unit_m2": protection,
        "extinguisher_count_calculated": round(count, 2),
        "extinguisher_count_recommended": count_rounded,
        "max_distance_to_extinguisher_m": max_distance,
        "formula": "N = 面积 / 单具最大保护面积（GB 50140-2005）",
    }
