"""噪声计算服务"""

import math


def calculate_noise_level(
    source_noise_db: float,
    distance_m: float,
    room_absorption_coefficient: float = 0.15,
    source_count: int = 1,
) -> dict:
    """计算距离声源特定距离处的噪声级"""
    # 简化的距离衰减公式：Lp = Lw - 20log(r) - 11 + 10log(Q)
    # 使用点声源自由场衰减
    if distance_m <= 0:
        distance_m = 0.1
    distance_attenuation = 20 * math.log10(distance_m)
    level_at_distance = source_noise_db - distance_attenuation

    # 多个声源叠加
    if source_count > 1:
        level_at_distance = level_at_distance + 10 * math.log10(source_count)

    # 室内混响修正
    level_at_distance = level_at_distance + 10 * math.log10(1 + 1 / max(room_absorption_coefficient, 0.01))

    # 达标判断（实验室噪声限值）
    limits = {"day": 60, "night": 50}
    compliant_day = level_at_distance <= limits["day"]
    compliant_night = level_at_distance <= limits["night"]

    return {
        "source_noise_db": round(source_noise_db, 1),
        "distance_m": round(distance_m, 1),
        "source_count": source_count,
        "noise_level_at_distance_db": round(level_at_distance, 1),
        "day_limit_db": limits["day"],
        "night_limit_db": limits["night"],
        "compliant_day": compliant_day,
        "compliant_night": compliant_night,
        "formula": "Lp = Lw - 20lg(r) - 11 + 10lg(Q)（点声源自由场）",
    }
