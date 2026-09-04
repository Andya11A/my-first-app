"""防雷接地计算服务"""

def calculate_lightning_protection(
    building_length: float,
    building_width: float,
    building_height: float,
    lightning_density: float = 4.0,  # 当地雷暴日对应落雷密度（次/km²/年）
) -> dict:
    """计算建筑物防雷等级和接闪器布置（依据GB 50057-2010）"""
    # 1. 等效受雷面积
    ae = building_length * building_width + 2 * (building_length + building_width) * (building_height * 3) ** 0.5 + 3.14 * (building_height * 3) ** 2

    # 2. 年预计雷击次数
    n = lightning_density * ae / 1000000.0

    # 3. 防雷等级判断
    if n > 0.05:
        protection_class = "第一类"
    elif n > 0.01:
        protection_class = "第二类"
    else:
        protection_class = "第三类"

    # 4. 接闪网格尺寸
    grid_size = {"第一类": (5, 5), "第二类": (10, 10), "第三类": (20, 20)}[protection_class]

    # 5. 引下线间距
    down_conductor_spacing = {"第一类": 12, "第二类": 18, "第三类": 25}[protection_class]

    # 6. 接地电阻要求
    ground_resistance = {"第一类": 10, "第二类": 10, "第三类": 30}[protection_class]

    return {
        "equivalent_area_m2": round(ae, 0),
        "expected_lightning_strikes": round(n, 4),
        "protection_class": protection_class,
        "grid_width_m": grid_size[0],
        "grid_length_m": grid_size[1],
        "down_conductor_spacing_m": down_conductor_spacing,
        "ground_resistance_ohm": ground_resistance,
        "formula": "Ae=LW+2(L+W)√(3H)+π(3H)²；N=Ng×Ae/10⁶",
    }
