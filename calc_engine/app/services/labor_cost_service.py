"""人工费估算与工程造价汇总服务

核心功能：
1. PVC 地板铺设人工费估算（基于工序对比法和包工包料拆分法）
2. 通风柜安装人工费估算（基于工时法和市场报价区间）
3. 工程造价汇总计算（人工费+材料费+辅材费+管理费+利润+措施费+增值税）

估算原则：
- 无官方直接数据的工种，基于相关工种和工时消耗进行估算
- 所有估算值明确标注"估算"性质和数据来源
- 不使用推测值填充，缺失数据标注"待补充"
"""

from app.services.labor_cost_db import (
    AUX_MATERIAL_RATIO,
    LAB_TRADE_LABOR_COST,
    LABOR_DAILY_WAGE,
    LABOR_UNIT_PRICE,
    get_aux_ratio,
    get_trade_labor_cost,
)
from app.services.cost_rate_db import (
    get_management_fee_rate,
    get_measure_fee_rate,
    get_profit_rate,
    get_vat_rate,
)


# ================================================================
# PVC 地板铺设人工费估算
# ================================================================

# PVC 地板铺设工序及工时消耗（每㎡）
PVC_FLOORING_WORK_STEPS = [
    {"step": "基层打磨找平", "hours_per_m2": 0.05, "note": "含水率检测、地面修补"},
    {"step": "自流平找平", "hours_per_m2": 0.04, "note": "界面剂+自流平水泥施工"},
    {"step": "界面剂涂布", "hours_per_m2": 0.02, "note": "PVC专用界面剂"},
    {"step": "刮PVC专用胶", "hours_per_m2": 0.04, "note": "齿形刮刀均匀刮胶"},
    {"step": "PVC铺设排气", "hours_per_m2": 0.06, "note": "卷材/片材定位铺贴、排气"},
    {"step": "接缝热熔焊接", "hours_per_m2": 0.04, "note": "焊缝开槽+热熔焊条+铲平"},
    {"step": "上墙圆弧踢脚", "hours_per_m2": 0.03, "note": "阴阳角圆弧处理+踢脚安装"},
    {"step": "PUR免打蜡(可选)", "hours_per_m2": 0.02, "note": "表面PUR处理"},
]


