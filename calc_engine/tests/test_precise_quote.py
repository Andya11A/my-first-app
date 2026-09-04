"""精确报价引擎（precise_quote）单元测试
================================================================
覆盖范围：
- 默认6项清单场景三档总价回归锚点（广州/一般计税）
- 材料档位取价：不锈钢台面 201/304/316L、防火门甲/乙/丙级
- 无效档位告警并回退默认档
- 计税方式（一般9% / 简易3%）、城市人工费系数（上海1.15）
- 台面宽度系数（中央台×2.0）折算有效工程量
- 部位→工种自动映射、辅材系数分类
- 费用汇总结构完整性（11个费用项 × 低中高三档）及费率勾稽
- 未知材料告警、空清单 ValueError

计价依据：GB 50500-2013；湖南省住建厅费用标准（2025-09）
装饰工程：管理费15.15%、利润13.91%、措施费6.66%，基数均为人工费（机械费0）
"""
import pytest

from app.services.precise_quote_service import calculate_precise_quote


# ==================== 夹具 ====================

def default_items():
    """与前端默认6行示例一致的标准清单"""
    return [
        {"part_type": "ground", "material_name": "PVC卷材", "quantity": 100},
        {"part_type": "partition", "material_name": "彩钢板隔墙", "quantity": 250},
        {"part_type": "wall", "material_name": "抗菌涂料", "quantity": 220},
        {"part_type": "ceiling", "material_name": "彩钢板吊顶", "quantity": 100},
        {"part_type": "door", "material_name": "气密门", "quantity": 4},
        {"part_type": "countertop", "material_name": "不锈钢台面", "quantity": 24, "width_factor": 1.0},
    ]


SUMMARY_KEYS = [
    "material_fee", "labor_fee", "auxiliary_fee", "machinery_fee", "direct_fee",
    "management_fee", "profit", "measure_fee", "pre_tax_total", "vat", "total_with_tax",
]


# ==================== 1. 默认场景回归锚点 ====================

def test_default_scenario_tiers_anchor():
    """广州/一般计税/默认档位：三档含税总价回归锚点"""
    r = calculate_precise_quote(default_items(), city="广州", tax_type="general")
    t = r["price_tiers"]
    assert t["low"] == pytest.approx(81937.68, abs=1.0)
    assert t["mid"] == pytest.approx(131356.51, abs=1.0)
    assert t["high"] == pytest.approx(180775.37, abs=1.0)
    # price_tiers 与 summary.total_with_tax 一致
    for k in ("low", "mid", "high"):
        assert t[k] == pytest.approx(r["summary"]["total_with_tax"][k], abs=0.01)


def test_summary_structure_complete():
    """汇总表包含全部11个费用项，每项均有低/中/高三档且 低≤中≤高"""
    r = calculate_precise_quote(default_items(), city="广州")
    s = r["summary"]
    assert set(s.keys()) == set(SUMMARY_KEYS)
    for key in SUMMARY_KEYS:
        for tier in ("low", "mid", "high"):
            assert tier in s[key], f"{key} 缺 {tier} 档"
    # 非零费用项满足 低 ≤ 中 ≤ 高
    for key in SUMMARY_KEYS:
        if key == "machinery_fee":
            continue
        assert s[key]["low"] <= s[key]["mid"] <= s[key]["high"] + 0.01, key


def test_fee_rate_linkage():
    """费率勾稽：管理费=人工费×15.15%，利润=×13.91%，措施费=×6.66%，增值税=税前×9%"""
    r = calculate_precise_quote(default_items(), city="广州", tax_type="general")
    s = r["summary"]
    for tier in ("low", "mid", "high"):
        labor = s["labor_fee"][tier]
        assert s["management_fee"][tier] == pytest.approx(labor * 0.1515, abs=0.02)
        assert s["profit"][tier] == pytest.approx(labor * 0.1391, abs=0.02)
        assert s["measure_fee"][tier] == pytest.approx(labor * 0.0666, abs=0.02)
        assert s["vat"][tier] == pytest.approx(s["pre_tax_total"][tier] * 0.09, abs=0.02)
        # 直接费 = 材料 + 人工 + 辅材（机械0）
        assert s["direct_fee"][tier] == pytest.approx(
            s["material_fee"][tier] + s["labor_fee"][tier] + s["auxiliary_fee"][tier], abs=0.02)
        # 含税 = 税前 + 增值税
        assert s["total_with_tax"][tier] == pytest.approx(
            s["pre_tax_total"][tier] + s["vat"][tier], abs=0.02)
    assert s["machinery_fee"] == {"low": 0.0, "mid": 0.0, "high": 0.0}


