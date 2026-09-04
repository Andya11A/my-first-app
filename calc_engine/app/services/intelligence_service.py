"""
智能化设计服务模块 (Intelligence Service)
==========================================
职责：完成实验室智能化设计的三项核心计算
    1. 信息点位统计 (网络/电话/监控/门禁)
    2. 环境监控布置 (温湿度/压差/VOC 报警器)
    3. 能耗监测规划 (智能电表/水表)

公式：
    点位总数 = Σ (房间密度 × 数量)           (向上取整)
    环境传感器 = Σ (面积 × 密度) + 房间数 × 每间压差数
    能耗仪表 = 配电箱数 × 每箱 1 + 进水管数 × 每管 1

注：适配 calc_engine 统一契约（CalculationResult[T]），原洁净EPC-AI 版本的
    ResultItem/task/items 封装改为 IntelligenceResult 结构化输出。
"""
from __future__ import annotations

import math

from app.core import constants as C
from app.schemas.intelligence import (
    IntelligenceInput, IntelligenceResult, IntelligenceResultItem,
)


def calculate_intelligence(inp: IntelligenceInput) -> IntelligenceResult:
    """智能化全流程计算入口：点位 → 环境监控 → 能耗。"""
    notes: list[str] = []

    p_items, p_summary = calc_points(inp, notes)
    e_items, e_summary = calc_env_monitoring(inp, notes)
    en_items, en_summary = calc_energy_monitoring(inp)

    items = [*p_items, *e_items, *en_items]
    summary: dict[str, float] = {}
    summary.update(p_summary)
    summary.update(e_summary)
    summary.update(en_summary)
    notes.append("本结果为方案阶段 AI 初算值，必须持证工程师复核；密度预设可按项目实际校准")
    return IntelligenceResult(items=items, summary=summary, formula_notes=notes)


# ============================================================
# 1. 信息点位统计
# ============================================================
def calc_points(
    inp: IntelligenceInput, notes: list[str],
) -> tuple[list[IntelligenceResultItem], dict[str, float]]:
    """
    各功能房间信息点位：按密度 × 数量向上取整后汇总。
        N_point(type) = Σ ⌈ density[function][type] × count ⌉
    """
    items: list[IntelligenceResultItem] = []
    totals = {"network": 0, "phone": 0, "camera": 0, "access": 0}

    for room in inp.rooms:
        density = C.ROOM_POINT_DENSITY.get(room.function)
        if not density:
            notes.append(f"警告：未知房间功能 {room.function}，跳过 {room.name}")
            continue
        room_total = 0
        for ptype in totals:
            n = math.ceil(density[ptype] * room.count)
            totals[ptype] += n
            room_total += n
        items.append(IntelligenceResultItem(
            name=f"{room.name}({room.function}) 点位合计", value=float(room_total), unit="点",
            formula=f"Σ⌈density*{room.count}⌉ = {room_total}",
            remark=f"面积 {room.area} m2 ×{room.count}",
        ))

    for ptype, n in totals.items():
        items.append(IntelligenceResultItem(
            name=f"{ptype} 总点数", value=float(n), unit="点", formula=f"Σ各房间 = {n}"))
    summary: dict[str, float] = {"point_total_all": float(sum(totals.values()))}
    summary.update({f"point_{k}": float(v) for k, v in totals.items()})
    return items, summary


# ============================================================
# 2. 环境监控布置
# ============================================================
def calc_env_monitoring(
    inp: IntelligenceInput, notes: list[str],
) -> tuple[list[IntelligenceResultItem], dict[str, float]]:
    """
    环境监控：温湿度/VOC 按面积密度，压差按房间配对 (每间 1 个)。
        N_temp_humidity = Σ (area × density[lab_type].temp_humidity)
        N_voc           = Σ (area × density[lab_type].voc)
        N_pressure_diff = Σ (count × per_room[lab_type])
    仅对实验室 (function=lab) 计算。
    """
    items: list[IntelligenceResultItem] = []
    totals = {"temp_humidity": 0, "pressure_diff": 0, "voc": 0}

    for room in inp.rooms:
        if room.function != "lab":
            continue
        density = C.ENV_SENSOR_DENSITY.get(room.lab_type)
        if not density:
            notes.append(f"警告：未知 lab_type {room.lab_type}，跳过 {room.name}")
            continue
        th = math.ceil(room.area * room.count * density["temp_humidity"])
        voc = math.ceil(room.area * room.count * density["voc"])
        pd = C.PRESSURE_DIFF_PER_ROOM.get(room.lab_type, 0) * room.count
        totals["temp_humidity"] += th
        totals["voc"] += voc
        totals["pressure_diff"] += pd
        items.append(IntelligenceResultItem(
            name=f"{room.name} 温湿度", value=float(th), unit="个",
            formula=f"⌈area*count*density⌉ = {room.area}*{room.count}*{density['temp_humidity']} = {th}"))
        if voc:
            items.append(IntelligenceResultItem(
                name=f"{room.name} VOC 报警器", value=float(voc), unit="个",
                formula=f"⌈area*count*density⌉ = {room.area}*{room.count}*{density['voc']} = {voc}"))
        if pd:
            items.append(IntelligenceResultItem(
                name=f"{room.name} 压差传感器", value=float(pd), unit="个",
                formula=f"per_room*count = {C.PRESSURE_DIFF_PER_ROOM.get(room.lab_type, 0)}*{room.count} = {pd}"))

    for stype, n in totals.items():
        items.append(IntelligenceResultItem(
            name=f"{stype} 总数", value=float(n), unit="个", formula=f"Σ各实验室 = {n}"))
    summary: dict[str, float] = {"env_sensors_total": float(sum(totals.values()))}
    summary.update({f"env_{k}": float(v) for k, v in totals.items()})
    return items, summary


# ============================================================
# 3. 能耗监测规划
# ============================================================
def calc_energy_monitoring(
    inp: IntelligenceInput,
) -> tuple[list[IntelligenceResultItem], dict[str, float]]:
    """
    能耗监测：按配电箱配智能电表、按进水管配水表。
        N_智能电表 = distribution_boxes × 每箱 1
        N_水表     = water_inlets × 每管 1
    数据采集方案：通过 RS485/Modbus 或 以太网网关接入能耗管理平台。
    """
    items: list[IntelligenceResultItem] = []
    n_meter = inp.distribution_boxes * C.METER_PER_DISTRIBUTION_BOX
    n_water = inp.water_inlets * C.WATER_METER_PER_INLET

    items.append(IntelligenceResultItem(
        name="智能电表", value=float(n_meter), unit="只",
        formula=f"配电箱*每箱1 = {inp.distribution_boxes}*{C.METER_PER_DISTRIBUTION_BOX} = {n_meter}",
        remark="按配电箱配置，监测各回路能耗"))
    items.append(IntelligenceResultItem(
        name="智能水表", value=float(n_water), unit="只",
        formula=f"进水管*每管1 = {inp.water_inlets}*{C.WATER_METER_PER_INLET} = {n_water}",
        remark="按进水管配置"))
    items.append(IntelligenceResultItem(
        name="数据采集方案", value=0.0, unit="RS485/Modbus→网关→能耗平台",
        formula="标准采集链路"))

    summary = {"smart_meters": float(n_meter), "water_meters": float(n_water)}
    return items, summary