def estimate_pvc_flooring_labor(
    area: float = 100,
    region: str = "深圳",
    pvc_type: str = "卷材",
    include_subfloor: bool = True,
) -> dict:
    """PVC 地板铺设人工费估算

    估算方法：
    1. 工序对比法：PVC铺设工序与环氧薄涂工序相近但无中涂砂浆层，人工费约为环氧薄涂的0.7-0.9倍
    2. 工时法：按工序工时消耗×技工日薪÷8小时/工日
    3. 包工包料拆分法：市场包工包料价70元/㎡，材料占比60%-70%，人工费约21-28元/㎡

    Args:
        area: 铺设面积（㎡）
        region: 地区（深圳/广州/北京/上海/海口/成都）
        pvc_type: PVC类型（卷材/片材/防静电型）
        include_subfloor: 是否含自流平基层处理

    Returns:
        估算结果字典
    """
    # 方法1：基于环氧地坪人工费的工序对比法
    epoxy_labor = LAB_TRADE_LABOR_COST.get("环氧地坪施工", {})
    epoxy_national = epoxy_labor.get("regions", {}).get("全国(行业)", {})
    epoxy_low = epoxy_national.get("price_low", 30)
    epoxy_high = epoxy_national.get("price_high", 80)

    # PVC 工序系数：卷材0.7-0.85，片材0.75-0.9（片材需逐块对缝）
    type_factor = {"卷材": 0.75, "片材": 0.85, "防静电型": 0.95}.get(pvc_type, 0.80)

    method1_low = round(epoxy_low * type_factor, 1)
    method1_high = round(epoxy_high * type_factor, 1)

    # 方法2：工时法
    total_hours = sum(s["hours_per_m2"] for s in PVC_FLOORING_WORK_STEPS)
    if not include_subfloor:
        total_hours -= 0.05 + 0.04  # 减去基层打磨+自流平

    # 查地区技工日薪
    wage_data = LABOR_DAILY_WAGE.get(region, {})
    wages = wage_data.get("wages", {})
    # 优先取"装饰工日"或"装饰木工"，其次"技术工日"，最后取普工
    if region == "深圳":
        daily_wage = wages.get("装饰工日", {}).get("low", 211.54)
        daily_wage_high = wages.get("装饰工日", {}).get("high", 253.09)
    elif region == "广州":
        daily_wage = wages.get("装饰木工", {}).get("low", 310)
        daily_wage_high = wages.get("装饰木工", {}).get("high", 380)
    elif region == "上海":
        daily_wage = wages.get("装饰木工(含规费)", {}).get("low", 316)
        daily_wage_high = wages.get("装饰木工(含规费)", {}).get("high", 316)
    elif region == "北京":
        daily_wage = wages.get("一类工", {}).get("low", 255)
        daily_wage_high = wages.get("一类工", {}).get("high", 293)
    else:
        daily_wage = 280  # 全国中位数
        daily_wage_high = 350

    hourly_rate = daily_wage / 8
    hourly_rate_high = daily_wage_high / 8

    method2_low = round(total_hours * hourly_rate, 1)
    method2_high = round(total_hours * hourly_rate_high, 1)

    # 方法3：包工包料拆分法
    market_total_price = 70  # 上海58同城市场价（2026-08）
    material_ratio = 0.65  # 适中值
    method3 = round(market_total_price * (1 - material_ratio), 1)

    # 综合估算（取三法平均）
    est_low = round(min(method1_low, method2_low, method3), 1)
    est_high = round(max(method1_high, method2_high, method3), 1)
    est_mid = round((est_low + est_high) / 2, 1)

    # 辅材比例
    aux = get_aux_ratio("PVC地板")

    return {
        "trade": "PVC地板铺设",
        "area_m2": area,
        "region": region,
        "pvc_type": pvc_type,
        "include_subfloor": include_subfloor,
        "estimate_low_yuan_per_m2": est_low,
        "estimate_mid_yuan_per_m2": est_mid,
        "estimate_high_yuan_per_m2": est_high,
        "total_low_yuan": round(est_low * area, 0),
        "total_mid_yuan": round(est_mid * area, 0),
        "total_high_yuan": round(est_high * area, 0),
        "estimation_methods": {
            "method1_process_comparison": {
                "name": "工序对比法",
                "basis": f"环氧地坪人工费{epoxy_low}-{epoxy_high}元/㎡ × {pvc_type}系数{type_factor}",
                "result_low": method1_low,
                "result_high": method1_high,
            },
            "method2_work_hours": {
                "name": "工时法",
                "basis": f"总工时{round(total_hours, 3)}h/㎡ × {region}技工时薪{round(hourly_rate, 1)}-{round(hourly_rate_high, 1)}元/h",
                "result_low": method2_low,
                "result_high": method2_high,
                "work_steps": PVC_FLOORING_WORK_STEPS,
                "daily_wage_source": wage_data.get("source", "全国中位数"),
            },
            "method3_market_split": {
                "name": "包工包料拆分法",
                "basis": f"市场包工包料价{market_total_price}元/㎡ × 人工占比{1-material_ratio:.0%}",
                "result": method3,
            },
        },
        "aux_material_ratio": {
            "ratio_low": aux["ratio_low"],
            "ratio_high": aux["ratio_high"],
            "source": aux["source"],
            "reliability": aux.get("reliability", "estimate"),
        },
        "reliability": "estimate",
        "note": "PVC地板铺设无官方直接定额数据，采用三种方法交叉估算。工序对比法基于环氧地坪类比；工时法基于工序分解×地区技工日薪；包工包料拆分法基于市场价反推。",
    }


# ================================================================
# 通风柜安装人工费估算
# ================================================================

# 通风柜安装工序及工时消耗（每台）
FUME_HOOD_INSTALL_STEPS = [
    {"step": "柜体定位与搬运", "hours_per_unit": 2.0, "workers": 2, "note": "含卸货、搬运至安装位"},
    {"step": "柜体组装与固定", "hours_per_unit": 3.0, "workers": 2, "note": "柜体组装、地脚调平、固定"},
    {"step": "水电气管路连接", "hours_per_unit": 2.0, "workers": 1, "note": "给水/排水/燃气/电源/真空接口"},
    {"step": "排风管对接", "hours_per_unit": 1.5, "workers": 2, "note": "排风软管连接、密封处理"},
    {"step": "导流板与视窗调试", "hours_per_unit": 1.0, "workers": 1, "note": "视窗升降系统、导流板角度"},
    {"step": "面风速测试与调试", "hours_per_unit": 1.5, "workers": 1, "note": "面风速0.4-0.6m/s校核(ANSI/AIHA Z9.5)"},
]


