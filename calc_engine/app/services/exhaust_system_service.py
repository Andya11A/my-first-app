"""完整废气系统计算服务（收集→风管→阻力→风机→处理→排放）"""

import math

from app.services.exhaust_constants import EQUIPMENT_RESISTANCE, TREATMENT_EFFICIENCY, EMISSION_LIMITS

# 常用局部阻力系数
LOCAL_RESISTANCE_COEFFICIENTS = {
    "elbow_90": 0.35,       # 90°弯头
    "elbow_45": 0.17,       # 45°弯头
    "tee_branch": 1.2,      # 三通支管
    "tee_straight": 0.3,    # 三通直通
    "damper": 0.5,          # 调节阀
    "reducer": 0.3,         # 变径
    "hood_entry": 0.5,      # 罩口入口
    "discharge": 1.0,       # 排放口
}


def calculate_collection_airflow(
    hood_count: int = 2,
    hood_type: str = "fume_hood",  # fume_hood/universal_hood/atomic_absorption
    hood_width_m: float = 1.5,
) -> dict:
    """计算各收集点风量"""
    if hood_type == "fume_hood":
        # 通风柜：面风速0.5m/s，操作口面积=宽×0.6m
        face_velocity = 0.5
        opening_area = hood_width_m * 0.6
        per_hood_airflow = face_velocity * opening_area * 3600
    elif hood_type == "universal_hood":
        # 万向罩：罩口风速10m/s，罩口直径0.15m
        per_hood_airflow = 10 * math.pi * (0.15 / 2) ** 2 * 3600
    else:
        # 原子吸收罩
        per_hood_airflow = 300

    total_airflow = per_hood_airflow * hood_count

    return {
        "hood_type": hood_type,
        "hood_count": hood_count,
        "per_hood_airflow_m3_h": round(per_hood_airflow, 0),
        "total_collection_airflow_m3_h": round(total_airflow, 0),
    }


