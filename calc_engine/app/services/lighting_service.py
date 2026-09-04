"""照度计算服务（利用系数法）"""

def calculate_room_index(room_length: float, room_width: float, work_plane_height: float, luminaire_height: float) -> float:
    """计算室形指数 RI = L×W / (H×(L+W))"""
    h = luminaire_height - work_plane_height
    if h <= 0 or (room_length + room_width) <= 0:
        return 0.0
    return (room_length * room_width) / (h * (room_length + room_width))


def calculate_lamp_count(
    room_length: float,
    room_width: float,
    target_illuminance: float,
    utilization_factor: float,
    maintenance_factor: float,
    lamp_luminous_flux: float,
    work_plane_height: float = 0.75,
    luminaire_height: float = 2.8,
) -> dict:
    """利用系数法计算灯具数量"""
    room_index = calculate_room_index(room_length, room_width, work_plane_height, luminaire_height)
    area = room_length * room_width
    total_flux = (target_illuminance * area) / (utilization_factor * maintenance_factor)
    lamp_count = total_flux / lamp_luminous_flux
    lamp_count_rounded = max(1, round(lamp_count + 0.5))
    actual_illuminance = (lamp_count_rounded * lamp_luminous_flux * utilization_factor * maintenance_factor) / area

    return {
        "room_index": round(room_index, 3),
        "area_m2": round(area, 2),
        "total_luminous_flux_lm": round(total_flux, 0),
        "lamp_count_calculated": round(lamp_count, 2),
        "lamp_count_recommended": lamp_count_rounded,
        "actual_illuminance_lx": round(actual_illuminance, 1),
        "formula": "N = E×A / (U×K×Φ)",
    }