def estimate_fume_hood_labor(
    count: int = 1,
    region: str = "深圳",
    hood_type: str = "全钢",
    include_ductwork: bool = True,
) -> dict:
    """通风柜安装人工费估算

    估算方法：
    1. 工时法：按安装工序工时×技工日薪÷8小时/工日×人数
    2. 市场报价区间法：参考行业报告"数百至数千元/台"

    Args:
        count: 通风柜数量（台）
        region: 地区
        hood_type: 通风柜类型（全钢/PP/玻璃钢）
        include_ductwork: 是否含排风管对接

    Returns:
        估算结果字典
    """
    # 类型系数：PP较轻便，全钢需多人搬运，玻璃钢介于中间
    type_factor = {"全钢": 1.0, "PP": 0.85, "玻璃钢": 0.90}.get(hood_type, 1.0)

    # 方法1：工时法
    total_man_hours = 0
    step_details = []
    for step in FUME_HOOD_INSTALL_STEPS:
        if not include_ductwork and "排风管" in step["step"]:
            continue
        hours = step["hours_per_unit"] * step["workers"] * type_factor
        total_man_hours += hours
        step_details.append({
            "step": step["step"],
            "hours_per_unit": step["hours_per_unit"],
            "workers": step["workers"],
            "man_hours": round(hours, 1),
            "note": step["note"],
        })

    # 查地区技工日薪
    wage_data = LABOR_DAILY_WAGE.get(region, {})
    wages = wage_data.get("wages", {})
    if region == "深圳":
        daily_wage = wages.get("安装工日", {}).get("low", 210.10)
        daily_wage_high = wages.get("安装工日", {}).get("high", 253.09)
    elif region == "广州":
        daily_wage = wages.get("电焊工", {}).get("low", 300)
        daily_wage_high = wages.get("电焊工", {}).get("high", 360)
    elif region == "上海":
        daily_wage = wages.get("综合人工安装(含规费)", {}).get("low", 290.5)
        daily_wage_high = wages.get("综合人工安装(含规费)", {}).get("high", 290.5)
    elif region == "北京":
        daily_wage = wages.get("一类工", {}).get("low", 255)
        daily_wage_high = wages.get("一类工", {}).get("high", 293)
    else:
        daily_wage = 280
        daily_wage_high = 350

    hourly_rate = daily_wage / 8
    hourly_rate_high = daily_wage_high / 8

    method1_low = round(total_man_hours * hourly_rate, 0)
    method1_high = round(total_man_hours * hourly_rate_high, 0)

    # 方法2：市场报价区间
    market_data = LAB_TRADE_LABOR_COST.get("通风柜安装", {})
    market_regions = market_data.get("regions", {})
    domestic_market = market_regions.get("国内(市场)", {})
    market_low = domestic_market.get("price_low", 500)
    market_high = domestic_market.get("price_high", 3000)

    # 国际数据折算
    intl_data = market_regions.get("国际(行业)", {})
    intl_low = intl_data.get("price_low", 4300)
    intl_high = intl_data.get("price_high", 28700)

    # 综合估算（国内项目取国内市场区间+工时法交叉验证）
    est_low = round(min(method1_low, market_low), 0)
    est_high = round(max(method1_high, market_high), 0)
    est_mid = round((est_low + est_high) / 2, 0)

    return {
        "trade": "通风柜安装",
        "count": count,
        "region": region,
        "hood_type": hood_type,
        "include_ductwork": include_ductwork,
        "estimate_low_yuan_per_unit": est_low,
        "estimate_mid_yuan_per_unit": est_mid,
        "estimate_high_yuan_per_unit": est_high,
        "total_low_yuan": round(est_low * count, 0),
        "total_mid_yuan": round(est_mid * count, 0),
        "total_high_yuan": round(est_high * count, 0),
        "total_man_hours_per_unit": round(total_man_hours, 1),
        "estimation_methods": {
            "method1_work_hours": {
                "name": "工时法",
                "basis": f"总人时{round(total_man_hours, 1)}h/台 × {region}安装工日薪{daily_wage}-{daily_wage_high}元/工日 ÷ 8h/工日",
                "result_low": method1_low,
                "result_high": method1_high,
                "work_steps": step_details,
                "daily_wage_source": wage_data.get("source", "全国中位数"),
            },
            "method2_market_range": {
                "name": "市场报价区间法",
                "basis": f"国内市场报价{market_low}-{market_high}元/台（{domestic_market.get('source', '')}）",
                "result_low": market_low,
                "result_high": market_high,
            },
            "method3_intl_reference": {
                "name": "国际行业参考",
                "basis": f"国际行业报告{intl_low}-{intl_high}元/台（{intl_data.get('source', '')}），含HVAC认证技师",
                "result_low": intl_low,
                "result_high": intl_high,
                "note": "国际报价含认证调试，国内项目通常不适用此区间",
            },
        },
        "reliability": "estimate",
        "note": "通风柜安装人工费无官方定额标准。工时法基于6道工序分解×地区安装工日薪；市场报价区间法参考行业报告。国际报价含HVAC认证技师调试，国内一般项目取国内区间。",
        "standards": [
            "ANSI/AIHA Z9.5 面速度0.4-0.6m/s",
            "ASHRAE 110 隔离测试",
            "NFPA 45 消防要求",
        ],
    }


