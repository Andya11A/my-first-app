"""废水处理计算服务"""


def calculate_wastewater_treatment(
    daily_flow_m3: float,
    wastewater_type: str = "laboratory",
    cod_inlet_mg_l: float = 500,
    ph_inlet: float = 7.0,
) -> dict:
    """计算废水处理系统规模和排放达标"""
    # 1. 处理工艺选择
    if wastewater_type == "acid":
        treatment_process = "中和+沉淀"
        cod_outlet = cod_inlet_mg_l * 0.3
        ph_outlet = 7.0
    elif wastewater_type == "alkali":
        treatment_process = "中和+沉淀"
        cod_outlet = cod_inlet_mg_l * 0.3
        ph_outlet = 7.0
    elif wastewater_type == "organic":
        treatment_process = "混凝沉淀+生化"
        cod_outlet = cod_inlet_mg_l * 0.15
        ph_outlet = 7.0
    else:
        treatment_process = "调节+混凝沉淀"
        cod_outlet = cod_inlet_mg_l * 0.2
        ph_outlet = 7.0

    # 2. 排放限值
    cod_limit = 500  # 排入城市污水处理厂标准
    ph_min, ph_max = 6, 9

    # 3. 达标判断
    cod_compliant = cod_outlet <= cod_limit
    ph_compliant = ph_min <= ph_outlet <= ph_max

    # 4. 处理设备容量
    equipment_capacity = daily_flow_m3 * 1.3  # 1.3倍冗余

    return {
        "daily_flow_m3": round(daily_flow_m3, 1),
        "wastewater_type": wastewater_type,
        "treatment_process": treatment_process,
        "cod_inlet_mg_l": round(cod_inlet_mg_l, 1),
        "cod_outlet_mg_l": round(cod_outlet, 1),
        "cod_limit_mg_l": cod_limit,
        "cod_compliant": cod_compliant,
        "ph_inlet": ph_inlet,
        "ph_outlet": round(ph_outlet, 1),
        "ph_range": f"{ph_min}~{ph_max}",
        "ph_compliant": ph_compliant,
        "equipment_capacity_m3_d": round(equipment_capacity, 1),
        "formula": "设备容量=日流量×1.3冗余；COD去除率按工艺类型",
    }
