"""给排水计算服务模块 (Plumbing Service)
==========================================
依《建筑给水排水设计标准》GB 50015-2019，完成：
    1. 水力计算 calculate_hydraulics：总流量 → 管径 → 坡度 → 流速校核
    2. 材质推荐 recommend_material：按排水类型选管材
    3. 总入口 calculate_plumbing -> PlumbingResult

公式：
    Q_total = Σ q_i                    (L/s)  总排水流量
    管径: FLOW_DN_TABLE 中 Q_total ≤ max_l_s 的最小 DN
    坡度: TYPE_MIN_SLOPE 按类型与管径取值
          - waste:  DN≤50 取 0.026 (标准坡度), DN≥75 取 0.015 (最小坡度)
          - acid/organic: 固定 0.020 (防沉积，不随管径增大而减小)
    流速: 假设充满度 h/D=0.5，过水断面 A = 0.5·π·(D/1000)²/4
          v = (Q_total/1000) / A        (m/s)
          校核 v ∈ [0.6, 2.5]；v < 0.6 时按曼宁公式反算自清所需坡度并提示

注：流量-管径表为模拟数据，结构清晰，便于后续替换为数据库/材料库查询。
"""
from __future__ import annotations

import math
from typing import Final

from app.core import constants as C
from app.schemas.plumbing import (
    FlowData, MaterialRecommendation, PipeSelection, PlumbingInput,
    PlumbingResult, SlopeSelection, VelocityCheck,
)

_VALID_TYPES: Final[tuple[str, ...]] = ("waste", "acid", "organic")


# ============================================================
# 1. 水力计算
# ============================================================
def calculate_hydraulics(inp: PlumbingInput) -> tuple[FlowData, PipeSelection, SlopeSelection, VelocityCheck, list[str]]:
    """
    水力计算全流程，返回 (流量汇总, 管径, 坡度, 流速校核, 公式说明列表)。

    混合排水提示: 酸性/有机废水与生活废水同管合流不符合实验室分质排水
    惯例，混合时在公式说明中给出分质排水提示。
    """
    notes: list[str] = []

    # ---- 总流量 ----
    total = sum(e.drainage_l_s for e in inp.equipment)
    by_type: dict[str, float] = {}
    for e in inp.equipment:
        t = e.drainage_type if e.drainage_type in _VALID_TYPES else "waste"
        by_type[t] = round(by_type.get(t, 0.0) + e.drainage_l_s, 3)
    mixed = len([t for t in by_type if by_type[t] > 0]) > 1
    if mixed:
        notes.append("存在多种排水类型合流，实验室通常要求分质排水（酸性/有机废水单独收集处理），请工程师确认。")
    notes.append(f"Q_total = Σ q_i = {'+'.join(f'{e.drainage_l_s:g}' for e in inp.equipment) or '0'} = {total:g} L/s")

    flow = FlowData(
        total_l_s=round(total, 3),
        equipment_count=len(inp.equipment),
        by_type=by_type,
        mixed_types=mixed,
    )

    # ---- 管径选型 (最小满足规格) ----
    row = next((r for r in C.FLOW_DN_TABLE if total <= r["max_l_s"]), C.FLOW_DN_TABLE[-1])
    if total > 4.0:
        notes.append(f"Q_total {total:g} L/s 超出对照表常用区间，已取上限 DN100，建议分回路排水或由工程师水力计算确认。")
    pipe = PipeSelection(
        dn_mm=row["dn"], label=row["label"],
        basis=f"Q_total = {total:g} ≤ {row['max_l_s']:g} L/s → 最小满足规格 {row['label']}",
    )
    notes.append(f"管径: {pipe.basis}")

    # ---- 坡度选型 (按排水类型) ----
    # 主导类型取流量最大的类型（混合时以最不利/最严格为准）
    dominant = max(by_type, key=lambda t: by_type[t]) if by_type else "waste"
    slope_val, slope_basis = _slope_for(dominant, row["dn"], by_type)
    slope = SlopeSelection(
        value=slope_val,
        permille=round(slope_val * 1000, 1),
        basis=slope_basis,
    )
    notes.append(f"坡度 i = {slope_val:g} ({slope_val * 1000:g}‰) ← {slope_basis}")

    # ---- 流速校核 (充满度 0.5) ----
    velocity = _velocity_check(total, row["dn"], slope_val, inp)
    notes.append(
        f"流速: A = 0.5·π·({row['dn']}/1000)²/4 = {velocity.flow_area_m2:.5f} m², "
        f"v = (Q/1000)/A = {total / 1000:.5f}/{velocity.flow_area_m2:.5f} = {velocity.velocity:g} m/s "
        f"({'✓' if velocity.ok else '✗'} 允许 {inp.velocity_min}~{inp.velocity_max} m/s)"
    )
    if velocity.remark:
        notes.append(velocity.remark)

    return flow, pipe, slope, velocity, notes


