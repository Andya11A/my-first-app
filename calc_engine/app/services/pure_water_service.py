"""纯水系统计算服务"""

def calculate_pure_water_system(
    daily_usage_l: float,
    peak_factor: float = 2.0,
    water_quality: str = "ultrapure",  # pure/ultrapure
    usage_hours: float = 8.0,
    recovery_rate: float = 0.6,
) -> dict:
    """计算纯水系统规模和储罐容量"""
    # 1. 峰值流量
    peak_flow_l_h = daily_usage_l * peak_factor / usage_hours

    # 2. 制水设备选型
    if water_quality == "ultrapure":
        equipment_capacity = peak_flow_l_h * 1.3  # 超纯水需要30%冗余
        equipment_type = "二级RO+EDI+抛光混床"
    else:
        equipment_capacity = peak_flow_l_h * 1.2
        equipment_type = "单级RO"

    # 3. 储罐容量
    storage_tank_l = daily_usage_l * 0.5 * peak_factor

    # 4. 原水消耗
    raw_water_daily = daily_usage_l / recovery_rate

    return {
        "daily_usage_l": round(daily_usage_l, 1),
        "peak_flow_l_h": round(peak_flow_l_h, 1),
        "equipment_capacity_l_h": round(equipment_capacity, 1),
        "equipment_type": equipment_type,
        "storage_tank_l": round(storage_tank_l, 0),
        "raw_water_daily_l": round(raw_water_daily, 0),
        "recovery_rate_pct": recovery_rate * 100,
        "formula": "峰值流量=日用量×峰值系数/使用时长；储罐=日用量×50%×峰值系数",
    }
