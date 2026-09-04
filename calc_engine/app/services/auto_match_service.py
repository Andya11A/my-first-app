"""废气废水自动匹配服务"""

from app.services.exhaust_process_chain import LAB_EXHAUST_RECOMMENDATIONS, TREATMENT_TECHNOLOGIES
from app.services.wastewater_process_chain import LAB_WASTEWATER_RECOMMENDATIONS, TREATMENT_PROCESSES

# 实验室类型别名映射
LAB_TYPE_ALIASES = {
    "化学实验室": ["化学实验室", "化学合成实验室", "chem", "chemistry"],
    "有机合成实验室": ["有机合成实验室", "有机实验室", "organic"],
    "PCR实验室": ["PCR实验室", "pcr", "基因扩增实验室", "分子诊断实验室"],
    "微生物实验室": ["微生物实验室", "micro", "微生物检测实验室"],
    "理化实验室": ["理化实验室", "物理化学实验室"],
    "医院检验科": ["医院检验科", "检验科", "临检中心"],
    "生物安全P2实验室": ["生物安全P2实验室", "P2实验室", "BSL-2", "bsl2"],
    "生物安全P3实验室": ["生物安全P3实验室", "P3实验室", "BSL-3", "bsl3"],
    "动物实验室SPF级": ["动物实验室SPF级", "SPF动物房", "动物实验室"],
    "细胞培养室": ["细胞培养室", "细胞房"],
    "病理实验室": ["病理实验室", "病理科"],
    "疾控中心实验室": ["疾控中心实验室", "CDC实验室"],
}


def normalize_lab_type(input_type: str) -> str:
    """标准化实验室类型名称"""
    for canonical, aliases in LAB_TYPE_ALIASES.items():
        if input_type in aliases or input_type.lower() in [a.lower() for a in aliases]:
            return canonical
    return input_type


def auto_match_exhaust(lab_type: str) -> dict:
    """自动匹配废气处理方案"""
    canonical = normalize_lab_type(lab_type)
    rec = LAB_EXHAUST_RECOMMENDATIONS.get(canonical)

    if not rec:
        rec = {
            "pollutants": ["VOCs"],
            "recommended_chain": ["activated_carbon"],
            "reason": "通用：活性炭吸附适用于大多数实验室废气",
        }

    chain_details = []
    total_resistance = 0
    for tech in rec["recommended_chain"]:
        detail = TREATMENT_TECHNOLOGIES[tech]
        chain_details.append({
            "technology_key": tech,
            "technology_name": detail["name"],
            "equipment": detail["equipment"],
            "resistance_pa": detail["resistance_pa"],
            "airflow_range": detail["airflow_range"],
            "replacement": detail["replacement"],
        })
        total_resistance += detail["resistance_pa"]

    return {
        "lab_type": canonical,
        "pollutants": rec["pollutants"],
        "process_chain": rec["recommended_chain"],
        "process_chain_names": [TREATMENT_TECHNOLOGIES[t]["name"] for t in rec["recommended_chain"]],
        "chain_details": chain_details,
        "total_resistance_pa": total_resistance,
        "reason": rec["reason"],
        "matching_type": "exact" if canonical in LAB_EXHAUST_RECOMMENDATIONS else "generic",
    }


def auto_match_wastewater(lab_type: str) -> dict:
    """自动匹配废水处理方案"""
    canonical = normalize_lab_type(lab_type)
    rec = LAB_WASTEWATER_RECOMMENDATIONS.get(canonical)

    if not rec:
        rec = {
            "wastewater_types": ["inorganic_acid"],
            "recommended_chain": ["equalization", "neutralization", "filtration"],
            "reason": "通用：调节+中和+过滤",
        }

    chain_details = []
    for proc in rec["recommended_chain"]:
        detail = TREATMENT_PROCESSES[proc]
        chain_details.append({
            "process_key": proc,
            "process_name": detail["name"],
            "purpose": detail["purpose"],
            "equipment": detail["equipment"],
        })

    return {
        "lab_type": canonical,
        "wastewater_types": rec["wastewater_types"],
        "process_chain": rec["recommended_chain"],
        "process_chain_names": [TREATMENT_PROCESSES[p]["name"] for p in rec["recommended_chain"]],
        "chain_details": chain_details,
        "reason": rec["reason"],
        "matching_type": "exact" if canonical in LAB_WASTEWATER_RECOMMENDATIONS else "generic",
    }


def auto_match_all(lab_type: str) -> dict:
    """一次性返回废气和废水匹配结果"""
    return {
        "lab_type": normalize_lab_type(lab_type),
        "exhaust": auto_match_exhaust(lab_type),
        "wastewater": auto_match_wastewater(lab_type),
    }
