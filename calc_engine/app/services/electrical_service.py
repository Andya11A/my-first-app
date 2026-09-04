"""电气动力计算模块 (Electrical Service)
====================================================

从设备清单到负荷计算、电缆选型、断路器选型、短路校核的自动化计算。
所有预设参数集中在文件顶部常量区，每个计算步骤注释标注具体规范条款。

依据规范：
- GB 50052-2009《供配电系统设计规范》—— 负荷分级、供电电源、电压选择
- GB 50054-2011《低压配电设计规范》—— 导体/电器选择、短路保护、接地故障保护
- GB 50055-2011《通用用电设备配电设计规范》—— 电动机/电梯/电热设备配电
- GB 51348-2019《民用建筑电气设计标准》—— 需要系数法、单位指标法
- GB 50217-2018《电力工程电缆设计标准》—— 电缆载流量、敷设校正
- GB 50016-2014(2018版)《建筑设计防火规范》—— 消防负荷、电线电缆燃烧性能
- GB 50057-2010《建筑物防雷设计规范》/ GB 50343-2012 防雷与 SPD
- GB 50189-2015《公共建筑节能设计标准》—— 变压器能效、无功补偿
- GB 50303-2015《建筑电气工程施工质量验收规范》—— 绝缘/接地电阻验收
"""
from __future__ import annotations

import math

from app.schemas.electrical import (
    BreakerResult,
    CableResult,
    ElectricalInput,
    ElectricalResult,
    EquipmentItem,
    InstallationMethod,
    LoadDetail,
    LoadGroupItem,
    LoadType,
    Phase,
    ShortCircuitResult,
)


# ==================================================================
#  预设参数常量区（集中定义，便于按规范版本统一升级校准）
# ==================================================================

# 需要系数 Kx 与功率因数 cosφ 预设（按负荷类型）
# 依据 GB 51348-2019《民用建筑电气设计标准》需要系数法
LOAD_FACTOR: dict[str, tuple[float, float]] = {
    "power": (0.80, 0.80),     # 动力：Kx=0.8, cosφ=0.8
    "lighting": (0.90, 0.90),  # 照明：Kx=0.9, cosφ=0.9
    "hvac": (0.85, 0.85),       # 空调：Kx=0.85, cosφ=0.85
}

# 系统电压预设 V
SYSTEM_VOLTAGE_3PHASE = 380.0
SYSTEM_VOLTAGE_1PHASE = 220.0
# 三相电网相电压（线电压/√3），用于短路计算
SHORT_CIRCUIT_LINE_VOLTAGE = 400.0

# YJV 电缆载流量表 (A) —— 简化节选，依据 GB 50217-2018 / 厂商手册
# 格式: {相线规格: {"bridge": 桥架载流量, "conduit": 穿管载流量}}
CABLE_CAPACITY: dict[str, dict[str, float]] = {
    "4*2.5":  {"bridge": 26,  "conduit": 19},
    "4*4":    {"bridge": 35,  "conduit": 25},
    "4*6":    {"bridge": 44,  "conduit": 32},
    "4*10":   {"bridge": 61,  "conduit": 44},
    "4*16":   {"bridge": 80,  "conduit": 58},
    "4*25":   {"bridge": 105, "conduit": 76},
    "4*35":   {"bridge": 130, "conduit": 94},
    "4*50":   {"bridge": 160, "conduit": 115},
    "4*70":   {"bridge": 195, "conduit": 141},
    "4*95":   {"bridge": 240, "conduit": 173},
    "4*120":  {"bridge": 280, "conduit": 202},
    "4*150":  {"bridge": 320, "conduit": 231},
    "4*185":  {"bridge": 360, "conduit": 260},
    "4*240":  {"bridge": 420, "conduit": 303},
}

# 环境温度校正系数（参考点 30℃），依据 GB 50217-2018
TEMP_CORRECTION: list[tuple[float, float]] = [
    (25.0, 1.00),
    (30.0, 1.00),
    (35.0, 0.94),
    (40.0, 0.87),
    (45.0, 0.79),
]

# 断路器额定电流系列 (A)
BREAKER_IN_SERIES: list[float] = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400, 630]

# 断路器分断能力默认估算 kA（依据 GB 50054 分断能力要求）
BREAKER_CAPACITY_KA = 35.0

