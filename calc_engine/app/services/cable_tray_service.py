"""电缆桥架选型计算服务"""

def calculate_cable_tray(
    cable_quantities: dict[str, int],  # {"2.5mm²": 10, "4mm²": 5, ...}
    fill_ratio: float = 0.4,
) -> dict:
    """计算桥架尺寸"""
    # 电缆截面积近似（mm²）
    cable_areas = {
        "1.5": 18, "2.5": 22, "4": 28, "6": 35,
        "10": 50, "16": 70, "25": 95, "35": 120,
        "50": 160, "70": 200, "95": 260, "120": 320,
    }

    total_cable_area = 0.0
    cable_details = []
    for size, count in cable_quantities.items():
        area = cable_areas.get(size.replace("mm²", "").strip(), 30)
        total = area * count
        total_cable_area += total
        cable_details.append({"size": size, "count": count, "area_mm2": round(total, 1)})

    required_tray_area = total_cable_area / fill_ratio

    # 标准桥架尺寸（宽×高 mm）
    standard_trays = [
        (100, 50), (100, 75), (150, 75), (200, 100),
        (300, 100), (300, 150), (400, 100), (400, 150),
        (500, 100), (500, 150), (600, 150), (800, 150),
    ]

    selected_tray = None
    for width, height in standard_trays:
        if width * height >= required_tray_area:
            selected_tray = (width, height)
            break

    if not selected_tray:
        selected_tray = standard_trays[-1]

    return {
        "total_cable_area_mm2": round(total_cable_area, 1),
        "required_tray_area_mm2": round(required_tray_area, 1),
        "cable_details": cable_details,
        "selected_tray_width_mm": selected_tray[0],
        "selected_tray_height_mm": selected_tray[1],
        "fill_ratio_pct": fill_ratio * 100,
        "formula": "桥架面积 = Σ(电缆截面积×根数) / 填充率",
    }
