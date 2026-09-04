"""工艺规划计算模块 (Process Service)
====================================================

从实验室类型到功能分区、面积估算、环境参数、设备负荷、动线规划的自动化计算。
所有预设参数集中在文件顶部常量区，每个计算步骤注释标注具体规范条款。

依据规范：
- JGJ 91-2019《科研建筑设计标准》—— 面积指标、布局原则、室内设计参数
- GB 50346-2011《生物安全实验室建筑技术规范》—— BSL 分级、功能分区、压差梯度
- GB 50881-2013《疾病预防控制中心建筑技术规范》—— 换气次数、温湿度参数
- GB 50189-2015《公共建筑节能设计标准》—— 室内设计参数、能耗基准
"""
from __future__ import annotations

from app.schemas.process import (
    AreaEstimate,
    CirculationPlan,
    EquipmentLoadItem,
    EquipmentLoadResult,
    EnvRequirement,
    LabType,
    ProcessEquipment,
    ProcessInput,
    ProcessResult,
    RoomFunction,
    ZoneItem,
    ZoneResult,
)


# ==================================================================
#  预设参数常量区（集中定义，便于按规范版本统一升级校准）
# ==================================================================

# 功能分区比例 —— 引用 JGJ 91-2019 / GB 50346-2011
ZONE_RATIOS: dict[str, dict[str, float]] = {
    # 普通化学实验室
    "chemical": {"实验操作区": 0.50, "仪器分析区": 0.20, "样品处理区": 0.10, "储存区": 0.10, "办公区": 0.10},
    # 普通生物实验室（参考 JGJ 91 通用指标）
    "biological": {"实验操作区": 0.45, "培养区": 0.20, "样品处理区": 0.10, "储存区": 0.15, "办公区": 0.10},
    # 物理/精密仪器实验室
    "physical": {"实验操作区": 0.50, "仪器分析区": 0.25, "样品处理区": 0.05, "储存区": 0.10, "办公区": 0.10},
    # 洁净室
    "cleanroom": {"洁净操作区": 0.50, "人员净化区": 0.15, "物料净化区": 0.15, "设备区": 0.10, "辅助区": 0.10},
    # 生物安全实验室 BSL-2/3
    "bsl2": {"核心工作区": 0.40, "缓冲区": 0.20, "清洁区": 0.20, "污物处理区": 0.10, "设备区": 0.10},
    "bsl3": {"核心工作区": 0.40, "缓冲区": 0.20, "清洁区": 0.20, "污物处理区": 0.10, "设备区": 0.10},
    # 动物房
    "animal": {"饲养区": 0.40, "操作区": 0.20, "洗消区": 0.15, "储物区": 0.15, "办公区": 0.10},
}

# 建议布局模式 —— 引用 JGJ 91-2019 / GB 50346-2011
LAYOUT_MODE: dict[str, str] = {
    "chemical": "走廊式（双侧实验台）",
    "biological": "走廊式（含培养间）",
    "physical": "岛式（防振仪器居中）",
    "cleanroom": "走廊式 + 气闸（人/物净化分离）",
    "bsl2": "核心区-外周式（含缓冲走廊）",
    "bsl3": "核心区-外周式（三区两缓，单向流程）",
    "animal": "双走廊式（洁/污分流）",
}

# 人均使用面积 (m²/人) —— 引用 JGJ 91-2019 表 4.1
AREA_PER_PERSON: dict[str, tuple[float, float]] = {
    "chemical": (10.0, 15.0),
    "biological": (8.0, 12.0),
    "physical": (6.0, 10.0),
    # 以下为参考通用指标
    "cleanroom": (8.0, 12.0),
    "bsl2": (8.0, 12.0),
    "bsl3": (10.0, 15.0),
    "animal": (8.0, 12.0),
}

# 操作间距与通道参数 —— 引用 JGJ 91-2019
EQUIPMENT_CLEARANCE_M = 0.8     # 设备四周操作间距 ≥0.8m
MAIN_CHANNEL_WIDTH_M = 1.5       # 主通道 ≥1.5m
SUB_CHANNEL_WIDTH_M = 1.2        # 次通道 ≥1.2m
CHANNEL_AREA_RATIO = 0.25       # 通道面积占使用面积比（简化估算）
RESERVE_RATIO = 0.25            # 预留面积比 20%-30%（取 25%）

