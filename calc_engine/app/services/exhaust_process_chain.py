"""废气处理工艺链知识库"""

from app.services.exhaust_constants import EQUIPMENT_RESISTANCE, TREATMENT_EFFICIENCY

# ========== 污染物类型清单 ==========
POLLUTANT_TYPES = {
    "VOCs": {
        "name": "挥发性有机物",
        "sources": ["有机试剂", "溶剂", "样品前处理"],
        "typical_concentration": (50, 500),
        "treatments": ["activated_carbon", "uv_photolysis", "plasma", "combined"],
    },
    "acid_mist": {
        "name": "酸雾（HCl/H2SO4/HNO3）",
        "sources": ["消解", "酸洗", "化学分析"],
        "typical_concentration": (10, 100),
        "treatments": ["wet_scrubber", "combined"],
    },
    "alkali_mist": {
        "name": "碱雾（NH3）",
        "sources": ["氨水使用", "氮分析"],
        "typical_concentration": (10, 50),
        "treatments": ["wet_scrubber"],
    },
    "odor": {
        "name": "恶臭（H2S/硫醇）",
        "sources": ["微生物培养", "污水处理"],
        "typical_concentration": (1, 20),
        "treatments": ["activated_carbon", "uv_photolysis"],
    },
    "particulate": {
        "name": "颗粒物",
        "sources": ["研磨", "粉碎", "样品处理"],
        "typical_concentration": (1, 50),
        "treatments": ["filter", "wet_scrubber"],
    },
    "biohazard": {
        "name": "生物气溶胶",
        "sources": ["生物安全柜排风", "感染性操作"],
        "typical_concentration": None,
        "treatments": ["hepa_filter"],
    },
}

# ========== 处理技术清单 ==========
TREATMENT_TECHNOLOGIES = {
    "activated_carbon": {
        "name": "活性炭吸附",
        "applicable": ["VOCs", "odor"],
        "airflow_range": (500, 20000),
        "equipment": "活性炭吸附箱（蜂窝炭/颗粒炭）",
        "replacement": "3-6个月更换活性炭",
    },
    "wet_scrubber": {
        "name": "湿式喷淋塔",
        "applicable": ["acid_mist", "alkali_mist", "particulate"],
        "airflow_range": (1000, 50000),
        "equipment": "填料喷淋塔（PP材质+循环泵+加药系统）",
        "replacement": "循环液定期更换",
    },
    "uv_photolysis": {
        "name": "UV光解",
        "applicable": ["VOCs", "odor"],
        "airflow_range": (500, 15000),
        "equipment": "UV光解净化器（UV灯管组）",
        "replacement": "灯管寿命约8000小时",
    },
    "plasma": {
        "name": "低温等离子",
        "applicable": ["VOCs"],
        "airflow_range": (500, 15000),
        "equipment": "等离子净化器（电极组）",
        "replacement": "电极定期清洗",
    },
    "hepa_filter": {
        "name": "高效过滤器",
        "applicable": ["biohazard"],
        "airflow_range": (100, 50000),
        "equipment": "H13/H14高效过滤器+密封箱体",
        "replacement": "阻力达到初阻2倍时更换",
    },
    "filter": {
        "name": "袋式/初效过滤器",
        "applicable": ["particulate"],
        "airflow_range": (500, 30000),
        "equipment": "初效G4+中效F8过滤箱",
        "replacement": "1-3个月更换滤袋",
    },
}

# 阻力与效率统一从 exhaust_constants 取（唯一数据源）
for _tech, _detail in TREATMENT_TECHNOLOGIES.items():
    _detail["resistance_pa"] = EQUIPMENT_RESISTANCE[_tech]
    _detail["efficiency"] = TREATMENT_EFFICIENCY[_tech]

# ========== 工艺组合推荐 ==========
LAB_EXHAUST_RECOMMENDATIONS = {
    "化学实验室": {
        "pollutants": ["acid_mist", "VOCs", "odor"],
        "recommended_chain": ["wet_scrubber", "activated_carbon"],
        "reason": "先除酸雾保护后续活性炭，再用活性炭吸附VOCs",
    },
    "有机合成实验室": {
        "pollutants": ["VOCs"],
        "recommended_chain": ["activated_carbon", "uv_photolysis"],
        "reason": "活性炭主处理+UV深度净化确保达标",
    },
    "PCR实验室": {
        "pollutants": ["biohazard", "VOCs"],
        "recommended_chain": ["hepa_filter", "activated_carbon"],
        "reason": "高效过滤生物气溶胶+活性炭除核酸提取溶剂",
    },
    "微生物实验室": {
        "pollutants": ["biohazard", "odor"],
        "recommended_chain": ["hepa_filter", "activated_carbon"],
        "reason": "高效过滤+活性炭除臭",
    },
    "理化实验室": {
        "pollutants": ["acid_mist", "VOCs"],
        "recommended_chain": ["wet_scrubber", "activated_carbon"],
        "reason": "酸碱中和+有机吸附",
    },
    "医院检验科": {
        "pollutants": ["biohazard", "odor"],
        "recommended_chain": ["hepa_filter", "uv_photolysis"],
        "reason": "生物安全+除臭",
    },
}

# ========== 工艺链计算函数 ==========

def recommend_exhaust_chain(lab_type: str) -> dict:
    """根据实验室类型推荐废气处理工艺链"""
    rec = LAB_EXHAUST_RECOMMENDATIONS.get(lab_type)
    if not rec:
        return {
            "lab_type": lab_type,
            "recommended_chain": ["activated_carbon"],
            "reason": "通用：活性炭吸附适用于大多数实验室废气",
            "chain_details": [TREATMENT_TECHNOLOGIES["activated_carbon"]],
        }

    chain_details = [TREATMENT_TECHNOLOGIES[t] for t in rec["recommended_chain"]]
    total_resistance = sum(t["resistance_pa"] for t in chain_details)

    return {
        "lab_type": lab_type,
        "pollutants": rec["pollutants"],
        "recommended_chain": rec["recommended_chain"],
        "chain_names": [TREATMENT_TECHNOLOGIES[t]["name"] for t in rec["recommended_chain"]],
        "reason": rec["reason"],
        "chain_details": [
            {
                "technology": t,
                "name": TREATMENT_TECHNOLOGIES[t]["name"],
                "equipment": TREATMENT_TECHNOLOGIES[t]["equipment"],
                "resistance_pa": TREATMENT_TECHNOLOGIES[t]["resistance_pa"],
                "airflow_range": TREATMENT_TECHNOLOGIES[t]["airflow_range"],
            }
            for t in rec["recommended_chain"]
        ],
        "total_resistance_pa": total_resistance,
    }
