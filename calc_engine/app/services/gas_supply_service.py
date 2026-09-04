"""集中供气计算模块 (Gas Supply Service)
==========================================

专业职责：实验室集中供气系统的流量计算、管径与材质选型、
气瓶/汇流排/杜瓦罐供应方案、减压阀配置。

核心公式一览（单位标注）
------------------------
1)  单种气体峰值流量  Q_峰 = Σ(单点峰值 × 台数)                    [L/min]
2)  设计流量          Q_设计 = Q_峰 × K_同时                        [L/min]
    —— 同时使用系数分档: ≤5 点取 0.8；6~10 点取 0.6；>10 点取 0.5
3)  标态体积流量      q_N = Q_设计 × 60 / 1000                      [Nm³/h]
4)  工作态管内流量    q_线 = q_N × P_0 / (P_0 + P_供)
    —— 理想气体状态换算：压力越高同质量气体体积越小
    —— P_0 = 1.013 bar(A)，P_供 = 终端供气压力 bar(g)
5)  管内径            d = √(4·q_线 / (3600·π·v))                   [m]
    —— v: 管内流速上限（常用 5~10 m/s，取 8）
    —— 从不锈钢仪表管标准外径系列 (6.35/9.52/12.7/19.05/25.4mm...) 选
       "内径 = 外径 − 2×壁厚" 首个满足 d 的规格
6)  沿程压降 (Darcy)  Δp = λ · (L/d) · (ρ·v²/2)                    [Pa]
    —— λ ≈ 0.025（不锈钢光滑管湍流）；工作态密度 ρ = ρ_N × P_线/P_0
    —— 校核: Δp ≤ 10% × 供气绝对压力，否则告警增大管径
7)  单瓶可供气量      V_瓶 ≈ V_水容积 × P_瓶压 / P_0 = 40×150/1.013 ≈ 5.9  [Nm³]
8)  单瓶续航          T_瓶 = V_瓶 / V_日                            [天]
    —— V_日 = Σ(日均流量 × 台数) × 时数 × 60 / 1000                 [Nm³/天]
9)  供应方案判据:
    - V_日 ≤ V_瓶/2            → 单瓶供气 + 备用瓶手动切换
    - V_瓶/2 < V_日 < 30 Nm³   → 2×N 全自动切换汇流排，N = ⌈V_日/V_瓶⌉
    - V_日 ≥ 30 Nm³ 且有液态数据 → 杜瓦罐：T_补液 = V_杜瓦 × 膨胀比 × 0.85 / V_日
10) 减压配置（常规）:
    一级: 钢瓶 15 MPa → 管线中压 0.8~1.0 bar(g)
    二级: 管线中压   → 终端设备要求压力 bar(g)
    终端压力 > 1.0 bar(g) 时一级直供，并校核下游承压
"""
from __future__ import annotations

import math
from typing import List

from app.core.constants import (
    CYLINDER_PRESSURE_BAR,
    DEWAR_DAILY_THRESHOLD_NM3,
    DEWAR_UTILIZATION,
    DEWAR_VOLUME_L_DEFAULT,
    FRICTION_FACTOR,
    GAS_AVG_LOAD_FACTOR,
    GAS_SIMULTANEITY_DEFAULT,
    GAS_SIMULTANEITY_TIERS,
    LINE_VELOCITY_DEFAULT,
    MAX_SINGLE_STAGE_DELIVERY_BAR,
    STANDARD_ATM_BAR,
    STAGE1_OUTLET_BAR,
    TUBE_OD_SERIES,
    TUBE_WALL_DEFAULT,
)
from app.schemas.gas import (
    CylinderPlan,
    GasPoint,
    GasSupplyInput,
    GasSupplyOutput,
    LineDesign,
    RegulatorPlan,
)
from app.services.base import BaseCalculationService
from app.services.material_db import GasProperty


def _generic_gas(code: str) -> GasProperty:
    """未收录气体的保守兜底：按惰性气体处理（密度取空气近似）。"""
    return GasProperty(
        code=code.upper(),
        name=f"未知气体({code})",
        category="inert",
        density_kg_nm3=1.2,
    )


