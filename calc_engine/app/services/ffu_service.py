"""FFU循环风系统计算服务（工程级）"""

import math

# ========== 洁净等级设计参数 ==========
CLEANROOM_CONFIG = {
    "ISO5": {
        "name": "百级 / ISO 5",
        "airflow_method": "velocity",       # 截面风速法
        "design_velocity": 0.35,             # 设计截面风速 m/s
        "velocity_range": (0.20, 0.50),      # 允用范围
        "air_changes": 300,                  # 参考换气次数（体积法换算时）
        "typical_ach": (240, 480),
    },
    "ISO6": {
        "name": "千级 / ISO 6",
        "airflow_method": "ach",             # 换气次数法
        "design_velocity": 0.25,
        "velocity_range": (0.15, 0.35),
        "air_changes": 50,
        "typical_ach": (40, 70),
    },
    "ISO7": {
        "name": "万级 / ISO 7",
        "airflow_method": "ach",
        "design_velocity": 0.20,
        "velocity_range": (0.10, 0.30),
        "air_changes": 25,
        "typical_ach": (15, 30),
    },
    "ISO8": {
        "name": "十万级 / ISO 8",
        "airflow_method": "ach",
        "design_velocity": 0.15,
        "velocity_range": (0.10, 0.20),
        "air_changes": 15,
        "typical_ach": (10, 20),
    },
}

# ========== FFU 标准规格 ==========
FFU_SPECS = {
    "575x575": {
        "width_mm": 575, "length_mm": 575,
        "area_m2": 0.331,
        "typical_airflow": 450,      # 典型风量 m³/h（面风速约0.38m/s）
        "airflow_range": (300, 600),
    },
    "1175x575": {
        "width_mm": 1175, "length_mm": 575,
        "area_m2": 0.676,
        "typical_airflow": 900,      # 面风速约0.37m/s
        "airflow_range": (600, 1200),
    },
    "1175x1175": {
        "width_mm": 1175, "length_mm": 1175,
        "area_m2": 1.381,
        "typical_airflow": 1800,     # 面风速约0.36m/s
        "airflow_range": (1200, 2400),
    },
}

# ========== 高效过滤器阻力 ==========
HEPA_FILTER_RESISTANCE = {
    "H13": {"initial_pa": 100, "final_pa": 220, "design_pa": 150},
    "H14": {"initial_pa": 120, "final_pa": 250, "design_pa": 180},
}

AIR_DENSITY = 1.2  # kg/m³


