"""实验室装修工程「精确报价引擎」
================================

整合 材料 + 人工 + 辅材 + 管理费 + 利润 + 措施费 + 税金，按工程量清单逐项计价后汇总。

数据来源：
- finish_material_db.MATERIAL_DB      材料库（7大类52种，含 price_range）
- wall_system_db.WALL_SYSTEM_DB       墙体/隔断结构层材料
- labor_cost_db.LABOR_COST_DB         工种标准人工费价格表（12工种，城市系数调整）
- rate_db.RATE_DB                     管理费/利润/税金/措施费/辅材系数（湖南省住建厅2025）

计价口径（装饰装修工程，一般计税）：
    材料费 = Σ(工程量 × 材料单价三档)              # 材料单价由 price_range 解析低/中/高
    人工费 = Σ(工程量 × 工种人工单价三档)          # 人工单价按城市系数调整
    辅材费 = Σ(材料费 × 辅材系数)
    直接费 = 材料费 + 人工费 + 辅材费（机械费本工程按0计）
    管理费 = 人工费 × 15.15%        （装饰，基数=人工费+机械费）
    利润   = 人工费 × 13.91%        （装饰，基数=人工费+机械费）
    措施费 = 人工费 × (安全3.69%+文明0.76%+临设2.21%) = 人工费 × 6.66%
    税前合计 = 直接费 + 管理费 + 利润 + 措施费
    增值税 = 税前合计 × 9%（一般计税）/ 3%（简易计税）
    含税总价 = 税前合计 + 增值税

依据规范：
- GB 50500-2013 建设工程工程量清单计价规范
- 湖南省住建厅建筑安装工程费用标准表（2025-09）
- JGJ 91-2019 科学实验建筑设计规范
"""

from __future__ import annotations

from app.services.finish_material_db import MATERIAL_DB
from app.services.wall_system_db import WALL_SYSTEM_DB
from app.services.finish_config_service import _parse_price_tiers
from app.services import labor_cost_db, rate_db


# ================================================================
# 部位（英文 code）→ 中文名 / 计量单位 / 默认工种 / 材料库来源
# ------------------------------------------------------------
# part_type: ground地面 wall墙面 partition墙体 ceiling吊顶
#            door门窗 countertop台面 custom自定义
# ================================================================
PART_TYPE_MAP = {
    "ground":     {"part": "地面", "unit": "㎡",   "default_trade": "环氧地坪施工"},
    "wall":       {"part": "墙面", "unit": "㎡",   "default_trade": "涂料涂刷"},
    "partition":  {"part": "墙体", "unit": "㎡",   "default_trade": "彩钢板安装"},
    "ceiling":    {"part": "吊顶", "unit": "㎡",   "default_trade": "轻钢龙骨石膏板隔墙"},
    "door":       {"part": "门窗", "unit": "樘",   "default_trade": "气密门安装"},
    "countertop": {"part": "台面", "unit": "延米", "default_trade": "实验台安装"},
    "custom":     {"part": None,   "unit": "项",   "default_trade": None},
}

# 部位 → 材料库查找来源（精确→包含匹配）
_PART_SOURCES = {
    "ground":     [(MATERIAL_DB, "地面")],
    "wall":       [(MATERIAL_DB, "墙面"), (WALL_SYSTEM_DB, "墙面饰面")],
    "partition":  [(WALL_SYSTEM_DB, "墙体隔断"), (MATERIAL_DB, "墙面")],
    "ceiling":    [(MATERIAL_DB, "吊顶")],
    "door":       [(MATERIAL_DB, "门窗")],
    "countertop": [(MATERIAL_DB, "台面")],
}


# ================================================================
# 材料查找：返回 (匹配到的材料名, 材料信息dict)
# ================================================================
def _find_material(part_type: str, material_name: str):
    """按部位在材料库中查找材料（先精确、后包含），找不到返回 ("", {})"""
    sources = _PART_SOURCES.get(part_type)
    if sources is None:  # custom：跨全部材料库模糊查找
        all_sources = ([(MATERIAL_DB, c) for c in MATERIAL_DB]
                       + [(WALL_SYSTEM_DB, c) for c in WALL_SYSTEM_DB])
        sources = all_sources
    for db, cat in sources:
        mats = db.get(cat, {})
        if material_name in mats:
            return material_name, dict(mats[material_name])
        for db_name, db_info in mats.items():
            if material_name in db_name or db_name in material_name:
                return db_name, dict(db_info)
    return "", {}


