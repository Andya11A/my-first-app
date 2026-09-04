"""风管尺寸计算服务"""

def calculate_duct_size(
    airflow_m3_h: float,
    max_velocity_m_s: float = 8.0,
    aspect_ratio: float = 2.0,  # 宽高比
) -> dict:
    """根据风量和最大风速计算风管尺寸"""
    # 1. 截面积
    area_m2 = airflow_m3_h / 3600.0 / max_velocity_m_s

    # 2. 矩形风管尺寸（宽=高×宽高比）
    # area = w × h = (h×AR) × h = h²×AR
    height_m = (area_m2 / aspect_ratio) ** 0.5
    width_m = height_m * aspect_ratio

    # 3. 转为mm并取整（向上取50mm倍数）
    height_mm = int((height_m * 1000 + 49) // 50 * 50)
    width_mm = int((width_m * 1000 + 49) // 50 * 50)

    # 4. 实际风速校核
    actual_area = (width_mm / 1000) * (height_mm / 1000)
    actual_velocity = airflow_m3_h / 3600.0 / actual_area if actual_area > 0 else 0

    # 5. 当量直径
    equivalent_diameter = (2 * width_mm * height_mm) / (width_mm + height_mm) if (width_mm + height_mm) > 0 else 0

    return {
        "airflow_m3_h": round(airflow_m3_h, 0),
        "max_velocity_m_s": max_velocity_m_s,
        "required_area_m2": round(area_m2, 4),
        "duct_width_mm": width_mm,
        "duct_height_mm": height_mm,
        "actual_velocity_m_s": round(actual_velocity, 2),
        "equivalent_diameter_mm": round(equivalent_diameter, 0),
        "formula": "截面积=风量/3600/风速；宽=高×宽高比",
    }