# 环境参数需求 —— 引用 GB 50881-2013 表 7.4.1 / JGJ 91-2019 表 8.1.3
# 字段: temp_summer(min,max), temp_winter(min,max), humidity(min,max或None), ach(min,max或None),
#       airflow_note, pressure_pa, note
ENV_REQUIREMENTS: dict[str, dict] = {
    "chemical": {
        "temp_summer": (25, 27), "temp_winter": (19, 21),
        "humidity": (None, 70), "ach": (6, 8),
        "airflow_note": "换气 6-8 次/h", "pressure_pa": None,
        "note": "化学实验室：维持微负压防有害气体外溢",
    },
    "biological": {
        "temp_summer": (25, 27), "temp_winter": (19, 21),
        "humidity": (None, 75), "ach": (None, None),
        "airflow_note": "按风量平衡计算（排风+补风匹配）", "pressure_pa": None,
        "note": "生物实验室：换气按风量平衡，不固定次数",
    },
    "physical": {
        "temp_summer": (25, 27), "temp_winter": (19, 21),
        "humidity": (None, 60), "ach": (3, 4),
        "airflow_note": "换气 3-4 次/h", "pressure_pa": None,
        "note": "物理实验室：控湿防潮，保护精密仪器",
    },
    "cleanroom": {
        "temp_summer": (22, 24), "temp_winter": (20, 22),
        "humidity": (40, 60), "ach": (20, 30),
        "airflow_note": "洁净空调全新风/循环风", "pressure_pa": 10,
        "note": "洁净室：正压防外部污染侵入",
    },
    "bsl2": {
        "temp_summer": (24, 26), "temp_winter": (20, 22),
        "humidity": (None, 75), "ach": (15, 20),
        "airflow_note": "负压梯度，排风经高效过滤", "pressure_pa": -10,
        "note": "BSL-2：负压防气溶胶外溢，梯度压差",
    },
    "bsl3": {
        "temp_summer": (24, 26), "temp_winter": (20, 22),
        "humidity": (None, 75), "ach": (25, 30),
        "airflow_note": "负压梯度，双高效过滤排风", "pressure_pa": -15,
        "note": "BSL-3：更严负压梯度，三级压差控制",
    },
    "animal": {
        "temp_summer": (22, 26), "temp_winter": (20, 24),
        "humidity": (40, 70), "ach": (10, 15),
        "airflow_note": "全新风，氨浓度控制", "pressure_pa": None,
        "note": "动物房：全新风换气，控制氨气浓度",
    },
    # 特殊房间
    "precision_balance": {
        "temp_summer": (18, 22), "temp_winter": (18, 22),
        "humidity": (40, 60), "ach": (40, 40),
        "airflow_note": "高换气，恒温恒湿", "pressure_pa": None,
        "note": "高精度天平室：20±2℃，50±10%RH，换气 40 次/h",
    },
    "electron_microscope": {
        "temp_summer": (20, 20), "temp_winter": (20, 20),
        "humidity": (None, 60), "ach": (50, 50),
        "airflow_note": "专用空调，恒温恒湿", "pressure_pa": None,
        "note": "电镜室：20℃，≤60%RH，换气 50 次/h",
    },
    "culture_room": {
        "temp_summer": (20, 26), "temp_winter": (20, 26),
        "humidity": (None, 65), "ach": (50, 50),
        "airflow_note": "专用空调，恒温", "pressure_pa": None,
        "note": "生物培养室：20-26℃，≤65%RH，换气 50 次/h",
    },
}