# ================================================================
# 部位 + 材料名 → 人工工种（关键词判定，落空则用部位默认工种）
# ================================================================
def _resolve_labor_trade(part_type: str, material_name: str):
    n = material_name or ""
    nu = n.upper()
    # 1. 门类
    if part_type == "door" or "气密门" in n or "防火门" in n \
            or ("门" in n and ("钢制" in n or "不锈钢" in n)):
        return "气密门安装"
    # 2. 台面对应实验台安装
    if part_type == "countertop" or "台面" in n or "实验台" in n:
        return "实验台安装"
    # 3. 按材料关键词判定
    if "环氧" in n:
        return "环氧地坪施工"
    if "PVC" in nu or "塑胶" in n:
        return "PVC地板铺设"
    if any(k in n for k in ["瓷砖", "耐酸砖", "地砖", "墙砖", "大理石", "花岗岩", "水磨石"]):
        return "瓷砖铺贴"
    if any(k in n for k in ["涂料", "乳胶漆", "油漆", "抗菌"]):
        return "涂料涂刷"
    if any(k in n for k in ["彩钢", "岩棉", "铝蜂窝", "玻镁"]):
        return "彩钢板安装"
    if any(k in n for k in ["轻钢龙骨", "石膏板", "硅酸钙"]):
        return "轻钢龙骨石膏板隔墙"
    # 4. 部位默认工种
    return PART_TYPE_MAP.get(part_type, {}).get("default_trade")


# ================================================================
# 材料 → 辅材系数类别（rate_db.auxiliary_material_ratio 的 key）
# ================================================================
def _resolve_aux_category(material_name: str) -> str:
    n = material_name or ""
    nu = n.upper()
    if any(k in n for k in ["瓷砖", "耐酸砖", "地砖", "墙砖", "大理石", "花岗岩", "水磨石"]):
        return "tile"
    if "PVC" in nu or any(k in n for k in ["环氧", "地坪", "地板", "橡胶"]):
        return "flooring"
    if any(k in n for k in ["彩钢", "岩棉", "铝蜂窝", "玻镁", "隔墙", "龙骨", "石膏板", "硅酸钙"]):
        return "steel_panel"
    return "default"


# ================================================================
# 三档工具
# ================================================================
_TIERS = ("low", "mid", "high")


def _tier(low, mid, high, ndigits: int = 2) -> dict:
    return {"low": round(low, ndigits), "mid": round(mid, ndigits), "high": round(high, ndigits)}


def _add(a: dict, b: dict) -> dict:
    return {t: round(a[t] + b[t], 2) for t in _TIERS}


def _mul(a: dict, k: float) -> dict:
    return {t: round(a[t] * k, 2) for t in _TIERS}