def calculate_duct_diameter(
    airflow_m3_h: float,
    velocity_m_s: float = 8.0,
) -> dict:
    """计算风管直径"""
    area_m2 = airflow_m3_h / 3600.0 / velocity_m_s
    diameter_m = math.sqrt(4 * area_m2 / math.pi)
    diameter_mm = int((diameter_m * 1000 + 24) // 25 * 25)  # 取25mm模数

    # 实际风速
    actual_area = math.pi * (diameter_mm / 1000 / 2) ** 2
    actual_velocity = airflow_m3_h / 3600.0 / actual_area

    return {
        "airflow_m3_h": round(airflow_m3_h, 0),
        "design_velocity_m_s": velocity_m_s,
        "required_diameter_mm": round(diameter_m * 1000, 1),
        "selected_diameter_mm": diameter_mm,
        "actual_velocity_m_s": round(actual_velocity, 2),
    }


def calculate_system_resistance(
    total_airflow_m3_h: float,
    duct_length_m: float = 20,
    duct_diameter_mm: float = 300,
    elbow_count: int = 4,
    tee_count: int = 2,
    damper_count: int = 1,
    treatment_technology: str = "activated_carbon",
    air_density: float = 1.2,
) -> dict:
    """计算系统总阻力"""
    # 1. 实际风速
    diameter_m = duct_diameter_mm / 1000
    area_m2 = math.pi * (diameter_m / 2) ** 2
    velocity = total_airflow_m3_h / 3600.0 / area_m2

    # 2. 沿程阻力（达西公式，摩擦系数取0.02）
    friction_factor = 0.02
    friction_loss = friction_factor * (duct_length_m / diameter_m) * (air_density * velocity ** 2 / 2)

    # 3. 局部阻力
    dynamic_pressure = air_density * velocity ** 2 / 2
    local_loss = (
        elbow_count * LOCAL_RESISTANCE_COEFFICIENTS["elbow_90"]
        + tee_count * LOCAL_RESISTANCE_COEFFICIENTS["tee_branch"]
        + damper_count * LOCAL_RESISTANCE_COEFFICIENTS["damper"]
        + LOCAL_RESISTANCE_COEFFICIENTS["hood_entry"]
        + LOCAL_RESISTANCE_COEFFICIENTS["discharge"]
    ) * dynamic_pressure

    # 4. 设备阻力
    equipment_loss = EQUIPMENT_RESISTANCE.get(treatment_technology, 650)

    # 5. 总阻力
    total_resistance = friction_loss + local_loss + equipment_loss

    return {
        "velocity_m_s": round(velocity, 2),
        "dynamic_pressure_pa": round(dynamic_pressure, 1),
        "friction_loss_pa": round(friction_loss, 1),
        "local_loss_pa": round(local_loss, 1),
        "equipment_loss_pa": equipment_loss,
        "total_resistance_pa": round(total_resistance, 0),
        "formula": "总阻力=沿程+局部+设备",
    }


def calculate_fan_selection(
    system_airflow_m3_h: float,
    system_resistance_pa: float,
    fan_efficiency: float = 0.75,
    transmission_efficiency: float = 0.95,
) -> dict:
    """风机选型"""
    # 风机风量（1.1漏风系数）
    fan_airflow = system_airflow_m3_h * 1.1

    # 风机全压（1.2安全系数）
    fan_pressure = system_resistance_pa * 1.2

    # 风机功率
    fan_power = fan_airflow * fan_pressure / (3600 * fan_efficiency * transmission_efficiency * 1000)

    # 标准风机型号推荐（按风量和全压）
    if fan_airflow < 3000 and fan_pressure < 1500:
        fan_type = "4-72 No.3.5A 离心风机"
    elif fan_airflow < 6000 and fan_pressure < 2000:
        fan_type = "4-72 No.4.5A 离心风机"
    elif fan_airflow < 10000 and fan_pressure < 2500:
        fan_type = "4-72 No.6A 离心风机"
    else:
        fan_type = "需非标定制风机"

    return {
        "fan_airflow_m3_h": round(fan_airflow, 0),
        "fan_pressure_pa": round(fan_pressure, 0),
        "fan_power_kw": round(fan_power, 2),
        "recommended_fan_type": fan_type,
        "formula": "风机功率=风量×全压/(3600×效率×传动效率)",
    }


def calculate_exhaust_system_complete(
    hood_count: int = 2,
    hood_type: str = "fume_hood",
    hood_width_m: float = 1.5,
    duct_length_m: float = 20,
    elbow_count: int = 4,
    tee_count: int = 2,
    pollutant_type: str = "VOCs",
    inlet_concentration_mg_m3: float = 200,
    treatment_technology: str = "activated_carbon",
    exhaust_stack_height_m: float = 15,
) -> dict:
    """完整废气系统计算"""
    # 1. 收集风量
    collection = calculate_collection_airflow(hood_count, hood_type, hood_width_m)
    total_airflow = collection["total_collection_airflow_m3_h"]

    # 2. 管径
    duct = calculate_duct_diameter(total_airflow, 8.0)

    # 3. 系统阻力
    resistance = calculate_system_resistance(
        total_airflow, duct_length_m, duct["selected_diameter_mm"],
        elbow_count, tee_count, 1, treatment_technology
    )

    # 4. 风机选型
    fan = calculate_fan_selection(total_airflow, resistance["total_resistance_pa"])

    # 5. 处理效率
    efficiency = TREATMENT_EFFICIENCY.get(treatment_technology, {}).get(pollutant_type, 0.5)
    outlet_concentration = inlet_concentration_mg_m3 * (1 - efficiency)
    limit = EMISSION_LIMITS.get(pollutant_type, 60)
    compliant = outlet_concentration <= limit

    # 6. 排气筒要求
    stack_requirement = f"排气筒高度≥{exhaust_stack_height_m}m，出口风速≥8m/s，高于周围建筑物"

    return {
        "collection": collection,
        "duct": duct,
        "resistance": resistance,
        "fan": fan,
        "treatment": {
            "pollutant_type": pollutant_type,
            "inlet_concentration_mg_m3": round(inlet_concentration_mg_m3, 2),
            "treatment_technology": treatment_technology,
            "removal_efficiency_pct": round(efficiency * 100, 1),
            "outlet_concentration_mg_m3": round(outlet_concentration, 2),
            "emission_limit_mg_m3": limit,
            "is_compliant": compliant,
        },
        "stack_requirement": stack_requirement,
        "formula": "风机选型基于系统总阻力+1.2安全系数",
    }
