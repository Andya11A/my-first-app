"""消火栓计算服务"""

def calculate_fire_hydrants(
    building_area: float,
    building_type: str = "laboratory",  # laboratory/office/warehouse
    fire_duration_h: float = 2.0,
) -> dict:
    """计算消火栓数量和用水量（依据GB 50974-2014）"""
    # 1. 同时使用水枪数
    if building_type == "laboratory":
        gun_count = 2
        water_flow_per_gun = 5.0  # L/s
    elif building_type == "warehouse":
        gun_count = 3
        water_flow_per_gun = 5.0
    else:
        gun_count = 2
        water_flow_per_gun = 5.0

    # 2. 总用水量
    total_flow = gun_count * water_flow_per_gun
    total_water = total_flow * fire_duration_h * 3600 / 1000.0  # m³

    # 3. 消火栓数量（保护半径25m，每层至少2个）
    hydrant_count = max(2, round(building_area / 500.0 + 0.5))

    # 4. 消防水池容积（含1.2安全系数）
    water_tank_volume = total_water * 1.2

    return {
        "gun_count": gun_count,
        "water_flow_per_gun_l_s": water_flow_per_gun,
        "total_flow_l_s": total_flow,
        "fire_duration_h": fire_duration_h,
        "total_water_m3": round(total_water, 1),
        "hydrant_count": hydrant_count,
        "water_tank_volume_m3": round(water_tank_volume, 0),
        "formula": "用水量=同时水枪数×单枪流量×火灾持续时间",
    }