# 短路计算用铜导体电阻率 (Ω·mm²/m，70℃ 工作温度近似)
COPPER_RESISTIVITY = 0.0225
# 单位长度电抗近似值 (mΩ/m)
LINE_REACTANCE_PER_M = 0.08


def _temp_correction(temp_c: float) -> float:
    """按环境温度查/插值校正系数，依据 GB 50217-2018。"""
    keys = [t for t, _ in TEMP_CORRECTION]
    if temp_c <= keys[0]:
        return TEMP_CORRECTION[0][1]
    if temp_c >= keys[-1]:
        return TEMP_CORRECTION[-1][1]
    for i in range(len(TEMP_CORRECTION) - 1):
        t0, c0 = TEMP_CORRECTION[i]
        t1, c1 = TEMP_CORRECTION[i + 1]
        if t0 <= temp_c <= t1:
            # 线性插值
            return c0 + (c1 - c0) * (temp_c - t0) / (t1 - t0)
    return 1.0


def _cross_section_from_conductor(conductor: str) -> float:
    """从相线规格 '4*16' 提取截面 16（mm²）。"""
    return float(conductor.split("*")[-1])


def _pe_cross_section(s: float) -> float:
    """PE 线截面匹配，依据 GB 50054-2011 第 3.2.14 条。

    S≤16 → PE=S；16<S≤35 → PE=16；S>35 → PE=S/2。
    """
    if s <= 16:
        return s
    if s <= 35:
        return 16.0
    return round(s / 2.0)


# ==================================================================
#  核心功能 1：负荷计算
# ==================================================================


def calculate_load(equipment: list[EquipmentItem]) -> LoadDetail:
    """需要系数法负荷计算，依据 GB 51348-2019。

    按负荷类型分组，各组用对应 Kx/cosφ 计算 Pjs/Qjs，再求和得总有功/无功，
    视在功率 Sjs=√(Pjs²+Qjs²)。综合 Kx=Pjs/P_total、综合 cosφ=Pjs/Sjs，
    使用户给出的简化公式 Pjs=P_total*Kx、Sjs=Pjs/cosφ 仍恒成立。
    """
    # 总安装功率 P_total = Σ P_i
    p_total = sum(e.power_kw for e in equipment)

    # 按负荷类型分组计算
    groups_dict: dict[str, dict] = {}
    for e in equipment:
        key = e.load_type.value
        kx, cos_phi = LOAD_FACTOR[key]
        tan_phi = math.tan(math.acos(cos_phi))
        g = groups_dict.setdefault(
            key,
            {"load_type": e.load_type, "p_install": 0.0, "kx": kx, "cos_phi": cos_phi, "tan_phi": tan_phi},
        )
        g["p_install"] += e.power_kw

    groups: list[LoadGroupItem] = []
    pjs_total = 0.0
    qjs_total = 0.0
    for g in groups_dict.values():
        pjs_g = g["p_install"] * g["kx"]        # 该组有功计算负荷 Pjs=P_install*Kx
        qjs_g = pjs_g * g["tan_phi"]            # 该组无功计算负荷 Qjs=Pjs*tanφ
        pjs_total += pjs_g
        qjs_total += qjs_g
        groups.append(
            LoadGroupItem(
                load_type=g["load_type"],
                p_install_kw=round(g["p_install"], 3),
                kx=g["kx"],
                cos_phi=g["cos_phi"],
                pjs_kw=round(pjs_g, 3),
                qjs_kvar=round(qjs_g, 3),
            )
        )

    # 视在功率 Sjs = √(Pjs² + Qjs²)
    sjs_total = math.sqrt(pjs_total ** 2 + qjs_total ** 2)

    # 综合系数（使简化公式恒成立）
    effective_kx = pjs_total / p_total if p_total > 0 else 0.0
    effective_cos_phi = pjs_total / sjs_total if sjs_total > 0 else 0.0
    effective_tan_phi = qjs_total / pjs_total if pjs_total > 0 else 0.0

    # 计算电流 Ijs：按系统相制选择公式
    # 三相：Ijs = Sjs*1000/(1.732*U)；单相：Ijs = Sjs*1000/U
    has_3phase = any(e.phase == Phase.THREE_PHASE for e in equipment)
    phase = Phase.THREE_PHASE if has_3phase else Phase.SINGLE_PHASE
    system_voltage = SYSTEM_VOLTAGE_3PHASE if phase == Phase.THREE_PHASE else SYSTEM_VOLTAGE_1PHASE
    if phase == Phase.THREE_PHASE:
        ijs = sjs_total * 1000.0 / (math.sqrt(3) * system_voltage)
    else:
        ijs = sjs_total * 1000.0 / system_voltage

    return LoadDetail(
        p_total_kw=round(p_total, 3),
        equipment_count=len(equipment),
        effective_kx=round(effective_kx, 3),
        effective_cos_phi=round(effective_cos_phi, 3),
        effective_tan_phi=round(effective_tan_phi, 3),
        pjs_kw=round(pjs_total, 3),
        qjs_kvar=round(qjs_total, 3),
        sjs_kva=round(sjs_total, 3),
        ijs_a=round(ijs, 2),
        system_voltage_v=system_voltage,
        phase=phase,
        groups=groups,
    )