# 推荐标准设备清单 —— 单台散热量 W / 用电 kW / 用水 L/h / 用气 L/min
EQUIPMENT_PRESETS: dict[str, list[tuple[str, int, float, float, float, float]]] = {
    "chemical": [
        ("通风柜", 1, 800, 1.2, 0, 0),
        ("实验台（中央）", 4, 150, 0.5, 0, 0),
        ("通风橱/药品柜", 2, 100, 0.2, 0, 0),
        ("烘箱", 1, 2000, 2.0, 0, 0),
        ("纯水机", 1, 300, 1.5, 5, 0),
    ],
    "biological": [
        ("II级生物安全柜", 2, 600, 0.4, 0, 0),
        ("CO2培养箱", 3, 200, 0.3, 0, 0.5),
        ("高速离心机", 2, 800, 1.0, 0, 0),
        ("超低温冰箱", 1, 500, 1.2, 0, 0),
        ("显微镜", 2, 100, 0.1, 0, 0),
    ],
    "physical": [
        ("电子天平（十万分之一）", 2, 50, 0.05, 0, 0),
        ("电镜", 1, 1500, 3.0, 0, 0),
        ("光谱仪", 1, 800, 2.0, 0, 0),
        ("恒温恒湿空调", 1, 0, 2.5, 0, 0),
    ],
    "cleanroom": [
        ("超净工作台", 4, 400, 0.3, 0, 0),
        ("FFU风机过滤单元", 8, 200, 0.2, 0, 0),
        ("纯水机", 1, 300, 1.5, 5, 0),
        ("生物安全柜", 1, 600, 0.4, 0, 0),
    ],
    "bsl2": [
        ("II级生物安全柜(B2外排)", 2, 1200, 0.6, 0, 0),
        ("高速离心机(密封转头)", 2, 800, 1.0, 0, 0),
        ("CO2培养箱", 2, 200, 0.3, 0, 0.5),
        ("双扉高压灭菌器", 1, 1500, 3.0, 10, 0),
        ("超低温冰箱", 1, 500, 1.2, 0, 0),
    ],
    "bsl3": [
        ("II级生物安全柜(B2外排)", 3, 1200, 0.6, 0, 0),
        ("高速离心机(密封转头)", 2, 800, 1.0, 0, 0),
        ("双扉高压灭菌器(双扉穿墙)", 1, 1500, 3.0, 10, 0),
        ("超低温冰箱", 2, 500, 1.2, 0, 0),
    ],
    "animal": [
        ("IVC饲养笼架", 6, 300, 0.4, 0, 0),
        ("笼具洗消机", 1, 2000, 4.0, 20, 0),
        ("独立通风系统", 1, 500, 1.0, 0, 0),
        ("生物安全柜", 1, 600, 0.4, 0, 0),
    ],
}

# 人流物流动线规划 —— 引用 GB 50346-2011
CIRCULATION: dict[str, dict] = {
    "chemical": {
        "type": "人员流 + 样品流分离",
        "nodes": ["更衣", "传递窗", "样品入口"],
    },
    "biological": {
        "type": "人员流 + 样品流分离",
        "nodes": ["更衣", "传递窗", "样品入口"],
    },
    "physical": {
        "type": "人员流 + 样品流分离",
        "nodes": ["更衣", "传递窗", "防振区入口"],
    },
    "cleanroom": {
        "type": "人员净化通道 + 物料净化通道 + 污物通道",
        "nodes": ["人净化（更衣/风淋）", "物净化（传递窗/风淋）", "污物出口"],
    },
    "bsl2": {
        "type": "人员流 + 样品流 + 污物流 三流分离，单向流动",
        "nodes": ["更衣缓冲", "传递窗", "双扉高压灭菌器", "污物出口"],
    },
    "bsl3": {
        "type": "人员流 + 样品流 + 污物流 三流分离，严格单向",
        "nodes": ["更衣缓冲（三区两缓）", "传递窗（双扉）", "双扉高压灭菌器", "污物出口"],
    },
    "animal": {
        "type": "清洁流 + 污物流分离，单向流动",
        "nodes": ["更衣", "洁净走廊", "污物走廊", "笼具洗消"],
    },
}


# ==================================================================
#  核心功能 1：功能分区计算
# ==================================================================


def calculate_zones(lab_type: LabType, total_area: float) -> ZoneResult:
    """功能分区计算，引用 JGJ 91-2019 / GB 50346-2011。"""
    key = lab_type.value
    ratios = ZONE_RATIOS[key]
    zones = [
        ZoneItem(name=name, area_m2=round(total_area * r, 2), ratio=r)
        for name, r in ratios.items()
    ]
    return ZoneResult(
        zones=zones,
        total_area_m2=round(total_area, 2),
        layout_mode=LAYOUT_MODE[key],
        regulation_reference="JGJ 91-2019 / GB 50346-2011（功能分区比例）",
    )


