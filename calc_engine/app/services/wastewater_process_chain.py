"""废水处理工艺链知识库"""

# ========== 废水类型清单 ==========
WASTEWATER_TYPES = {
    "inorganic_acid": {
        "name": "无机酸性废水",
        "sources": ["酸洗", "消解", "化学分析"],
        "typical_ph": (0.5, 5.5),
        "typical_cod": (50, 200),
        "contains_heavy_metal": True,
    },
    "inorganic_alkali": {
        "name": "无机碱性废水",
        "sources": ["碱洗", "中和实验"],
        "typical_ph": (8.5, 13),
        "typical_cod": (50, 150),
        "contains_heavy_metal": False,
    },
    "organic_waste": {
        "name": "有机废水",
        "sources": ["有机合成", "生化实验", "清洗"],
        "typical_ph": (5, 9),
        "typical_cod": (500, 5000),
        "contains_heavy_metal": False,
    },
    "heavy_metal": {
        "name": "含重金属废水",
        "sources": ["重金属分析", "电镀实验"],
        "typical_ph": (2, 7),
        "typical_cod": (50, 200),
        "contains_heavy_metal": True,
    },
    "biological": {
        "name": "生物性废水",
        "sources": ["微生物培养", "生物安全实验室"],
        "typical_ph": (6, 8),
        "typical_cod": (200, 1000),
        "contains_heavy_metal": False,
    },
}

# ========== 处理工艺清单 ==========
TREATMENT_PROCESSES = {
    "equalization": {
        "name": "调节池",
        "purpose": "均质均量",
        "applicable": ["all"],
        "equipment": "调节池+搅拌器+提升泵",
    },
    "neutralization": {
        "name": "中和反应",
        "purpose": "pH调节至6-9",
        "applicable": ["inorganic_acid", "inorganic_alkali"],
        "equipment": "中和反应槽+加药系统+pH计",
    },
    "coagulation": {
        "name": "混凝沉淀",
        "purpose": "去除悬浮物和重金属",
        "applicable": ["heavy_metal", "inorganic_acid", "organic_waste"],
        "equipment": "混凝反应槽+沉淀池+加药系统",
    },
    "biochemical": {
        "name": "生化处理",
        "purpose": "降解有机物降低COD",
        "applicable": ["organic_waste", "biological"],
        "equipment": "SBR/MBR一体化设备",
    },
    "disinfection": {
        "name": "消毒",
        "purpose": "杀灭病原微生物",
        "applicable": ["biological"],
        "equipment": "紫外线消毒器或次氯酸钠投加",
    },
    "filtration": {
        "name": "过滤",
        "purpose": "深度处理",
        "applicable": ["all"],
        "equipment": "砂滤/活性炭过滤罐",
    },
}

# ========== 工艺组合推荐 ==========
LAB_WASTEWATER_RECOMMENDATIONS = {
    "化学实验室": {
        "wastewater_types": ["inorganic_acid", "inorganic_alkali", "organic_waste"],
        "recommended_chain": ["equalization", "neutralization", "coagulation", "filtration"],
        "reason": "酸碱中和+混凝沉淀+过滤",
    },
    "有机合成实验室": {
        "wastewater_types": ["organic_waste"],
        "recommended_chain": ["equalization", "biochemical", "filtration"],
        "reason": "高浓度有机废水需生化处理",
    },
    "微生物实验室": {
        "wastewater_types": ["biological"],
        "recommended_chain": ["equalization", "disinfection", "filtration"],
        "reason": "生物废水必须先消毒灭菌",
    },
    "医院检验科": {
        "wastewater_types": ["biological", "inorganic_acid"],
        "recommended_chain": ["equalization", "disinfection", "neutralization", "filtration"],
        "reason": "消毒+中和+过滤",
    },
    "理化实验室": {
        "wastewater_types": ["inorganic_acid", "heavy_metal"],
        "recommended_chain": ["equalization", "neutralization", "coagulation", "filtration"],
        "reason": "重金属需混凝沉淀去除",
    },
    "重金属分析实验室": {
        "wastewater_types": ["heavy_metal"],
        "recommended_chain": ["equalization", "coagulation", "filtration"],
        "reason": "混凝沉淀除重金属",
    },
}


def recommend_wastewater_chain(lab_type: str) -> dict:
    """根据实验室类型推荐废水处理工艺链"""
    rec = LAB_WASTEWATER_RECOMMENDATIONS.get(lab_type)
    if not rec:
        return {
            "lab_type": lab_type,
            "recommended_chain": ["equalization", "neutralization", "filtration"],
            "reason": "通用：调节+中和+过滤",
            "chain_details": [
                TREATMENT_PROCESSES[t] for t in ["equalization", "neutralization", "filtration"]
            ],
        }

    return {
        "lab_type": lab_type,
        "wastewater_types": rec["wastewater_types"],
        "recommended_chain": rec["recommended_chain"],
        "chain_names": [TREATMENT_PROCESSES[t]["name"] for t in rec["recommended_chain"]],
        "reason": rec["reason"],
        "chain_details": [
            {
                "process": t,
                "name": TREATMENT_PROCESSES[t]["name"],
                "purpose": TREATMENT_PROCESSES[t]["purpose"],
                "equipment": TREATMENT_PROCESSES[t]["equipment"],
            }
            for t in rec["recommended_chain"]
        ],
    }