# ==================== 2. 材料档位取价 ====================

@pytest.mark.parametrize("grade,low,mid,high", [
    ("201", 600, 900, 1200),
    ("304", 1000, 1750, 2500),
    ("316L", 2000, 3000, 4000),
])
def test_countertop_steel_grades(grade, low, mid, high):
    """不锈钢台面 201/304/316L 三档材料单价（元/延米@750边台）"""
    items = [{"part_type": "countertop", "material_name": "不锈钢台面",
              "quantity": 24, "material_grade": grade}]
    r = calculate_precise_quote(items, city="广州")
    it = r["items"][0]
    assert it["material_grade"] == grade
    assert it["material_unit_price"]["low"] == pytest.approx(low, abs=1)
    assert it["material_unit_price"]["mid"] == pytest.approx(mid, abs=1)
    assert it["material_unit_price"]["high"] == pytest.approx(high, abs=1)
    # 材料费 = 单价 × 24延米
    assert it["material_cost"]["mid"] == pytest.approx(mid * 24, abs=1)


def test_grade_304_more_expensive_than_default():
    """选304档的含税总价比默认（201经济档）高"""
    base = calculate_precise_quote(default_items(), city="广州")
    items_304 = [dict(it, material_grade="304") if it["part_type"] == "countertop" else it
                 for it in default_items()]
    up = calculate_precise_quote(items_304, city="广州")
    assert up["price_tiers"]["mid"] > base["price_tiers"]["mid"]
    # 中档差额 ≈ (1750-900)×24 = 20400，再乘 1.08(辅材) 与 1.09(税)
    diff = up["price_tiers"]["mid"] - base["price_tiers"]["mid"]
    assert diff == pytest.approx(20400 * 1.12 * 1.09, rel=0.05)


@pytest.mark.parametrize("grade,low,high", [
    ("甲级", 600, 1500),
    ("乙级", 400, 800),
    ("丙级", 300, 500),
])
def test_fire_door_grades(grade, low, high):
    """防火门 甲/乙/丙级档位取价（元/樘）"""
    items = [{"part_type": "door", "material_name": "防火门", "quantity": 4, "material_grade": grade}]
    r = calculate_precise_quote(items, city="广州")
    it = r["items"][0]
    assert it["material_resolved"] == "防火门"
    assert it["material_unit_price"]["low"] == pytest.approx(low, abs=1)
    assert it["material_unit_price"]["high"] == pytest.approx(high, abs=1)


def test_invalid_grade_warns_and_falls_back():
    """不存在的档位：产生告警并回退默认（经济）档取价"""
    items = [{"part_type": "countertop", "material_name": "不锈钢台面",
              "quantity": 10, "material_grade": "999K"}]
    r = calculate_precise_quote(items, city="广州")
    it = r["items"][0]
    assert any("未找到档位" in w or "默认" in w for w in it["warnings"])
    # 回退到默认档（201）：low=600
    assert it["material_unit_price"]["low"] == pytest.approx(600, abs=1)
    assert r["meta"]["warnings"]  # 告警同步上提到 meta


# ==================== 3. 计税方式 / 城市系数 ====================

def test_simplified_tax_rate():
    """简易计税增值税率3%，含税总价低于一般计税（9%），税前合计相同"""
    g = calculate_precise_quote(default_items(), city="广州", tax_type="general")
    s = calculate_precise_quote(default_items(), city="广州", tax_type="simplified")
    assert g["meta"]["rates"]["vat"]["rate"] == 0.09
    assert s["meta"]["rates"]["vat"]["rate"] == 0.03
    for tier in ("low", "mid", "high"):
        assert s["summary"]["pre_tax_total"][tier] == pytest.approx(g["summary"]["pre_tax_total"][tier], abs=0.02)
        assert s["summary"]["vat"][tier] == pytest.approx(s["summary"]["pre_tax_total"][tier] * 0.03, abs=0.02)
        assert s["summary"]["total_with_tax"][tier] < g["summary"]["total_with_tax"][tier]