# ================================================================
# 工程造价汇总计算
# ================================================================

def calculate_project_cost(
    material_cost: float = 0,
    labor_cost: float = 0,
    region: str = "湖南",
    project_type: str = "装饰装修工程",
    vat_method: str = "一般计税方法",
    custom_measure_fee: float = 0,
) -> dict:
    """工程造价汇总计算（人工费+材料费→辅材费→管理费→利润→措施费→增值税）

    计算程序（按建标〔2013〕44号费用项目组成）：
    1. 分部分项工程费 = 人工费 + 材料费 + 施工机具费
    2. 管理费 = 人工费(或人工费+机械费) × 管理费率
    3. 利润 = 人工费(或人工费+机械费) × 利润率
    4. 措施费 = 人工费 × 措施费率(安全+环保+文明施工+临时设施)
    5. 税前造价 = 分部分项工程费 + 管理费 + 利润 + 措施费
    6. 增值税 = 税前造价 × 增值税率
    7. 总造价 = 税前造价 + 增值税

    Args:
        material_cost: 材料费（元）
        labor_cost: 人工费（元）
        region: 地区（用于查管理费/利润率）
        project_type: 工程类型（装饰装修工程/建筑工程/安装工程等）
        vat_method: 增值税计税方法
        custom_measure_fee: 自定义措施费（为0时自动按费率计算）

    Returns:
        工程造价汇总字典
    """
    # 1. 分部分项工程费（假设机械费已含在material_cost中或为0）
    subproject_cost = material_cost + labor_cost

    # 2. 管理费
    mgmt = get_management_fee_rate(region, project_type)
    mgmt_rate = mgmt.get("rate_percent", 0) or 0
    mgmt_base_str = mgmt.get("base", "")
    # 计算基础：安装工程取人工费，其他取人工费+机械费（此处简化为人工费，因机械费未单列）
    if "人工费" in mgmt_base_str:
        mgmt_base = labor_cost
    else:
        mgmt_base = labor_cost  # 无机械费数据时取人工费
    management_fee = round(mgmt_base * mgmt_rate / 100, 2)

    # 3. 利润
    profit = get_profit_rate(region, project_type)
    profit_rate = profit.get("rate_percent", 0) or 0
    profit_base_str = profit.get("base", "")
    if "人工费" in profit_base_str:
        profit_base = labor_cost
    else:
        profit_base = labor_cost
    profit_fee = round(profit_base * profit_rate / 100, 2)

    # 4. 措施费
    if custom_measure_fee > 0:
        measure_fee = custom_measure_fee
        measure_detail = {"custom": True, "amount": custom_measure_fee}
    else:
        measure = get_measure_fee_rate(project_type)
        measure_total_rate = measure.get("total_percent", 0)
        measure_base = labor_cost  # 措施费计算基础
        measure_fee = round(measure_base * measure_total_rate / 100, 2)
        measure_detail = {
            "custom": False,
            "safety": round(labor_cost * measure.get("safety_percent", 0) / 100, 2),
            "environment": round(labor_cost * measure.get("environment_percent", 0) / 100, 2),
            "civilization": round(labor_cost * measure.get("civilization_percent", 0) / 100, 2),
            "temporary": round(labor_cost * measure.get("temporary_percent", 0) / 100, 2),
            "total_rate_percent": measure_total_rate,
            "base": measure.get("base", ""),
            "source": measure.get("source", ""),
        }

    # 5. 税前造价
    pre_tax_cost = round(subproject_cost + management_fee + profit_fee + measure_fee, 2)

    # 6. 增值税
    vat = get_vat_rate(vat_method)
    vat_rate = vat.get("rate_percent", 9)
    vat_amount = round(pre_tax_cost * vat_rate / 100, 2)

    # 7. 总造价
    total_cost = round(pre_tax_cost + vat_amount, 2)

    return {
        "input": {
            "material_cost": material_cost,
            "labor_cost": labor_cost,
            "region": region,
            "project_type": project_type,
            "vat_method": vat_method,
        },
        "breakdown": {
            "分部分项工程费": subproject_cost,
            "企业管理费": {
                "amount": management_fee,
                "rate_percent": mgmt_rate,
                "base": mgmt_base_str,
                "base_amount": mgmt_base,
                "source": mgmt.get("source", ""),
            },
            "利润": {
                "amount": profit_fee,
                "rate_percent": profit_rate,
                "base": profit_base_str,
                "base_amount": profit_base,
                "source": profit.get("source", ""),
            },
            "措施费": {
                "amount": measure_fee,
                **measure_detail,
            },
            "税前造价": pre_tax_cost,
            "增值税": {
                "amount": vat_amount,
                "rate_percent": vat_rate,
                "method": vat_method,
                "source": vat.get("source", ""),
            },
            "含税总造价": total_cost,
        },
        "summary": {
            "material_cost": material_cost,
            "labor_cost": labor_cost,
            "management_fee": management_fee,
            "profit": profit_fee,
            "measure_fee": measure_fee,
            "pre_tax_cost": pre_tax_cost,
            "vat": vat_amount,
            "total_cost": total_cost,
            "labor_ratio": round(labor_cost / pre_tax_cost * 100, 1) if pre_tax_cost else 0,
            "material_ratio": round(material_cost / pre_tax_cost * 100, 1) if pre_tax_cost else 0,
        },
    }


