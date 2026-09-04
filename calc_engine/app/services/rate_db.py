"""工程费率数据库（管理费/利润/税金/措施费/辅材系数）

数据来源：
- 湖南省住建厅建筑安装工程费用标准表（2025-09）—— 最完整
- 福建省住建厅闽建筑〔2025〕2号
- 财政部/住建部增值税政策
"""

RATE_DB = {
    "management_fee": {
        "decoration": {"rate": 0.1515, "basis": "人工费+机械费", "source": "湖南省住建厅2025"},
        "construction": {"rate": 0.2564, "basis": "人工费+机械费", "source": "湖南省住建厅2025"},
        "installation": {"rate": 0.3216, "basis": "人工费", "source": "湖南省住建厅2025"},
    },
    "profit": {
        "decoration": {"rate": 0.1391, "basis": "人工费+机械费", "source": "湖南省住建厅2025"},
        "construction": {"rate": 0.1681, "basis": "人工费+机械费", "source": "湖南省住建厅2025"},
        "installation": {"rate": 0.20, "basis": "人工费", "source": "湖南省住建厅2025"},
    },
    "tax": {
        "general": {"rate": 0.09, "name": "增值税（一般计税）", "source": "财政部/住建部"},
        "simplified": {"rate": 0.03, "name": "增值税（简易计税）", "source": "财政部/住建部"},
    },
    "measure_fee": {
        "safety": {"rate": 0.0369, "basis": "人工费+机械费", "name": "安全生产费（装饰）", "source": "湖南省住建厅2025"},
        "civilization": {"rate": 0.0076, "basis": "人工费+机械费", "name": "文明施工费（装饰）", "source": "湖南省住建厅2025"},
        "temporary": {"rate": 0.0221, "basis": "人工费+机械费", "name": "临时设施费（装饰）", "source": "湖南省住建厅2025"},
    },
    "auxiliary_material_ratio": {
        "default": {"ratio": 0.12, "name": "辅材费占主材费比例（默认）", "source": "行业经验值，待官方校准"},
        "tile": {"ratio": 0.10, "name": "瓷砖铺贴辅材比例", "source": "土巴兔北京主材库2026"},
        "flooring": {"ratio": 0.08, "name": "地坪辅材比例", "source": "地坪行业报告2026"},
        "steel_panel": {"ratio": 0.08, "name": "彩钢板辅材比例", "source": "河南定额2008推算"},
    },
}

def get_rate(category: str, subcategory: str = "default") -> dict:
    """获取费率"""
    if category in RATE_DB:
        if subcategory in RATE_DB[category]:
            return RATE_DB[category][subcategory]
        if "default" in RATE_DB[category]:
            return RATE_DB[category]["default"]
    return {"rate": 0.0, "name": "未知费率"}

def get_auxiliary_ratio(material_category: str = "default") -> float:
    """获取辅材费比例"""
    data = RATE_DB["auxiliary_material_ratio"].get(material_category)
    if data:
        return data["ratio"]
    return RATE_DB["auxiliary_material_ratio"]["default"]["ratio"]