def test_city_factor_labor():
    """上海城市系数1.15：人工费为广州的1.15倍，管理费/利润/措施费同步变化"""
    gz = calculate_precise_quote(default_items(), city="广州")
    sh = calculate_precise_quote(default_items(), city="上海")
    assert sh["meta"]["city_factor"] == 1.15 and gz["meta"]["city_factor"] == 1.0
    for tier in ("low", "mid", "high"):
        # 逐项×系数后逐项取整再汇总，存在分项四舍五入累积尾差，用相对容差
        assert sh["summary"]["labor_fee"][tier] == pytest.approx(gz["summary"]["labor_fee"][tier] * 1.15, rel=0.003)
        assert sh["summary"]["management_fee"][tier] == pytest.approx(
            gz["summary"]["management_fee"][tier] * 1.15, rel=0.003)


# ==================== 4. 宽度系数 / 工种映射 / 辅材分类 ====================

def test_countertop_width_factor():
    """中央台 width_factor=2.0：有效工程量=48延米，材料费为边台的2倍"""
    edge = calculate_precise_quote(
        [{"part_type": "countertop", "material_name": "不锈钢台面", "quantity": 24,
          "material_grade": "304", "width_factor": 1.0}], city="广州")
    center = calculate_precise_quote(
        [{"part_type": "countertop", "material_name": "不锈钢台面", "quantity": 24,
          "material_grade": "304", "width_factor": 2.0}], city="广州")
    assert center["items"][0]["effective_qty"] == pytest.approx(48.0)
    assert edge["items"][0]["effective_qty"] == pytest.approx(24.0)
    for tier in ("low", "mid", "high"):
        assert center["items"][0]["material_cost"][tier] == pytest.approx(
            edge["items"][0]["material_cost"][tier] * 2.0, abs=1)
        # 人工费同步按有效工程量折算
        assert center["items"][0]["labor_cost"][tier] == pytest.approx(
            edge["items"][0]["labor_cost"][tier] * 2.0, abs=1)


@pytest.mark.parametrize("idx,expected_trade,aux_cat", [
    (0, "PVC地板铺设", "flooring"),    # 地面 PVC
    (1, "彩钢板安装", "steel_panel"),  # 墙体 彩钢板隔墙
    (2, "涂料涂刷", "default"),        # 墙面 抗菌涂料
    (3, "彩钢板安装", "steel_panel"),  # 吊顶 彩钢板吊顶
    (4, "气密门安装", "default"),      # 门窗 气密门
    (5, "实验台安装", "default"),      # 台面 不锈钢台面
])
def test_trade_and_aux_mapping(idx, expected_trade, aux_cat):
    """部位+材料 → 人工工种、辅材系数类别自动映射"""
    r = calculate_precise_quote(default_items(), city="广州")
    it = r["items"][idx]
    assert it["labor_trade"] == expected_trade
    assert it["aux_category"] == aux_cat


def test_tile_aux_ratio():
    """瓷砖类辅材系数0.10（tile），地面PVC为0.08（flooring）"""
    r = calculate_precise_quote(
        [{"part_type": "wall", "material_name": "实验室瓷砖", "quantity": 100}], city="广州")
    assert r["items"][0]["aux_ratio"] == pytest.approx(0.10)
    r2 = calculate_precise_quote(
        [{"part_type": "ground", "material_name": "PVC卷材", "quantity": 100}], city="广州")
    assert r2["items"][0]["aux_ratio"] == pytest.approx(0.08)


# ==================== 5. 异常与边界 ====================

def test_empty_items_raises():
    """空清单抛 ValueError"""
    with pytest.raises(ValueError):
        calculate_precise_quote([], city="广州")


def test_unknown_material_warns_zero_cost():
    """未知材料：未匹配、告警、材料费按0计（人工费仍可按工种计）"""
    r = calculate_precise_quote(
        [{"part_type": "custom", "material_name": "某特殊定制设备XYZ", "quantity": 10}], city="广州")
    it = r["items"][0]
    assert it["material_matched"] is False
    assert it["material_cost"] == {"low": 0.0, "mid": 0.0, "high": 0.0}
    assert any("未在材料库" in w for w in it["warnings"])


def test_meta_contains_basis_and_standards():
    """meta 输出计价依据、地区、税率与规范清单"""
    r = calculate_precise_quote(default_items(), city="深圳", tax_type="general")
    assert r["meta"]["city"] == "深圳"
    assert r["meta"]["city_factor"] == 0.95
    assert r["meta"]["item_count"] == 6
    assert any("GB 50500-2013" in s for s in r["meta"]["standards"])
    assert r["meta"]["rates"]["management_fee"]["rate"] == 0.1515
    assert r["meta"]["rates"]["measure_fee"]["combined"] == pytest.approx(0.0666, abs=0.0001)