# ==================================================================
#  核心功能 2：电缆选型
# ==================================================================


def select_cable(
    ijs: float,
    installation_method: InstallationMethod,
    temperature: float,
) -> CableResult:
    """YJV 电缆选型，依据 GB 50054-2011 第 3.2.2 条（载流量≥计算电流）。"""
    method = installation_method.value
    correction = _temp_correction(temperature)

    # 选择满足 校正后载流量 >= Ijs 的最小截面电缆
    selected_conductor: str | None = None
    selected_capacity = 0.0
    for conductor, cap in CABLE_CAPACITY.items():
        rated = cap[method]
        corrected = rated * correction
        if corrected >= ijs:
            selected_conductor = conductor
            selected_capacity = rated
            break

    # 无满足项 → 取最大截面并标记不满足
    if selected_conductor is None:
        last_key = list(CABLE_CAPACITY.keys())[-1]
        selected_conductor = last_key
        selected_capacity = CABLE_CAPACITY[last_key][method]

    cross_section = _cross_section_from_conductor(selected_conductor)
    # PE 线选型，依据 GB 50054-2011 第 3.2.14 条
    pe_section = _pe_cross_section(cross_section)
    corrected_capacity = selected_capacity * correction
    meets = corrected_capacity >= ijs

    # 整数 PE 截面显示
    pe_disp = int(pe_section) if pe_section == int(pe_section) else pe_section
    model = f"YJV-{selected_conductor}+1*{pe_disp}"

    return CableResult(
        model=model,
        conductor=selected_conductor,
        cross_section_mm=cross_section,
        pe_cross_section_mm=pe_section,
        rated_capacity_a=selected_capacity,
        correction_factor=round(correction, 3),
        corrected_capacity_a=round(corrected_capacity, 2),
        meets_demand=meets,
        regulation_reference="GB 50054-2011 第 3.2.2 条（导体载流量校验）及第 3.2.14 条（PE 线截面）",
    )


# ==================================================================
#  核心功能 3：断路器选型
# ==================================================================