def _slope_for(dominant: str, dn: int, by_type: dict[str, float]) -> tuple[float, str]:
    """
    按排水类型与管径确定坡度。

    规则 (用户需求 + GB 50015-2019):
        - waste:    DN≤50 → 0.026 (标准坡度)；DN≥75 → 0.015 (最小坡度)
        - acid/organic: 固定 0.020 防沉积 (不随管径增大而减小)
        - 混合排水:  各类型坡度取最大值 (从严)
    """
    if len(by_type) > 1:
        # 混合排水从严: 各涉及类型所需坡度取最大
        candidates = []
        for t, q in by_type.items():
            if q > 0:
                v, _ = _slope_for_single(t, dn)
                candidates.append(v)
        val = max(candidates)
        return val, f"混合排水从严取 max({', '.join(f'{c:g}' for c in candidates)})"
    return _slope_for_single(dominant, dn)


def _slope_for_single(dtype: str, dn: int) -> tuple[float, str]:
    """单一排水类型的坡度取值。"""
    cfg = C.TYPE_MIN_SLOPE.get(dtype, C.TYPE_MIN_SLOPE["waste"])
    if "fixed" in cfg:
        return cfg["fixed"], cfg["note"]
    # waste: 小管径取标准坡度, 大管径可减小到最小坡度
    if dn <= cfg["small_dn_max"]:
        return cfg["small_dn"], f"{cfg['note']} (DN≤{cfg['small_dn_max']} 标准坡度)"
    return cfg["large_dn"], f"{cfg['note']} (DN≥{cfg['small_dn_max'] + 25} 最小坡度)"


def _velocity_check(total_l_s: float, dn: int, slope: float, inp: PlumbingInput) -> VelocityCheck:
    """
    流速校核: 假设充满度 h/D = 0.5 (半管流)。

    过水断面 A = 0.5 · π · (D/1000)² / 4   (m²)
    v = (Q_total/1000) / A                  (m/s, 连续性方程)

    v < v_min 时，用曼宁公式 v = (1/n)·R^(2/3)·i^(1/2) (R = D/4 半管水力半径)
    反算自清所需坡度，提示工程师加大坡度 (不自动改值，避免与类型最小坡度规则冲突)。
    """
    d_m = dn / 1000.0
    area = C.PLUMBING_FULLNESS * math.pi * d_m * d_m / 4.0
    q_m3s = total_l_s / 1000.0
    v = q_m3s / area if area > 0 else 0.0
    ok = inp.velocity_min <= v <= inp.velocity_max

    remark = ""
    if v < inp.velocity_min:
        # 曼宁公式反算自清坡度: i = (v·n/R^(2/3))², 半管水力半径 R = D/4
        r = d_m / 4.0
        i_need = (inp.velocity_min * C.PLUMBING_MANNING_N / (r ** (2.0 / 3.0))) ** 2
        remark = (f"流速 {v:.2f} m/s 低于自清流速 {inp.velocity_min} m/s，"
                  f"按曼宁公式 (n={C.PLUMBING_MANNING_N}) 反算自清所需坡度约 {i_need:.3f}，"
                  f"建议工程师复核是否加大坡度或减小管径。")
    elif v > inp.velocity_max:
        remark = (f"流速 {v:.2f} m/s 超过上限 {inp.velocity_max} m/s，"
                  f"可能产生噪声与管道冲刷，建议放大管径或设置消能措施，请工程师复核。")

    return VelocityCheck(
        velocity=round(v, 3),
        fullness=C.PLUMBING_FULLNESS,
        flow_area_m2=round(area, 6),
        ok=ok,
        remark=remark,
    )


# ============================================================
# 2. 材质推荐
# ============================================================
def recommend_material(drainage_type: str, by_type: dict[str, float] | None = None) -> MaterialRecommendation:
    """
    按排水类型推荐管材:
        waste   → UPVC (硬聚氯乙烯)
        acid    → PP (聚丙烯) / PVDF (聚偏氟乙烯)
        organic → SS304 (不锈钢) / PP
    混合排水时按"最严格耐蚀需求"向上取 (acid > organic > waste 的耐蚀优先级)。
    """
    priority = {"acid": 3, "organic": 2, "waste": 1}
    if by_type:
        active = [t for t, q in by_type.items() if q > 0]
        dtype = max(active, key=lambda t: priority.get(t, 1)) if active else "waste"
    else:
        dtype = drainage_type if drainage_type in _VALID_TYPES else "waste"

    cfg = C.PIPE_MATERIAL_BY_TYPE[dtype]
    return MaterialRecommendation(
        code=cfg["code"], name=cfg["name"],
        alternatives=cfg["alternatives"], note=cfg["note"],
    )


# ============================================================
# 3. 总入口：组装 PlumbingResult
# ============================================================
def calculate_plumbing(inp: PlumbingInput) -> PlumbingResult:
    """水力计算 → 材质推荐 → 组装 PlumbingResult (含公式说明)。"""
    if not inp.equipment:
        inp.equipment = []  # 防御: 空清单按 0 流量处理

    flow, pipe, slope, velocity, notes = calculate_hydraulics(inp)
    material = recommend_material(
        inp.equipment[0].drainage_type if inp.equipment else "waste",
        flow.by_type,
    )
    notes.append(f"管材: {material.name} ← {material.note}")

    return PlumbingResult(
        flow=flow, pipe=pipe, slope=slope,
        velocity=velocity, material=material, formula_notes=notes,
    )
