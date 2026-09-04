"""废气处理统一常量（唯一数据源）"""

# 污染物处理效率（技术 × 污染物 → 效率）
TREATMENT_EFFICIENCY = {
    "activated_carbon": {"VOCs": 0.90, "HCl": 0.50, "NH3": 0.60, "H2S": 0.70, "odor": 0.80},
    "wet_scrubber": {"HCl": 0.95, "H2SO4": 0.95, "HNO3": 0.95, "NH3": 0.90, "Cl2": 0.90, "SO2": 0.85, "acid_mist": 0.95, "alkali_mist": 0.90, "particulate": 0.85},
    "uv_photolysis": {"VOCs": 0.70, "H2S": 0.60, "odor": 0.70},
    "plasma": {"VOCs": 0.85},
    "hepa_filter": {"biohazard": 0.9995},
    "filter": {"particulate": 0.80},
    "combined": {"VOCs": 0.95, "HCl": 0.95, "H2SO4": 0.95, "NH3": 0.95},
}

# 排放限值（mg/m³）
EMISSION_LIMITS = {
    "VOCs": 60,
    "HCl": 20,
    "H2SO4": 10,
    "HNO3": 15,
    "NH3": 30,
    "H2S": 5,
    "Cl2": 5,
    "SO2": 50,
    "NOx": 100,
    "odor": 20,
}

# 处理设备阻力（Pa）
EQUIPMENT_RESISTANCE = {
    "activated_carbon": 650,
    "wet_scrubber": 1000,
    "uv_photolysis": 400,
    "plasma": 400,
    "hepa_filter": 400,
    "filter": 250,
    "combined": 1400,
}