def select_breaker(ijs: float, iz: float, load_type: LoadType) -> BreakerResult:
    """断路器选型，依据 GB 50054-2011 第 6.3.3 条（In≥计算电流且≤导体载流量）。

    主选满足 Ijs <= In <= Iz 的最小额定电流（导体保护协调）；无同时满足者时
    回退至 In >= 1.1*Ijs 的最小档并标注协调冲突。
    """
    # 额定电流下限：In >= 1.1*Ijs（依据 GB 50054-2011 第 6.3.3 条）
    in_min = 1.1 * ijs

    # 主选：满足 Ijs <= In <= Iz 的最小额定电流（导体保护协调）
    rated = None
    for cand in BREAKER_IN_SERIES:
        if cand >= ijs and cand <= iz:
            rated = cand
            break
    coordination_ok = True
    note = "In 满足 Ijs <= In <= Iz，导体保护协调正常"

    if rated is None:
        # 无同时满足者：取满足 In >= 1.1*Ijs 的最小档（保护负荷），并提示电缆可能需放大
        for cand in BREAKER_IN_SERIES:
            if cand >= in_min:
                rated = cand
                break
        if rated is None:
            rated = BREAKER_IN_SERIES[-1]
        coordination_ok = rated <= iz
        if not coordination_ok:
            note = (
                f"In={int(rated)}A 超过电缆校正载流量 {iz}A，"
                f"依据 GB 50054-2011 第 6.3.3 条建议放大电缆截面以满足导体保护协调"
            )
        else:
            note = "In 满足 Ijs <= In <= Iz，导体保护协调正常"
    elif rated < in_min:
        note = (
            f"In={int(rated)}A 略低于 1.1*Ijs={in_min:.1f}A（标准档位限制），"
            f"已满足 In<=Iz 的导体保护要求"
        )

    # 壳架等级（按 In 阈值映射）
    if rated <= 63:
        frame = 63
    elif rated <= 125:
        frame = 125
    elif rated <= 250:
        frame = 250
    elif rated <= 400:
        frame = 400
    else:
        frame = 630

    # 脱扣曲线：动力负荷选 D 曲线（避开电机启动浪涌），照明/普通负荷选 C 曲线
    trip_curve = "D" if load_type == LoadType.POWER else "C"

    # 极数：动力/空调为三相负荷 → 3P，照明按单相 → 1P+N
    poles = "3P" if load_type in (LoadType.POWER, LoadType.HVAC) else "1P+N"

    model = f"CM1-{frame}/{poles} {trip_curve}{int(rated)}"

    return BreakerResult(
        model=model,
        rated_current_a=rated,
        frame_a=frame,
        trip_curve=trip_curve,
        poles=poles,
        breaking_capacity_ka=BREAKER_CAPACITY_KA,
        coordination_ok=coordination_ok,
        note=note,
        regulation_reference="GB 50054-2011 第 6.3.3 条（过电流保护电器额定电流）",
    )


# ==================================================================
#  核心功能 4：短路电流估算
# ==================================================================


def estimate_short_circuit(
    transformer_kva: float,
    uk_percent: float,
    distance_m: float,
    cable_cross_section_mm: float = 95.0,
    breaker_capacity_ka: float = BREAKER_CAPACITY_KA,
) -> ShortCircuitResult:
    """末端三相短路电流估算，校核断路器分断能力，依据 GB 50054-2011 第 3.1.2 条。

    简化方法：
      1) 变压器额定电流 In_t = S/(√3·U)
      2) 变压器出口短路电流 I_k3 = In_t / uk
      3) 变压器等效阻抗 Z_t = U/(√3·I_k3)
      4) 线路阻抗 Z_line ≈ L·√(R'²+X'²)，R'=ρ/S (mΩ/m)，X'≈0.08 mΩ/m
      5) 末端短路电流 I_end = U/(√3·(Z_t+Z_line))
    """
    u = SHORT_CIRCUIT_LINE_VOLTAGE
    uk = uk_percent / 100.0

    # 变压器额定电流 In_t = S*1000/(√3*U)
    in_transformer = transformer_kva * 1000.0 / (math.sqrt(3) * u)
    # 变压器出口三相短路电流 I_k3 = In_t / uk_percent
    i_k3_transformer = in_transformer / uk

    # 变压器等效阻抗 Z_t = U/(√3*I_k3) [Ω]
    z_t = u / (math.sqrt(3) * i_k3_transformer)

    # 线路阻抗：R'=ρ/S (Ω/m)→mΩ/m，X'≈0.08 mΩ/m
    r_per_m_mohm = COPPER_RESISTIVITY / cable_cross_section_mm * 1000.0  # mΩ/m
    x_per_m_mohm = LINE_REACTANCE_PER_M
    z_line_per_m_mohm = math.sqrt(r_per_m_mohm ** 2 + x_per_m_mohm ** 2)
    z_line_mohm = z_line_per_m_mohm * distance_m
    z_line = z_line_mohm / 1000.0  # 转 Ω

    # 末端预期短路电流 I_end = U/(√3*(Z_t+Z_line)) [A]
    i_end = u / (math.sqrt(3) * (z_t + z_line))

    # 校核：断路器分断能力是否大于末端预期短路电流
    # 依据 GB 50054-2011 第 3.1.2 条
    sufficient = breaker_capacity_ka > (i_end / 1000.0)

    return ShortCircuitResult(
        transformer_rated_current_a=round(in_transformer, 1),
        transformer_short_circuit_ka=round(i_k3_transformer / 1000.0, 2),
        line_impedance_mohm=round(z_line_mohm, 2),
        end_short_circuit_ka=round(i_end / 1000.0, 2),
        breaker_capacity_ka=breaker_capacity_ka,
        capacity_sufficient=sufficient,
        regulation_reference="GB 50054-2011 第 3.1.2 条（短路分断能力校核）",
    )