# ==================================================================
#  核心功能 2：面积指标估算
# ==================================================================


def estimate_area(lab_type: LabType, personnel_count: int, equipment: list[ProcessEquipment]) -> AreaEstimate:
    """面积指标估算，引用 JGJ 91-2019 表 4.1。

    人均使用面积取区间上限作为设计值；设备占地含 ≥0.8m 操作间距；
    通道面积按使用面积 25% 估算；预留 25% 扩展面积。
    """
    key = lab_type.value
    per_person_lo, per_person_hi = AREA_PER_PERSON[key]
    per_person = per_person_hi  # 取上限作为设计值

    # 人员使用面积
    personnel_area = personnel_count * per_person

    # 设备占地：每台按 (长+2*0.8)*(宽+2*0.8) 含操作间距
    equipment_area = 0.0
    for eq in equipment:
        eff_length = eq.length_m + 2 * EQUIPMENT_CLEARANCE_M
        eff_width = eq.width_m + 2 * EQUIPMENT_CLEARANCE_M
        equipment_area += eff_length * eff_width * eq.count

    # 通道面积（简化估算）
    usable = personnel_area + equipment_area
    channel_area = usable * CHANNEL_AREA_RATIO

    # 预留扩展面积
    subtotal = usable + channel_area
    suggested_total = subtotal * (1 + RESERVE_RATIO)

    # 分区分配（按建议总面积）
    ratios = ZONE_RATIOS[key]
    zone_allocation = [
        ZoneItem(name=name, area_m2=round(suggested_total * r, 2), ratio=r)
        for name, r in ratios.items()
    ]

    return AreaEstimate(
        per_person_area_m2=per_person,
        personnel_area_m2=round(personnel_area, 2),
        equipment_area_m2=round(equipment_area, 2),
        channel_area_m2=round(channel_area, 2),
        reserve_ratio=RESERVE_RATIO,
        suggested_total_area_m2=round(suggested_total, 2),
        zone_allocation=zone_allocation,
        regulation_reference="JGJ 91-2019 表 4.1（人均使用面积指标）",
    )


# ==================================================================
#  核心功能 3：环境参数需求
# ==================================================================


def calculate_env_requirements(lab_type: LabType, room_function: RoomFunction) -> EnvRequirement:
    """环境参数需求，引用 GB 50881-2013 表 7.4.1 / JGJ 91-2019 表 8.1.3。

    特殊房间（天平室/电镜室/培养室）按 room_function 查表，否则按 lab_type 查表。
    """
    # 优先查特殊房间功能
    if room_function != RoomFunction.GENERAL:
        key = room_function.value
    else:
        key = lab_type.value

    env = ENV_REQUIREMENTS[key]
    ts_min, ts_max = env["temp_summer"]
    tw_min, tw_max = env["temp_winter"]
    h_min, h_max = env["humidity"]
    ach_min, ach_max = env["ach"]

    ref = (
        "GB 50881-2013 表 7.4.1 / JGJ 91-2019 表 8.1.3（特殊房间环境参数）"
        if room_function != RoomFunction.GENERAL
        else "GB 50881-2013 表 7.4.1 / JGJ 91-2019 表 8.1.3（实验室环境参数）"
    )

    return EnvRequirement(
        temp_summer_min_c=ts_min,
        temp_summer_max_c=ts_max,
        temp_winter_min_c=tw_min,
        temp_winter_max_c=tw_max,
        humidity_min_pct=h_min,
        humidity_max_pct=h_max,
        ach_min=ach_min,
        ach_max=ach_max,
        fresh_air_note=env["airflow_note"],
        pressure_pa=env["pressure_pa"],
        note=env["note"],
        regulation_reference=ref,
    )


# ==================================================================
#  核心功能 4：设备清单与负荷预估算
# ==================================================================