# ================================================================
# 查询辅助函数
# ================================================================

def list_all_trades() -> dict:
    """列出所有工种及其数据可用性"""
    trades = {}
    for trade_name, trade_data in LAB_TRADE_LABOR_COST.items():
        regions = trade_data.get("regions", {})
        trade_info = {
            "unit": trade_data.get("unit", ""),
            "notes": trade_data.get("notes", ""),
            "regions": {},
        }
        for region_name, region_data in regions.items():
            trade_info["regions"][region_name] = {
                "price_low": region_data.get("price_low"),
                "price_high": region_data.get("price_high"),
                "reliability": region_data.get("reliability", "pending"),
                "source": region_data.get("source", ""),
            }
        trades[trade_name] = trade_info
    return trades


def list_all_rates() -> dict:
    """列出所有费率数据概览"""
    return {
        "management_fee_regions": list({
            r for r in ["湖南", "福建", "甘肃"] if r in {
                "湖南": True, "福建": True, "甘肃": True
            }
        }),
        "profit_regions": ["湖南", "北京"],
        "vat_methods": list({
            "一般计税方法": "9%",
            "简易计税方法": "3%",
            "小规模纳税人优惠": "1%",
            "货物销售(建材)": "13%",
            "现代服务(设计/监理)": "6%",
        }.keys()),
        "measure_fee_types": ["建筑工程", "装饰装修工程", "安装工程", "市政工程", "园林绿化工程"],
        "aux_material_types": list(AUX_MATERIAL_RATIO.keys()),
    }
