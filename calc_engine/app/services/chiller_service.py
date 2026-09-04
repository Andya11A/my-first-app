"""冷热源选型计算服务"""

def calculate_chiller_selection(
    total_cooling_load_kw: float,
    chilled_water_supply_temp: float = 7.0,
    chilled_water_return_temp: float = 12.0,
    cooling_water_supply_temp: float = 32.0,
    cooling_water_return_temp: float = 37.0,
    chiller_count: int = 2,
) -> dict:
    """计算冷水机组选型和配套水泵"""
    # 1. 单台机组容量（N+1冗余，至少2台）
    n = max(2, chiller_count)
    per_chiller = total_cooling_load_kw / (n - 1) if n > 1 else total_cooling_load_kw  # N-1台承担全部

    # 2. 冷冻水流量
    delta_t_chilled = chilled_water_return_temp - chilled_water_supply_temp
    chilled_flow_total = (total_cooling_load_kw * 3.6) / (4.186 * delta_t_chilled) if delta_t_chilled > 0 else 0
    chilled_flow_per_chiller = chilled_flow_total / n

    # 3. 冷却水流量（约冷冻水的1.2倍）
    cooling_flow_total = chilled_flow_total * 1.2
    cooling_flow_per_chiller = cooling_flow_total / n

    # 4. 冷冻水泵扬程估算（约30m）
    chilled_pump_head = 30.0
    chilled_pump_power = (chilled_flow_per_chiller * 9.81 * chilled_pump_head) / (3600 * 0.7)

    # 5. 冷却水泵扬程估算（约25m）
    cooling_pump_head = 25.0
    cooling_pump_power = (cooling_flow_per_chiller * 9.81 * cooling_pump_head) / (3600 * 0.7)

    return {
        "total_cooling_load_kw": round(total_cooling_load_kw, 1),
        "chiller_count": n,
        "per_chiller_capacity_kw": round(per_chiller, 1),
        "redundancy": f"N-1冗余（{n}台，{n-1}台承担100%负荷）",
        "chilled_water_flow_total_m3_h": round(chilled_flow_total, 1),
        "chilled_water_flow_per_chiller_m3_h": round(chilled_flow_per_chiller, 1),
        "cooling_water_flow_total_m3_h": round(cooling_flow_total, 1),
        "chilled_pump_head_m": chilled_pump_head,
        "chilled_pump_power_kw": round(chilled_pump_power, 2),
        "cooling_pump_head_m": cooling_pump_head,
        "cooling_pump_power_kw": round(cooling_pump_power, 2),
        "formula": "冷冻水流量=冷量×3.6/(4.186×Δt)；泵功率=流量×扬程×9.81/(3600×0.7)",
    }