# ==================================================================
#  编排函数：组合四大功能 + 规范引用 + 公式说明
# ==================================================================


ELECTRICAL_REGULATION_REFERENCES = [
    "GB 50052-2009《供配电系统设计规范》",
    "GB 50054-2011《低压配电设计规范》",
    "GB 50055-2011《通用用电设备配电设计规范》",
    "GB 51348-2019《民用建筑电气设计标准》",
    "GB 50217-2018《电力工程电缆设计标准》",
    "GB 50016-2014（2018版）《建筑设计防火规范》",
    "GB 50057-2010《建筑物防雷设计规范》",
    "GB 50343-2012《建筑物电子信息系统防雷技术规范》",
    "GB 50189-2015《公共建筑节能设计标准》",
    "GB 50303-2015《建筑电气工程施工质量验收规范》",
]

ELECTRICAL_FORMULA_EXPLANATIONS = [
    "P_total = Σ P_i（总安装功率）",
    "Pjs = P_total * Kx（需要系数法，GB 51348-2019）",
    "Qjs = Pjs * tan(arccos(cosφ))（无功计算负荷）",
    "Sjs = √(Pjs² + Qjs²)（视在功率）",
    "Ijs_三相 = Sjs*1000/(1.732*U)（三相计算电流）",
    "Ijs_单相 = Sjs*1000/U（单相计算电流）",
    "电缆选型：I_z(校正后) ≥ Ijs（GB 50054-2011 第 3.2.2 条）",
    "温度校正系数按 GB 50217-2018 查/插值",
    "PE 线：S≤16→PE=S；16<S≤35→PE=16；S>35→PE=S/2（GB 50054-2011 第 3.2.14 条）",
    "断路器：In ≥ 1.1*Ijs 且 In ≤ I_z（GB 50054-2011 第 6.3.3 条）",
    "I_k3 = In_t / uk（变压器出口短路电流）",
    "I_end = U/(√3*(Z_t+Z_line))（末端短路电流）",
    "分断能力校核：Icu > I_end（GB 50054-2011 第 3.1.2 条）",
]


def _dominant_load_type(equipment: list[EquipmentItem]) -> LoadType:
    """取安装功率占比最大的负荷类型作为断路器脱扣曲线判据。"""
    totals: dict[str, float] = {}
    for e in equipment:
        totals[e.load_type.value] = totals.get(e.load_type.value, 0.0) + e.power_kw
    dominant_key = max(totals, key=totals.get)
    for lt in LoadType:
        if lt.value == dominant_key:
            return lt
    return LoadType.POWER


def calculate_electrical(inp: ElectricalInput) -> ElectricalResult:
    """电气计算主入口：负荷 → 电缆 → 断路器 → 短路校核。"""
    # 1) 负荷计算
    load = calculate_load(inp.equipment)

    # 2) 电缆选型
    cable = select_cable(load.ijs_a, inp.installation_method, inp.temperature)

    # 3) 断路器选型（按主导负荷类型决定脱扣曲线）
    dominant_lt = _dominant_load_type(inp.equipment)
    breaker = select_breaker(load.ijs_a, cable.corrected_capacity_a, dominant_lt)

    # 4) 短路校核（传入所选电缆截面提升末端阻抗估算精度）
    short_circuit = estimate_short_circuit(
        transformer_kva=inp.transformer_kva,
        uk_percent=inp.uk_percent,
        distance_m=inp.distance_m,
        cable_cross_section_mm=cable.cross_section_mm,
        breaker_capacity_ka=inp.breaker_capacity_ka,
    )

    return ElectricalResult(
        load=load,
        cable=cable,
        breaker=breaker,
        short_circuit=short_circuit,
        regulation_references=ELECTRICAL_REGULATION_REFERENCES,
        formula_explanations=ELECTRICAL_FORMULA_EXPLANATIONS,
    )
