"""废气处理设备选型计算服务"""

from app.services.exhaust_constants import EMISSION_LIMITS, TREATMENT_EFFICIENCY


def calculate_exhaust_treatment(
    pollutant_type: str,
    inlet_concentration_mg_m3: float,
    exhaust_flow_m3_h: float,
    treatment_technology: str,
) -> dict:
    """计算废气处理后浓度和是否达标"""
    efficiency_map = TREATMENT_EFFICIENCY.get(treatment_technology, {})
    efficiency = efficiency_map.get(pollutant_type, 0.5)

    # 处理后浓度
    outlet_concentration = inlet_concentration_mg_m3 * (1 - efficiency)

    # 排放限值
    limit = EMISSION_LIMITS.get(pollutant_type, 60)

    # 是否达标
    is_compliant = outlet_concentration <= limit

    # 年排放量（按260天×10h）
    annual_emission_kg = outlet_concentration * exhaust_flow_m3_h * 2600 / 1e6

    return {
        "pollutant_type": pollutant_type,
        "inlet_concentration_mg_m3": round(inlet_concentration_mg_m3, 2),
        "treatment_technology": treatment_technology,
        "removal_efficiency_pct": round(efficiency * 100, 1),
        "outlet_concentration_mg_m3": round(outlet_concentration, 2),
        "emission_limit_mg_m3": limit,
        "is_compliant": is_compliant,
        "annual_emission_kg": round(annual_emission_kg, 2),
        "formula": "出口浓度=进口浓度×(1-去除效率)",
    }


def calculate_carbon_lifetime(
    pollutant_type: str,
    inlet_concentration_mg_m3: float,
    exhaust_flow_m3_h: float,
    carbon_fill_kg: float = 500,
    carbon_adsorption_capacity_pct: float = 0.15,
) -> dict:
    """计算活性炭使用寿命"""
    # 吸附量 = 碳重 × 吸附容量
    total_adsorption_capacity_g = carbon_fill_kg * carbon_adsorption_capacity_pct * 1000

    # 每小时吸附量
    hourly_adsorption_g = inlet_concentration_mg_m3 * exhaust_flow_m3_h / 1000.0 * 0.9  # 90%效率

    # 寿命（小时）
    lifetime_hours = total_adsorption_capacity_g / hourly_adsorption_g if hourly_adsorption_g > 0 else 0
    lifetime_days = lifetime_hours / 10  # 每天10小时

    return {
        "carbon_fill_kg": carbon_fill_kg,
        "total_adsorption_capacity_g": round(total_adsorption_capacity_g, 0),
        "hourly_adsorption_g": round(hourly_adsorption_g, 2),
        "lifetime_hours": round(lifetime_hours, 0),
        "lifetime_days": round(lifetime_days, 0),
        "replacement_cycle": f"建议每 {max(1, round(lifetime_days / 30))} 个月更换一次活性炭",
        "formula": "寿命=碳重×吸附容量/(进口浓度×风量×90%)",
    }
