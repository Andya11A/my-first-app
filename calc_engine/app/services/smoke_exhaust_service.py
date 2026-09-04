"""消防排烟计算服务"""

def calculate_smoke_exhaust(
    room_area: float,
    room_height: float,
    room_type: str = "normal",  # normal/atrium/corridor
    fire_zone_area: float | None = None,
) -> dict:
    """计算机械排烟量（依据GB 51251-2017）"""
    # 1. 防烟分区面积
    zone_area = fire_zone_area or min(room_area, 500.0)  # 每个防烟分区≤500㎡

    # 2. 排烟量计算
    if room_type == "atrium":
        # 中庭：按体积6次/h
        volume = zone_area * room_height
        exhaust_volume = volume * 6.0
    elif room_type == "corridor":
        # 走道：按面积60m³/(h·㎡)
        exhaust_volume = zone_area * 60.0
    else:
        # 普通房间：按面积60m³/(h·㎡)且不低于15000m³/h
        exhaust_volume = max(zone_area * 60.0, 15000.0)

    # 3. 排烟口数量（每个排烟口服务面积≤500㎡，至少1个）
    vent_count = max(1, round(zone_area / 500.0 + 0.5))

    # 4. 补风量（不小于排烟量的50%）
    makeup_air = exhaust_volume * 0.5

    return {
        "fire_zone_area_m2": round(zone_area, 1),
        "exhaust_volume_m3_h": round(exhaust_volume, 0),
        "vent_count": vent_count,
        "makeup_air_m3_h": round(makeup_air, 0),
        "room_type": room_type,
        "formula": "排烟量=防烟分区面积×60m³/(h·㎡)（普通房间≥15000m³/h；中庭按体积6次/h）",
    }
