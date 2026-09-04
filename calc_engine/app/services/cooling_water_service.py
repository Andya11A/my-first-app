"""冷却水系统计算服务"""

def calculate_cooling_tower(
    cooling_load_kw: float,
    inlet_temp_c: float = 37.0,
    outlet_temp_c: float = 32.0,
    wet_bulb_temp_c: float = 28.0,
) -> dict:
    """计算冷却塔容量和冷却水流量"""
    # 1. 冷却水流量
    delta_t = inlet_temp_c - outlet_temp_c
    flow_rate_m3_h = (cooling_load_kw * 3.6) / (4.186 * delta_t) if delta_t > 0 else 0

    # 2. 冷却塔容量（考虑1.2安全系数）
    tower_capacity = cooling_load_kw * 1.2

    # 3. 补水量（蒸发+排污+漂水 ≈ 流量的2%）
    makeup_water = flow_rate_m3_h * 0.02

    # 4. 接近度
    approach = outlet_temp_c - wet_bulb_temp_c

    return {
        "cooling_load_kw": round(cooling_load_kw, 1),
        "cooling_water_flow_m3_h": round(flow_rate_m3_h, 1),
        "cooling_tower_capacity_kw": round(tower_capacity, 1),
        "makeup_water_m3_h": round(makeup_water, 2),
        "approach_k": round(approach, 1),
        "delta_t_k": round(delta_t, 1),
        "formula": "Q = 冷负荷×3.6 / (4.186×Δt)；补水量≈循环量×2%",
    }