# ================================================================
# 核心：精确报价
# ================================================================
def calculate_precise_quote(
    items: list[dict],
    city: str = "广州",
    tax_type: str = "general",
) -> dict:
    """按工程量清单计算实验室装修工程精确报价。

    Args:
        items: 工程量清单，每项 dict：
            - part_type:    ground/wall/partition/ceiling/door/countertop/custom
            - material_name:材料名称（从材料库选，支持模糊匹配）
            - quantity:     工程量（㎡/樘/延米/项，按部位）
            - width_factor: 仅台面用（边台1.0/仪器台1.2/中央台2.0/天平台0.8），默认1.0
        city:     地区（广州/深圳/上海/北京/成都/其他），影响人工费城市系数
        tax_type: 计税方式 general(一般计税9%) / simplified(简易计税3%)

    Returns:
        dict: items(逐项明细) / summary(费用汇总) / price_tiers(三档总价) / meta
    """
    if not items:
        raise ValueError("工程量清单不能为空（items 至少包含一项）")

    # ---------------- 费率（装饰装修工程） ----------------
    mgmt_rate = rate_db.get_rate("management_fee", "decoration")["rate"]      # 0.1515
    profit_rate = rate_db.get_rate("profit", "decoration")["rate"]            # 0.1391
    _m = rate_db.RATE_DB["measure_fee"]
    measure_rate = _m["safety"]["rate"] + _m["civilization"]["rate"] + _m["temporary"]["rate"]  # 0.0666
    tax_key = tax_type if tax_type in ("general", "simplified") else "general"
    tax_info = rate_db.get_rate("tax", tax_key)
    tax_rate = tax_info["rate"]
    city_factor = labor_cost_db.CITY_FACTORS.get(city, labor_cost_db.CITY_FACTORS["其他"])

    result_items = []
    sum_mat = {"low": 0.0, "mid": 0.0, "high": 0.0}
    sum_lab = {"low": 0.0, "mid": 0.0, "high": 0.0}
    sum_aux = {"low": 0.0, "mid": 0.0, "high": 0.0}
    meta_warnings = []

    for idx, it in enumerate(items, 1):
        part_type = (it.get("part_type") or "custom").strip()
        mat_name = (it.get("material_name") or "").strip()
        qty = float(it.get("quantity", 0) or 0)
        width_factor = float(it.get("width_factor", 1.0) or 1.0)
        grade = (it.get("material_grade") or "").strip() or None

        pinfo = PART_TYPE_MAP.get(part_type, PART_TYPE_MAP["custom"])
        unit = pinfo["unit"]
        is_counter = part_type == "countertop"
        # 台面按宽度系数折算有效工程量（延米@750 基准；中央台×2.0）
        eff_qty = qty * (width_factor if is_counter else 1.0)

        item_warn = []

        # ---- 材料费 ----
        resolved_name, info = _find_material(part_type, mat_name)
        price_str = info.get("price_range", "")
        # 档位校验：指定了 grade 但价格串中不含该档位关键词时提示（解析会回退到默认档）
        if grade and price_str and grade not in price_str:
            item_warn.append(f"材料「{mat_name}」的价格信息中未找到档位「{grade}」，已按默认（经济）档计价")
        m_low, m_mid, m_high = _parse_price_tiers(price_str, grade)
        if not resolved_name or (m_low == 0 and m_high == 0):
            item_warn.append(f"材料「{mat_name}」未在材料库匹配到有效价格，材料费按0计，需人工询价")

        # ---- 人工费 ----
        trade = _resolve_labor_trade(part_type, mat_name)
        l_low = l_mid = l_high = 0.0
        labor_source = ""
        if trade:
            lc = labor_cost_db.get_labor_cost(trade, city)
            l_low, l_high = lc.get("low", 0), lc.get("high", 0)
            l_mid = round((l_low + l_high) / 2, 2)
            labor_source = lc.get("source", "")
            if l_low == 0 and l_high == 0:
                item_warn.append(f"工种「{trade}」无人工费数据，人工费按0计，需人工补充")
        else:
            item_warn.append(f"未能根据材料「{mat_name}」判定人工工种，人工费按0计，需人工补充")

        # ---- 辅材费 ----
        aux_cat = _resolve_aux_category(mat_name)
        aux_ratio = rate_db.get_auxiliary_ratio(aux_cat)

        # ---- 分项费用（三档） ----
        mat_cost = _tier(m_low * eff_qty, m_mid * eff_qty, m_high * eff_qty)
        lab_cost = _tier(l_low * eff_qty, l_mid * eff_qty, l_high * eff_qty)
        aux_cost = _mul(mat_cost, aux_ratio)

        sum_mat = _add(sum_mat, mat_cost)
        sum_lab = _add(sum_lab, lab_cost)
        sum_aux = _add(sum_aux, aux_cost)

        result_items.append({
            "index": idx,
            "part_type": part_type,
            "part_name": pinfo["part"] or "自定义",
            "material_input": mat_name,
            "material_resolved": resolved_name or mat_name,
            "material_matched": bool(resolved_name),
            "material_grade": grade,
            "quantity": qty,
            "unit": unit,
            "width_factor": width_factor if is_counter else None,
            "effective_qty": round(eff_qty, 2),
            "labor_trade": trade,
            "aux_category": aux_cat,
            "material_unit_price": _tier(m_low, m_mid, m_high),
            "labor_unit_price": _tier(l_low, l_mid, l_high),
            "aux_ratio": aux_ratio,
            "material_cost": mat_cost,
            "labor_cost": lab_cost,
            "auxiliary_cost": aux_cost,
            "item_total": _add(_add(mat_cost, lab_cost), aux_cost),
            "labor_source": labor_source,
            "warnings": item_warn,
        })
        if item_warn:
            meta_warnings.extend([f"[第{idx}项 {mat_name}] {w}" for w in item_warn])

    # ---------------- 费用汇总 ----------------
    material_fee = sum_mat
    labor_fee = sum_lab
    auxiliary_fee = sum_aux
    direct_fee = _add(_add(material_fee, labor_fee), auxiliary_fee)          # 直接费
    machinery_fee = {"low": 0.0, "mid": 0.0, "high": 0.0}                    # 机械费（本工程按0）
    management_fee = _mul(labor_fee, mgmt_rate)                              # 管理费
    profit_fee = _mul(labor_fee, profit_rate)                                # 利润
    measure_fee = _mul(labor_fee, measure_rate)                              # 措施费
    pre_tax = _add(_add(_add(direct_fee, management_fee), profit_fee), measure_fee)  # 税前合计
    vat_fee = _mul(pre_tax, tax_rate)                                        # 增值税
    total_with_tax = _add(pre_tax, vat_fee)                                  # 含税总价

    summary = {
        "material_fee": material_fee,
        "labor_fee": labor_fee,
        "auxiliary_fee": auxiliary_fee,
        "machinery_fee": machinery_fee,
        "direct_fee": direct_fee,
        "management_fee": management_fee,
        "profit": profit_fee,
        "measure_fee": measure_fee,
        "pre_tax_total": pre_tax,
        "vat": vat_fee,
        "total_with_tax": total_with_tax,
    }

    price_tiers = {
        "low": total_with_tax["low"],
        "mid": total_with_tax["mid"],
        "high": total_with_tax["high"],
    }

    meta = {
        "city": city,
        "city_factor": city_factor,
        "tax_type": tax_key,
        "tax_name": tax_info.get("name", ""),
        "rates": {
            "management_fee": {"rate": mgmt_rate, "basis": "人工费+机械费", "category": "装饰装修工程"},
            "profit": {"rate": profit_rate, "basis": "人工费+机械费", "category": "装饰装修工程"},
            "measure_fee": {
                "safety": _m["safety"]["rate"],
                "civilization": _m["civilization"]["rate"],
                "temporary": _m["temporary"]["rate"],
                "combined": round(measure_rate, 4),
                "basis": "人工费+机械费",
            },
            "vat": {"rate": tax_rate, "name": tax_info.get("name", "")},
        },
        "material_price_basis": "材料单价取全国市场综合价（finish_material_db / wall_system_db），未按城市调差",
        "labor_price_basis": f"人工单价取 labor_cost_db 标准价格表，按{city}城市系数{city_factor}调整",
        "counting_basis": (
            "材料费=Σ工程量×材料单价(三档)；人工费=Σ工程量×工种人工单价(城市系数)；"
            "辅材费=材料费×辅材系数；管理费/利润/措施费以人工费为基数(机械费0)；"
            "增值税=税前合计×税率"
        ),
        "countertop_note": "台面材料单价为「元/延米@750标准边台」，中央台/仪器台按 width_factor 折算有效工程量，材料与人工同步折算",
        "item_count": len(items),
        "standards": [
            "GB 50500-2013 建设工程工程量清单计价规范",
            "湖南省住建厅建筑安装工程费用标准表（2025-09）",
            "JGJ 91-2019 科学实验建筑设计规范",
        ],
        "warnings": meta_warnings,
    }

    return {
        "items": result_items,
        "summary": summary,
        "price_tiers": price_tiers,
        "meta": meta,
    }
