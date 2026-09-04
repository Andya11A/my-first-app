"""报价-计算引擎联动服务"""

def estimate_equipment_cost(
    lab_type: str,
    area: float,
    clean_level: str = "普通",
    equipment_count: dict = None,
) -> dict:
    """根据实验室类型估算设备费用"""
    # 各实验室类型每㎡设备费用基准（元/㎡）
    equipment_cost_per_m2 = {
        "PCR实验室": 5500,
        "理化实验室": 2500,
        "微生物实验室": 3800,
        "通用实验室": 1800,
        "生物安全P2实验室": 4200,
        "生物安全P3实验室": 8500,
        "动物实验室SPF级": 6500,
        "动物实验室普通级": 3000,
        "细胞培养室": 4500,
        "恒温恒湿实验室": 3800,
        "半导体洁净室": 7000,
        "医院检验科": 3500,
        "疾控中心实验室": 4000,
        "病理实验室": 3200,
    }

    # 洁净等级系数
    clean_level_factor = {
        "普通": 1.0,
        "十万级": 1.3,
        "万级": 1.6,
        "千级": 2.0,
        "百级": 2.5,
        "SPF级": 2.0,
    }

    base_cost = equipment_cost_per_m2.get(lab_type, 2000)
    level_factor = clean_level_factor.get(clean_level, 1.0)
    equipment_cost = area * base_cost * level_factor

    return {
        "lab_type": lab_type,
        "area_m2": area,
        "clean_level": clean_level,
        "base_cost_per_m2": base_cost,
        "clean_level_factor": level_factor,
        "equipment_cost_yuan": round(equipment_cost, 0),
    }


def estimate_construction_cost(
    area: float,
    clean_level: str = "普通",
) -> dict:
    """估算施工费用"""
    # 各洁净等级施工费用（元/㎡）
    construction_cost_per_m2 = {
        "普通": 1200,
        "十万级": 2000,
        "万级": 2800,
        "千级": 3500,
        "百级": 4500,
        "SPF级": 3500,
    }

    base_cost = construction_cost_per_m2.get(clean_level, 1200)
    construction_cost = area * base_cost

    return {
        "construction_cost_per_m2": base_cost,
        "construction_cost_yuan": round(construction_cost, 0),
    }


def estimate_hvac_cost(
    area: float,
    lab_type: str,
    clean_level: str,
) -> dict:
    """估算暖通费用"""
    # 暖通费用系数（元/㎡）
    hvac_cost_per_m2 = {
        "普通": 500,
        "十万级": 900,
        "万级": 1300,
        "千级": 1800,
        "百级": 2500,
        "SPF级": 2000,
    }

    base_cost = hvac_cost_per_m2.get(clean_level, 500)
    hvac_cost = area * base_cost

    return {
        "hvac_cost_per_m2": base_cost,
        "hvac_cost_yuan": round(hvac_cost, 0),
    }


def generate_integrated_quote(
    lab_type: str,
    area: float,
    clean_level: str = "普通",
    management_fee_rate: float = 0.12,
    profit_rate: float = 0.10,
) -> dict:
    """生成完整报价（设备+施工+暖通+管理费+利润）"""
    equipment = estimate_equipment_cost(lab_type, area, clean_level)
    construction = estimate_construction_cost(area, clean_level)
    hvac = estimate_hvac_cost(area, lab_type, clean_level)

    direct_cost = equipment["equipment_cost_yuan"] + construction["construction_cost_yuan"] + hvac["hvac_cost_yuan"]
    management_fee = direct_cost * management_fee_rate
    profit = (direct_cost + management_fee) * profit_rate
    total = direct_cost + management_fee + profit

    return {
        "lab_type": lab_type,
        "area_m2": area,
        "clean_level": clean_level,
        "equipment_cost": equipment["equipment_cost_yuan"],
        "construction_cost": construction["construction_cost_yuan"],
        "hvac_cost": hvac["hvac_cost_yuan"],
        "direct_cost": round(direct_cost, 0),
        "management_fee": round(management_fee, 0),
        "profit": round(profit, 0),
        "total_quote_yuan": round(total, 0),
        "management_fee_rate": management_fee_rate,
        "profit_rate": profit_rate,
    }