def calculate_ffu_system(
    room_length_m: float,
    room_width_m: float,
    room_height_m: float,
    clean_class: str,
    ffu_spec: str = "1175x575",
    hepa_grade: str = "H14",
    filter_condition: str = "design",  # initial/design/final
    single_ffu_airflow_m3_h: float = None,  # 不传则用典型风量
) -> dict:
    """完整FFU循环风系统计算"""
    config = CLEANROOM_CONFIG.get(clean_class)
    if not config:
        raise ValueError(f"不支持的洁净等级: {clean_class}")

    spec = FFU_SPECS.get(ffu_spec)
    if not spec:
        raise ValueError(f"不支持的FFU规格: {ffu_spec}")

    hepa = HEPA_FILTER_RESISTANCE.get(hepa_grade)
    if not hepa:
        raise ValueError(f"不支持的高效过滤器等级: {hepa_grade}")

    # ========== ① 房间几何 ==========
    room_area = room_length_m * room_width_m
    room_volume = room_area * room_height_m
    room_aspect = max(room_length_m, room_width_m) / max(min(room_length_m, room_width_m), 0.1)

    # ========== ② 循环风量计算 ==========
    if config["airflow_method"] == "velocity":
        # 截面风速法（ISO5满布FFU）：Q = 面积 × 截面风速 × 3600
        design_velocity = config["design_velocity"]
        total_airflow = room_area * design_velocity * 3600
        airflow_method_desc = f"截面风速法：{room_area:.2f}㎡ × {design_velocity:.2f}m/s × 3600"
    else:
        # 换气次数法：Q = 体积 × 换气次数
        total_airflow = room_volume * config["air_changes"]
        airflow_method_desc = f"换气次数法：{room_volume:.2f}m³ × {config['air_changes']}次/h"

    # ========== ③ FFU 单台风量 ==========
    if single_ffu_airflow_m3_h is None:
        single_ffu_airflow = spec["typical_airflow"]
    else:
        single_ffu_airflow = single_ffu_airflow_m3_h

    # ========== ④ FFU 数量 ==========
    ffu_count = max(1, math.ceil(total_airflow / single_ffu_airflow))

    # ========== ⑤ 面风速校核（关键） ==========
    # 单台FFU出口面风速 = 风量 / FFU面积 / 3600
    face_velocity = single_ffu_airflow / spec["area_m2"] / 3600
    velocity_range = config["velocity_range"]
    velocity_compliant = velocity_range[0] <= face_velocity <= velocity_range[1]

    # 实际总循环风量
    actual_total_airflow = ffu_count * single_ffu_airflow

    # 实际换气次数
    actual_ach = actual_total_airflow / room_volume if room_volume > 0 else 0

    # ========== ⑥ FFU 全压计算（关键） ==========
    # 出风面动压
    dynamic_pressure = 0.5 * AIR_DENSITY * face_velocity ** 2

    # 高效过滤器阻力（按状态）
    filter_resistance = hepa[f"{filter_condition}_pa"]

    # 进风均流 + 静压箱损失（经验值）
    inlet_and_plenum_loss = 50.0

    # FFU 全压
    ffu_total_pressure = dynamic_pressure + filter_resistance + inlet_and_plenum_loss

    # ========== ⑦ 覆盖率 ==========
    total_ffu_area = ffu_count * spec["area_m2"]
    coverage_ratio = total_ffu_area / room_area if room_area > 0 else 0

    # ========== ⑧ 行列布局 ==========
    # 按房间长宽比例估算行列数（FFU长边沿房间长边）
    ffu_cols = max(1, math.ceil(room_length_m / (spec["length_mm"] / 1000)))
    ffu_rows = max(1, math.ceil(room_width_m / (spec["width_mm"] / 1000)))
    layout_total = ffu_cols * ffu_rows
    layout_note = f"{ffu_rows}行 × {ffu_cols}列 = {layout_total}台" if layout_total >= ffu_count else f"{ffu_rows}行 × {ffu_cols}列（网格最大{layout_total}台，实际取{ffu_count}台）"

    # ========== ⑨ 总功率 ==========
    # 单台功率估算：风量×全压/(3600×效率0.35×传动0.9)
    single_power_w = single_ffu_airflow * ffu_total_pressure / (3600 * 0.35 * 0.9)
    total_power_kw = ffu_count * single_power_w / 1000

    # ========== ⑩ 能耗 ==========
    # 年运行能耗（24h×365，按0.85同时运行率）
    annual_energy_kwh = total_power_kw * 24 * 365 * 0.85

    return {
        "clean_class": clean_class,
        "clean_class_name": config["name"],
        # 房间
        "room": {
            "length_m": round(room_length_m, 2),
            "width_m": round(room_width_m, 2),
            "height_m": round(room_height_m, 2),
            "area_m2": round(room_area, 2),
            "volume_m3": round(room_volume, 2),
        },
        # 风量
        "airflow": {
            "method": config["airflow_method"],
            "method_desc": airflow_method_desc,
            "design_total_airflow_m3_h": round(total_airflow, 0),
            "actual_total_airflow_m3_h": round(actual_total_airflow, 0),
            "design_ach": config["air_changes"],
            "actual_ach": round(actual_ach, 1),
        },
        # FFU选型
        "ffu": {
            "spec": ffu_spec,
            "single_airflow_m3_h": round(single_ffu_airflow, 0),
            "count": ffu_count,
            "coverage_ratio_pct": round(coverage_ratio * 100, 1),
            "layout": layout_note,
        },
        # 面风速
        "face_velocity": {
            "value_m_s": round(face_velocity, 3),
            "range": [velocity_range[0], velocity_range[1]],
            "compliant": velocity_compliant,
        },
        # 全压
        "pressure": {
            "dynamic_pressure_pa": round(dynamic_pressure, 1),
            "hepa_filter_grade": hepa_grade,
            "filter_condition": filter_condition,
            "filter_resistance_pa": filter_resistance,
            "inlet_plenum_loss_pa": inlet_and_plenum_loss,
            "ffu_total_pressure_pa": round(ffu_total_pressure, 0),
        },
        # 功率能耗
        "power": {
            "single_power_w": round(single_power_w, 1),
            "total_power_kw": round(total_power_kw, 2),
            "annual_energy_kwh": round(annual_energy_kwh, 0),
        },
        "formula": "面风速=单台风量/FFU面积/3600；全压=动压+过滤器阻力+静压箱损失",
    }