def estimate_equipment_load(lab_type: LabType, room_function: RoomFunction) -> EquipmentLoadResult:
    """推荐标准设备清单并估算散热/用电/用水/用气负荷。

    总散热量供暖通负荷计算，总用电量供电气负荷计算。
    """
    key = lab_type.value
    preset = EQUIPMENT_PRESETS.get(key, [])

    items: list[EquipmentLoadItem] = []
    total_heat_w = 0.0
    total_power_kw = 0.0
    total_water = 0.0
    total_gas = 0.0
    for name, count, heat_w, power_kw, water_l_h, gas_l_min in preset:
        items.append(
            EquipmentLoadItem(
                name=name,
                count=count,
                heat_w=heat_w,
                power_kw=power_kw,
                water_l_h=water_l_h,
                gas_l_min=gas_l_min,
            )
        )
        total_heat_w += heat_w * count
        total_power_kw += power_kw * count
        total_water += water_l_h * count
        total_gas += gas_l_min * count

    return EquipmentLoadResult(
        items=items,
        total_heat_kw=round(total_heat_w / 1000.0, 2),
        total_power_kw=round(total_power_kw, 2),
        total_water_l_h=round(total_water, 2),
        total_gas_l_min=round(total_gas, 2),
        regulation_reference="JGJ 91-2019（实验室设备配置）/ GB 50189-2015（负荷估算）",
    )


# ==================================================================
#  核心功能 5：人流物流动线规划
# ==================================================================


def plan_circulation(lab_type: LabType) -> CirculationPlan:
    """人流物流动线规划，引用 GB 50346-2011。"""
    key = lab_type.value
    info = CIRCULATION[key]
    return CirculationPlan(
        circulation_type=info["type"],
        key_nodes=info["nodes"],
        regulation_reference="GB 50346-2011（人流物流分离/压差梯度）",
    )


# ==================================================================
#  编排函数：组合五大功能 + 规范引用 + 公式说明
# ==================================================================


PROCESS_REGULATION_REFERENCES = [
    "JGJ 91-2019《科研建筑设计标准》",
    "GB 50346-2011《生物安全实验室建筑技术规范》",
    "GB 50881-2013《疾病预防控制中心建筑技术规范》",
    "GB 50189-2015《公共建筑节能设计标准》",
]

PROCESS_FORMULA_EXPLANATIONS = [
    "功能分区：按实验室类型预设比例 × 总面积，依据 JGJ 91-2019 / GB 50346-2011",
    "人均使用面积取区间上限作为设计值（JGJ 91-2019 表 4.1）",
    "设备占地 = (长+2×0.8)×(宽+2×0.8)×台数，含 ≥0.8m 操作间距",
    "通道面积 ≈ 使用面积 × 25%（主通道≥1.5m / 次通道≥1.2m）",
    "预留面积 = 小计 × 25%（未来扩展，20%-30%）",
    "环境参数按 lab_type/room_function 查表（GB 50881 表 7.4.1 / JGJ 91 表 8.1.3）",
    "总散热量 = Σ(单台散热量×台数) → 供暖通负荷",
    "总用电量 = Σ(单台功率×台数) → 供电气负荷",
    "动线规划按三流分离/单向流动原则（GB 50346-2011）",
]


def calculate_process(inp: ProcessInput) -> ProcessResult:
    """工艺规划主入口：分区 → 面积 → 环境 → 设备负荷 → 动线。"""
    key = inp.lab_type.value

    # 1) 功能分区：有总面积则按其分区，无则用面积估算的建议值
    area = estimate_area(inp.lab_type, inp.personnel_count, inp.equipment)
    base_area = inp.total_area if inp.total_area is not None else area.suggested_total_area_m2
    zones = calculate_zones(inp.lab_type, base_area)

    # 2) 环境参数
    env = calculate_env_requirements(inp.lab_type, inp.room_function)

    # 3) 设备负荷
    equipment_load = estimate_equipment_load(inp.lab_type, inp.room_function)

    # 4) 动线规划
    circulation = plan_circulation(inp.lab_type)

    return ProcessResult(
        zones=zones,
        area=area,
        env=env,
        equipment_load=equipment_load,
        circulation=circulation,
        regulation_references=PROCESS_REGULATION_REFERENCES,
        formula_explanations=PROCESS_FORMULA_EXPLANATIONS,
    )