class GasSupplyService(BaseCalculationService[GasSupplyInput, GasSupplyOutput]):
    """集中供气专业计算服务。"""

    module_name = "gas"
    module_version = "1.0.0"
    references = [
        "GB 50019-2015 工业建筑供暖通风与空气调节设计规范",
        "GB 50016-2014 建筑设计防火规范",
        "GB/T 50771-2012 有色金属工程设计防火规范（气瓶站）",
        "CGA / GB 16912 深冷气体供气安全",
    ]

    # ------------------------------------------------------------------
    def _calculate(self, inp: GasSupplyInput) -> GasSupplyOutput:
        lines: List[LineDesign] = []
        plans: List[CylinderPlan] = []

        for point in inp.points:
            # ---- 气体特性查询（材料库跨专业匹配） ----
            prop = self.materials.gas(point.gas)
            if prop is None:
                self.warn(
                    "GAS_W001",
                    f"未收录气体代码 {point.gas}，已按惰性气体保守处理，请人工复核材质与安全配置",
                    field="points.gas",
                )
                prop = _generic_gas(point.gas)

            lines.append(self._design_line(point, prop, inp))
            plans.append(self._cylinder_plan(point, prop, inp))

        return GasSupplyOutput(
            lines=lines,
            cylinder_plans=plans,
            total_points=sum(p.count for p in inp.points),
            gas_codes=[p.gas for p in inp.points],
        )

    # ------------------------------------------------------------------
    # 管路设计：流量 → 管径材质 → 压降校核 → 减压配置
    # ------------------------------------------------------------------
    def _design_line(self, point: GasPoint, prop: GasProperty, inp: GasSupplyInput) -> LineDesign:
        # ---- 1~3) 流量计算 ----
        total_peak_lpm = point.peak_flow_lpm * point.count        # L/min
        simultaneity = self._simultaneity(point.count)
        design_lpm = total_peak_lpm * simultaneity                 # L/min
        design_nm3h = design_lpm * 60.0 / 1000.0                   # Nm³/h

        # ---- 4) 工作态管内流量（理想气体压力换算） ----
        p_abs = STANDARD_ATM_BAR + inp.delivery_pressure_bar       # bar(A)
        line_nm3h = design_nm3h * STANDARD_ATM_BAR / p_abs         # m³/h

        # ---- 5) 管径计算与标准系列选型 ----
        # d = √(4·q / (3600·π·v)) [m] → [mm]
        d_mm = math.sqrt(4.0 * line_nm3h / 3600.0 / (math.pi * inp.line_velocity_mps)) * 1000.0
        # 从标准外径系列中选首个 内径(外径−2×壁厚) ≥ 所需内径 的规格
        tube_od = next(
            (od for od in TUBE_OD_SERIES if od - 2.0 * TUBE_WALL_DEFAULT >= d_mm),
            TUBE_OD_SERIES[-1],
        )
        tube_id = tube_od - 2.0 * TUBE_WALL_DEFAULT                # mm
        actual_velocity = line_nm3h / 3600.0 / (math.pi * (tube_id / 2000.0) ** 2)  # m/s

        # ---- 6) 沿程压降校核 (Darcy-Weisbach) ----
        rho_line = prop.density_kg_nm3 * p_abs / STANDARD_ATM_BAR  # 工作态密度 kg/m³
        dp_pa = (
            FRICTION_FACTOR
            * (inp.line_length_m / (tube_id / 1000.0))             # L/d 长径比
            * (rho_line * actual_velocity**2 / 2.0)                # 动压头 ρv²/2
        )
        dp_bar = dp_pa / 1e5
        if dp_bar > 0.1 * p_abs:
            self.warn(
                "GAS_W003",
                f"{prop.name}管路压降 {dp_bar:.3f} bar 超过供气压力 10%，"
                "建议增大管径或缩短气瓶间距离",
                field="line_length_m",
            )

        # ---- 管材（材料库：气体特性 × 纯度 → 管材） ----
        pipe_material = self.materials.gas_pipe_material(point.gas, inp.purity.value)
        regulator = self._regulator_plan(prop, inp.delivery_pressure_bar)
        special = self._special_requirements(prop, inp.purity.value)

        return LineDesign(
            gas_code=prop.code,
            gas_name=prop.name,
            hazard_category=prop.category,
            point_count=point.count,
            total_peak_lpm=round(total_peak_lpm, 2),
            simultaneity_factor=simultaneity,
            design_flow_nm3h=round(design_nm3h, 3),
            line_flow_nm3h=round(line_nm3h, 3),
            pipe_material=pipe_material,
            tube_od_mm=tube_od,
            tube_wall_mm=TUBE_WALL_DEFAULT,
            tube_id_mm=round(tube_id, 2),
            actual_velocity_mps=round(actual_velocity, 2),
            pressure_drop_bar=round(dp_bar, 4),
            regulator=regulator,
            special_requirements=special,
        )

    # ------------------------------------------------------------------
    # 供应方案：单瓶 / 汇流排 / 杜瓦罐
    # ------------------------------------------------------------------
    def _cylinder_plan(self, point: GasPoint, prop: GasProperty, inp: GasSupplyInput) -> CylinderPlan:
        # 日均流量：未提供时按峰值 × 经验负载率估算
        avg_lpm = point.avg_flow_lpm
        if avg_lpm is None:
            avg_lpm = point.peak_flow_lpm * GAS_AVG_LOAD_FACTOR
            self.warn(
                "GAS_W002",
                f"{prop.name}未提供日均流量，按峰值×{GAS_AVG_LOAD_FACTOR} 负载率估算瓶组续航，"
                "请结合实际运行制度复核",
                field="points.avg_flow_lpm",
            )

        # 公式(8): V_日 = Σ(日均流量 × 台数) × 时数 × 60 / 1000 → Nm³/天
        daily_nm3 = avg_lpm * point.count * inp.operating_hours_per_day * 60.0 / 1000.0
        usable = prop.cylinder_usable_nm3
        notes: List[str] = []

        if daily_nm3 <= 0:
            return CylinderPlan(
                gas_code=prop.code,
                daily_usage_nm3=0.0,
                cylinder_usable_nm3=usable,
                autonomy_days_per_cylinder=0.0,
                scheme="single",
                refill_interval_days=0.0,
                notes=["无日用气数据，未生成供应方案"],
            )

        autonomy = usable / daily_nm3    # 单瓶续航天数

        if daily_nm3 <= usable / 2.0:
            # 单瓶可用 ≥ 2 天 → 单瓶 + 备用瓶手动切换
            scheme, per_side, dewar = "single", None, None
            interval = autonomy
            notes.append("单瓶供气 + 备用瓶手动切换即可，建议配置半自动切换阀挑")
        elif daily_nm3 < DEWAR_DAILY_THRESHOLD_NM3:
            # 公式(9): 汇流排 2×N 全自动切换
            scheme, per_side, dewar = "manifold", max(2, math.ceil(daily_nm3 / usable)), None
            interval = usable * per_side / daily_nm3
            notes.append(f"2×{per_side} 全自动切换汇流排（一侧供气、一侧备用，无扰切换）")
        elif prop.liquid_expansion_ratio:
            # 大用量且该气体有液态供气数据 → 杜瓦罐
            scheme, per_side, dewar = "dewar", None, DEWAR_VOLUME_L_DEFAULT
            interval = dewar * prop.liquid_expansion_ratio * DEWAR_UTILIZATION / daily_nm3
            notes.append(f"推荐 {dewar:.0f}L 杜瓦罐液态供气，约 {interval:.1f} 天补液一次")
            if interval < 2:
                notes.append("日用气量大，建议评估液态储罐（真空粉末绝热）或现场制气方案")
                self.warn(
                    "GAS_W005",
                    f"{prop.name}日用气 {daily_nm3:.1f} Nm³ 超出杜瓦罐经济范围，建议专项设计液态储供",
                )
        else:
            # 大用量但无液态数据（如 CO2 特殊工况、特种气体）
            scheme, per_side, dewar = "custom", None, None
            interval = autonomy
            notes.append("日用气量大且无液态供气参数，需专项设计（储罐/现场制气/多点瓶组）")
            self.warn("GAS_W005", f"{prop.name}日用气 {daily_nm3:.1f} Nm³，需专项供气设计")

        return CylinderPlan(
            gas_code=prop.code,
            daily_usage_nm3=round(daily_nm3, 2),
            cylinder_usable_nm3=usable,
            autonomy_days_per_cylinder=round(autonomy, 2),
            scheme=scheme,
            cylinders_per_side=per_side,
            dewar_volume_l=dewar,
            refill_interval_days=round(interval, 2),
            notes=notes,
        )

    # ------------------------------------------------------------------
    # 减压阀配置
    # ------------------------------------------------------------------
    def _regulator_plan(self, prop: GasProperty, delivery_bar: float) -> RegulatorPlan:
        notes: List[str] = []
        cylinder_mpa = CYLINDER_PRESSURE_BAR / 10.0  # 150 bar = 15 MPa 钢瓶额定压力
        if delivery_bar <= MAX_SINGLE_STAGE_DELIVERY_BAR:
            # 常规两级减压: 15MPa → 0.8~1.0 bar(g) 管线 → 终端压力
            notes.append(
                f"一级减压: 钢瓶 {cylinder_mpa:.0f}MPa 级入口 → "
                f"管线中压 {STAGE1_OUTLET_BAR[0]}~{STAGE1_OUTLET_BAR[1]} bar(g)"
            )
            notes.append(f"二级减压: 管线中压 → 终端 {delivery_bar} bar(g)（出口可调型）")
            mode = "two_stage"
            stage1_out = f"{STAGE1_OUTLET_BAR[0]}~{STAGE1_OUTLET_BAR[1]}"
            stage2_out = f"{delivery_bar} (可调)"
        else:
            # 终端压力超过 1 bar(g) → 一级直供
            notes.append(
                f"终端压力 {delivery_bar} bar(g) > 1.0，采用一级减压直供，"
                "请校核下游管路及附件承压"
            )
            self.warn(
                "GAS_W004",
                f"{prop.name}终端压力 {delivery_bar} bar(g) 采用一级减压直供，"
                "请复核管路承压与设备耐压",
                field="delivery_pressure_bar",
            )
            mode = "single_stage"
            stage1_out = f"{delivery_bar} (直供)"
            stage2_out = None

        # 阀件选材要求（按气体特性追加，须在构造 RegulatorPlan 之前写入 notes）
        if prop.corrosive:
            notes.append("腐蚀性气体: 减压阀隔膜选 PCTFE/金属隔膜，阀体 316L，带吹扫结构")
        if prop.oxidizing:
            notes.append("氧气系统: 减压阀/阀门/管件必须严格脱脂禁油，禁用含油密封件")

        return RegulatorPlan(
            mode=mode,
            stage1_inlet_max_mpa=cylinder_mpa,
            stage1_outlet_bar=stage1_out,
            stage2_outlet_bar=stage2_out,
            notes=notes,
        )

    # ------------------------------------------------------------------
    # 安全与工艺特殊要求
    # ------------------------------------------------------------------
    def _special_requirements(self, prop: GasProperty, purity: str) -> List[str]:
        reqs: List[str] = []
        if prop.oxidizing:
            reqs.append("全管路及阀件脱脂禁油（氧气管道安全规范）")
        if prop.flammable:
            reqs.append("可燃气体: 设可燃气体探测报警并联动紧急切断阀；用气端设阻火器")
            if prop.code == "C2H2":
                reqs.append("乙炔: 必须装专用回火防止器，禁止直接使用瓶阀减压")
        if prop.corrosive:
            reqs.append("管路全部自动焊，最大限度减少卡套接头；设吹扫/放空管路")
        if prop.toxic:
            reqs.append("有毒气体: 气瓶置于连续排风气瓶柜，泄漏报警联动事故排风")
        if purity == "ultra_high_purity":
            reqs.append("超高纯系统: EP 级内表面 + VCR 接头 + 高纯氩吹扫置换")
        if not reqs:
            reqs.append("常规惰性气体: 卡套连接，无需特殊安全配置")
        return reqs

    # ------------------------------------------------------------------
    @staticmethod
    def _simultaneity(point_count: int) -> float:
        """同时使用系数分档: ≤5 点 0.8；≤10 点 0.6；>10 点 0.5。"""
        for limit, factor in GAS_SIMULTANEITY_TIERS:
            if point_count <= limit:
                return factor
        return GAS_SIMULTANEITY_DEFAULT
