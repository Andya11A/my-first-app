"""暖通空调计算模块 (HVAC Service)
====================================

专业职责：实验室通风（排风/补风）、冷热负荷估算、风管尺寸推荐与风机选型建议。

核心公式一览（单位标注）
------------------------
1)  房间体积          V = L × W × H                                    [m³]
2)  换气次数法排风    Q_换气 = n × V                                   [m³/h]    n: 换气次数 次/h
3)  通风柜面风速法    Q_柜 = v_面 × A_视窗 × 3600                      [m³/h]    v_面: 操作面风速 m/s (0.4~0.6)
4)  局部排风合计      Q_局部 = Σ(单台排风量 × 台数)                     [m³/h]
5)  设计排风量        Q_排 = max(Q_局部, Q_换气)
    —— 两条控制路径取大值：既保证通风柜开口面风速，又保证房间换气次数
6)  补风量            Q_补 = k × Q_排                                  [m³/h]    k: 0.8~0.9
    —— 补风故意小于排风 10%~20%，维持房间对邻室 5~10Pa 负压（防污染外逸）
7)  围护结构冷负荷    Q_围 = U × (F_墙 + F_顶) × Δt                    [kW]
    —— 简化保守：实验室多为无窗人工环境，外窗忽略；围护按六面体展开
8)  新风冷负荷        Q_新 = ρ × Q_补 × (h_外 − h_内) / 3600           [kW]
    —— ρ: 1.2 kg/m³；h: 空气比焓 kJ/kg；除以 3600 将 kJ/h 化为 kW
9)  设备冷负荷        Q_设 = P_安装 × η_同时                            [kW]    η_同时: 0.7
10) 人员冷负荷        Q_人 = 120 W/人 × 人数                            [kW]
11) 总冷负荷          Q_冷 = 1.1 × (Q_围 + Q_新 + Q_设 + Q_灯 + Q_人)
12) 热负荷(冬季)      Q_热 = 1.1 × [U·F·Δt_冬 + ρ·c_p·Q_补·Δt_冬/3600]
    —— 冬季不计设备/人员得热（保守）；c_p = 1.005 kJ/(kg·K)
13) 风管直径          D = √(4·Q / (3600·π·v))                         [m]
    —— 主风管 v = 6~8 m/s；支风管 v = 4~6 m/s（GB 50019 风管风速限值内）
14) 风机静压          P = (R·L + ΔP_附件) × 1.1                        [Pa]
    —— R: 比摩阻 ≈1 Pa/m；L: 最不利环路长度；附件: 活性炭 300Pa / 喷淋塔 500Pa
"""
from __future__ import annotations

import math
from typing import Tuple

from app.core.constants import (
    ACCESSORY_PRESSURE,
    AIR_CHANGE_RECOMMEND,
    AIR_CP,
    AIR_DENSITY,
    COOLING_SAFETY_FACTOR,
    DEVICE_DEFAULT_FLOW,
    DUCT_SIZE_SERIES,
    DUCT_SPECIFIC_FRICTION,
    ENCLOSURE_U_VALUE,
    EQUIPMENT_DIVERSITY,
    FAN_FLOW_MARGIN,
    FAN_PRESSURE_MARGIN,
    HEAT_PER_PERSON_W,
    HEATING_SAFETY_FACTOR,
    LIGHTING_W_PER_M2,
    SUPPLY_FILTER_PRESSURE,
    SUPPLY_RATIO_RANGE,
)
from app.schemas.hvac import (
    CoolingHeatingLoadDetail,
    DeviceExhaustItem,
    DeviceType,
    DuctDesign,
    ExhaustGasType,
    ExhaustSummary,
    ExhaustTreatmentDetail,
    FanSuggestion,
    HVACInput,
    HVACLabType,
    HVACResult,
    HVACRoomFunction,
    HvacInput,
    HvacOutput,
    LabType,
    PressureControlDetail,
    PressureControlRoomItem,
    VentilationDetail,
    VentilationSystemDetail,
)
from app.services.base import BaseCalculationService


def _select_rect_duct(flow_m3h: float, velocity_mps: float) -> Tuple[float, int, int, float]:
    """按目标风速选择标准矩形风管尺寸。

    步骤:
      1. 所需净截面积 A = Q / (3600 × v)                       [m²]
      2. 等效圆管直径 D = √(4A / π)                            [m → mm]
      3. 从标准系列中选"面积 ≥ 所需"的最小矩形（宽 ≥ 高，宽高比 ≤ 4，
         避免大开缝风管刚度不足与摩阻上升）
    返回: (等效圆管直径 mm, 宽 mm, 高 mm, 实际风速 m/s)
    """
    area_required = flow_m3h / 3600.0 / velocity_mps            # m²
    round_diameter = math.sqrt(4.0 * area_required / math.pi) * 1000.0  # mm

    best: Tuple[int, int, float] | None = None
    for w in DUCT_SIZE_SERIES:
        for h in DUCT_SIZE_SERIES:
            if h > w or w / h > 4.0:
                continue
            area = (w / 1000.0) * (h / 1000.0)
            if area + 1e-9 >= area_required and (best is None or area < best[2]):
                best = (w, h, area)
    if best is None:
        # 超出标准系列上限 → 建议土建风道/双风管，此处按 2000×N 非标尺寸兜底
        h_need = area_required / 2.0 * 1000.0
        best = (2000, int(math.ceil(h_need / 100.0) * 100), area_required)

    w, h, area = best
    actual_velocity = flow_m3h / 3600.0 / area
    return round_diameter, w, h, actual_velocity


class HvacService(BaseCalculationService[HvacInput, HvacOutput]):
    """暖通空调专业计算服务。"""

    module_name = "hvac"
    module_version = "1.0.0"
    references = [
        "GB 50019-2015 工业建筑供暖通风与空气调节设计规范",
        "GB 50243-2016 通风与空调工程施工质量验收规范",
        "GB 19489-2008 实验室 生物安全通用要求",
    ]

    # ------------------------------------------------------------------
    def _calculate(self, inp: HvacInput) -> HvacOutput:
        length, width, height = inp.length_m, inp.width_m, inp.height_m
        volume = length * width * height                 # 房间体积 V = L×W×H [m³]
        floor_area = length * width                      # [m²]

        # ============ 1) 排风量 ============
        # 换气次数：入参未给则取该类型实验室推荐值；低于规范下限则告警
        rec_min, rec_recommended = AIR_CHANGE_RECOMMEND[inp.lab_type.value]
        used_air_change = inp.air_change_rate if inp.air_change_rate else rec_recommended
        if inp.air_change_rate and inp.air_change_rate < rec_min:
            self.warn(
                "HVAC_W001",
                f"设定换气次数 {inp.air_change_rate} 次/h 低于"
                f"{inp.lab_type.value} 类实验室规范下限 {rec_min} 次/h",
                field="air_change_rate",
            )
        # 公式(2): Q_换气 = n × V
        air_change_flow = used_air_change * volume       # m³/h

        # 局部排风：逐台累加（公式 3/4）
        devices_detail: list[DeviceExhaustItem] = []
        local_total = 0.0
        max_unit_flow = 0.0   # 记录单台最大排风量 → 作为支风管设计流量
        for dev in inp.devices:
            if dev.type == DeviceType.FUME_HOOD:
                if not (0.4 <= dev.face_velocity <= 0.6):
                    self.warn(
                        "HVAC_W002",
                        f"通风柜面风速 {dev.face_velocity} m/s 建议控制在 0.4~0.6 m/s",
                        field="face_velocity",
                    )
                # 公式(3): Q_柜 = v_面 × A_视窗 × 3600
                unit_flow = dev.face_velocity * dev.sash_area * 3600.0
                method = "面风速法 v×A×3600"
            else:
                unit_flow = (
                    dev.rated_flow
                    if dev.rated_flow is not None
                    else DEVICE_DEFAULT_FLOW[dev.type.value]
                )
                method = "额定风量法"
            total_flow = unit_flow * dev.count
            local_total += total_flow
            if dev.type != DeviceType.GENERAL_EXHAUST:
                max_unit_flow = max(max_unit_flow, unit_flow)
            devices_detail.append(
                DeviceExhaustItem(
                    type=dev.type,
                    count=dev.count,
                    unit_flow_m3h=round(unit_flow, 1),
                    total_flow_m3h=round(total_flow, 1),
                    method=method,
                )
            )

        if not inp.devices:
            self.warn(
                "HVAC_W003",
                "未配置任何局部排风设备，排风量完全由换气次数控制",
                field="devices",
            )

        # 公式(5): 设计排风量取两条控制路径的大值
        total_exhaust = max(local_total, air_change_flow)
        controlling = "local_exhaust" if local_total >= air_change_flow else "air_change"
        if controlling == "air_change" and inp.lab_type == LabType.CHEMISTRY and inp.devices:
            self.warn(
                "HVAC_W004",
                "化学实验室排风由换气次数控制且小于通风柜满开排风量，"
                "请复核通风柜视窗管理工况（考虑部分开启系数）",
            )

        # ============ 2) 补风 ============
        if not (SUPPLY_RATIO_RANGE[0] <= inp.supply_ratio <= SUPPLY_RATIO_RANGE[1]):
            self.warn(
                "HVAC_W005",
                f"补风比 {inp.supply_ratio} 建议取 0.8~0.9：过低负压过大导致门难开启，"
                "过高易破坏负压梯度",
                field="supply_ratio",
            )
        # 公式(6): Q_补 = k × Q_排
        makeup_air = total_exhaust * inp.supply_ratio    # m³/h

        # ============ 3) 冷热负荷 ============
        # 围护展开面积（保守简化：外墙按周长×高 + 顶板，外窗忽略）
        envelope_area = 2.0 * (length + width) * height + floor_area   # m²

        # ---- 夏季冷负荷 ----
        dt_summer = max(inp.summer_outdoor_temp_c - inp.indoor_summer_temp_c, 0.0)  # ℃
        envelope_cool = ENCLOSURE_U_VALUE * envelope_area * dt_summer / 1000.0        # kW
        # 公式(8): 新风冷负荷 = ρ × Q_补 × Δh / 3600
        fresh_air_cool = (
            AIR_DENSITY * makeup_air * (inp.outdoor_enthalpy_kjkg - inp.indoor_enthalpy_kjkg) / 3600.0
        )
        fresh_air_cool = max(fresh_air_cool, 0.0)
        equipment_cool = inp.equipment_power_kw * EQUIPMENT_DIVERSITY                 # kW
        lighting_cool = LIGHTING_W_PER_M2 * floor_area / 1000.0                       # kW
        occupants_cool = HEAT_PER_PERSON_W * inp.occupants / 1000.0                   # kW
        cooling_total = COOLING_SAFETY_FACTOR * (
            envelope_cool + fresh_air_cool + equipment_cool + lighting_cool + occupants_cool
        )

        # ---- 冬季热负荷 ----
        dt_winter = max(inp.indoor_winter_temp_c - inp.winter_outdoor_temp_c, 0.0)    # ℃
        envelope_heat = ENCLOSURE_U_VALUE * envelope_area * dt_winter / 1000.0        # kW
        # 公式(12): 新风热负荷 = ρ · c_p · Q_补 · Δt / 3600
        fresh_air_heat = AIR_DENSITY * AIR_CP * makeup_air * dt_winter / 3600.0       # kW
        heating_total = HEATING_SAFETY_FACTOR * (envelope_heat + fresh_air_heat)

        # ============ 4) 风管与风机 ============
        # 化学实验室排气含腐蚀性介质 → 联动材料库匹配防腐风管/风机
        corrosive = inp.lab_type == LabType.CHEMISTRY
        duct_material = self.materials.duct_material(corrosive)
        fan_material = self.materials.fan_material(corrosive)

        main_duct = self._build_duct(
            "主风管(排风)", total_exhaust, inp.main_duct_velocity, duct_material
        )
        # 支风管按"单台最大排风设备"设计；无局部设备时按总排风 25% 估算
        branch_flow = max_unit_flow if max_unit_flow > 0 else total_exhaust * 0.25
        branch_duct = self._build_duct(
            "支风管(单台最不利)", branch_flow, inp.branch_duct_velocity, duct_material
        )
        makeup_duct = self._build_duct("补风管", makeup_air, inp.main_duct_velocity, duct_material)

        # 公式(14): 风机静压 = (比摩阻×管长 + 附件阻力) × 1.1 余量
        accessory_dp = ACCESSORY_PRESSURE[inp.exhaust_treatment.value]
        exhaust_fan = FanSuggestion(
            label="排风机",
            flow_m3h=round(total_exhaust * FAN_FLOW_MARGIN, 1),
            static_pressure_pa=round(
                (DUCT_SPECIFIC_FRICTION * inp.duct_length_m + accessory_dp) * FAN_PRESSURE_MARGIN
            ),
            material=fan_material,
        )
        supply_fan = FanSuggestion(
            label="补风机",
            flow_m3h=round(makeup_air * FAN_FLOW_MARGIN, 1),
            static_pressure_pa=round(
                (DUCT_SPECIFIC_FRICTION * inp.duct_length_m + SUPPLY_FILTER_PRESSURE)
                * FAN_PRESSURE_MARGIN
            ),
            material=fan_material,
        )

        # ============ 组装输出 ============
        return HvacOutput(
            room_volume_m3=round(volume, 2),
            used_air_change_rate=used_air_change,
            devices=devices_detail,
            exhaust=ExhaustSummary(
                air_change_m3h=round(air_change_flow, 1),
                local_exhaust_m3h=round(local_total, 1),
                total_m3h=round(total_exhaust, 1),
                controlling_method=controlling,
            ),
            makeup_air_m3h=round(makeup_air, 1),
            cooling={
                "envelope_kw": round(envelope_cool, 2),
                "fresh_air_kw": round(fresh_air_cool, 2),
                "equipment_kw": round(equipment_cool, 2),
                "lighting_kw": round(lighting_cool, 2),
                "occupants_kw": round(occupants_cool, 2),
                "total_kw": round(cooling_total, 2),
            },
            heating={
                "envelope_kw": round(envelope_heat, 2),
                "fresh_air_kw": round(fresh_air_heat, 2),
                "total_kw": round(heating_total, 2),
            },
            main_duct=main_duct,
            branch_duct=branch_duct,
            makeup_duct=makeup_duct,
            exhaust_fan=exhaust_fan,
            supply_fan=supply_fan,
        )

    # ------------------------------------------------------------------
    def _build_duct(self, label: str, flow_m3h: float, velocity: float, material: str) -> DuctDesign:
        """风管选型封装：等效圆管直径 + 标准矩形尺寸 + 实际风速校核。"""
        round_d, w, h, actual_v = _select_rect_duct(flow_m3h, velocity)
        return DuctDesign(
            label=label,
            flow_m3h=round(flow_m3h, 1),
            design_velocity_mps=velocity,
            round_diameter_mm=round(round_d, 1),
            rect_width_mm=w,
            rect_height_mm=h,
            actual_velocity_mps=round(actual_v, 2),
            material=material,
        )


# ==================================================================
#  HVAC V2 模块 —— 冷热负荷 / 通风量 / 压差控制 / 废气处理 / 系统选型
#  ------------------------------------------------------------------
#  本区块为按实验室类型驱动的工程简化算法，所有预设参数集中在常量区，
#  便于按规范版本统一升级校准。每个计算步骤注释中均标注具体规范条款。
#  依据：
#    22K523《化学实验室通风系统设计与安装》—— 4种典型通风系统流程/排风柜
#    GB 50736-2012《民用建筑供暖通风与空气调节设计规范》—— 暖通设计基础
#    GB 50189-2015《公共建筑节能设计标准》—— 节能强制要求
#    GB 50881-2013《疾病预防控制中心建筑技术规范》—— 换气次数/温湿度
#    JGJ 91-2019《科研建筑设计标准》—— 科研建筑暖通参数
#    GB 50346-2011《生物安全实验室建筑技术规范》—— BSL压差梯度/HEPA
#    GB 50016-2014(2018版)《建筑设计防火规范》—— 防火阀/排烟
# ==================================================================


# ---------- 预设参数常量区 ----------

# 围护结构传热系数 U 值 W/(m²·K)，依据 GB 50736-2012 第 5.2 节围护结构热工
HVAC_WALL_U_VALUE: dict[str, float] = {
    "insulated_panel": 0.5,   # 彩钢夹芯板（实验室常用）
    "brick": 1.5,              # 砖墙
    "concrete": 2.0,          # 混凝土
}
HVAC_WINDOW_U_VALUE = 2.8      # 单层玻璃外窗 W/(m²·K)
HVAC_ROOF_U_VALUE = 0.5        # 屋顶传热系数
HVAC_FLOOR_U_VALUE = 0.3       # 地面传热系数

# 人员散热指标 W/人，依据 GB 50736-2012 人员显热/潜热（轻度劳动）
HVAC_PERSON_SENSIBLE_W = 108.0   # 人员显热
HVAC_PERSON_LATENT_W = 70.0      # 人员潜热

# 负荷安全系数（各项之和 × 1.15）
HVAC_LOAD_SAFETY_FACTOR = 1.15

# 换气次数预设 次/h，依据 GB 50881-2013 表7.4.1 / JGJ 91-2019 表8.1.3
HVAC_ACH_TABLE: dict[str, float] = {
    "chemical_lab": 8.0,       # 化学实验室 6-8
    "biological_lab": 10.0,    # 生物实验室（按风量平衡）
    "physical_lab": 4.0,        # 物理实验室 3-4
    "balance_room": 40.0,       # 高精度天平室
    "em_room": 50.0,             # 电镜室
    "culture_room": 50.0,        # 生物培养室
    "cleanroom": 25.0,           # 洁净室
}

# 通风柜操作面风速 m/s，依据 22K523
HVAC_FACE_VELOCITY_TOXIC = 0.5      # 有毒操作
HVAC_FACE_VELOCITY_NONTOXIC = 0.3   # 无毒操作

# 人员新风量 m³/(h·人)，依据 GB 50736-2012
HVAC_FRESH_AIR_PER_PERSON = 30.0

# 补风比（补风量/排风量，补风小于排风维持房间负压）
HVAC_MAKEUP_RATIO = 0.85

# 压差梯度 Pa，依据 GB 50346-2011 第 5.2 条 / GB 50333-2013
# 格式: {lab_type: {room_name_keyword: target_pressure_pa}}
HVAC_PRESSURE_GRADIENT: dict[str, dict[str, float]] = {
    "bsl2": {"走廊": 0.0, "缓冲": -10.0, "核心": -20.0, "工作": -20.0},
    "bsl3": {"走廊": 0.0, "缓冲": -20.0, "核心": -40.0, "工作": -40.0},
    "cleanroom": {"走廊": 0.0, "缓冲": 10.0, "核心": 15.0, "洁净": 15.0, "操作": 15.0},
    "chemical": {"走廊": 0.0, "核心": -5.0, "实验": -5.0},
    "biological": {"走廊": 0.0, "核心": -10.0, "实验": -10.0},
}
HVAC_CLEANROOM_STEP = 5.0   # 洁净室相邻房间正压梯度 ≥5Pa（GB 50333-2013）

# 缝隙渗漏系数（维持压差所需送排风量差值估算）
HVAC_LEAK_COEFF = 0.827                 # 缝隙渗漏量幂定律系数
HVAC_CRACK_AREA_PER_M2 = 0.003          # 每m²房间估算有效缝隙面积 m²/m²

# 物理常数
HVAC_AIR_DENSITY = 1.2                  # 空气密度 kg/m³
HVAC_AIR_CP = 1.005                     # 空气定压比热 kJ/(kg·K)

# 风机/风管参数
HVAC_FAN_EFFICIENCY = 0.6               # 风机全压效率
HVAC_FAN_FLOW_MARGIN = 1.1              # 风量余量
HVAC_FAN_PRESSURE_MARGIN = 1.1         # 风压余量
HVAC_DUCT_FRICTION = 1.0               # 风管比摩阻 Pa/m
HVAC_DUCT_VELOCITY = 7.0               # 主风管设计风速 m/s
HVAC_ACCESSORY_PRESSURE: dict[str, float] = {
    "acid": 500.0,        # 喷淋塔阻力 Pa
    "organic": 300.0,     # 活性炭吸附箱阻力 Pa
    "biological": 250.0,  # HEPA 高效过滤器阻力 Pa
    "mixed": 1000.0,      # 多级串联处理阻力 Pa
}

# HEPA 过滤效率（生物废气），依据 GB 50346-2011
HVAC_HEPA_EFFICIENCY = "≥99.97%@0.3μm"


def _lab_type_key(lab_type) -> str:
    """归一化实验室类型入参为字典键字符串。"""
    return lab_type.value if isinstance(lab_type, HVACLabType) else str(lab_type)


def _room_function_key(room_function) -> str:
    """归一化房间功能入参为字典键字符串。"""
    return (
        room_function.value
        if isinstance(room_function, HVACRoomFunction)
        else str(room_function)
    )


def _gas_type_key(gas_type) -> str:
    """归一化废气类型入参为字典键字符串。"""
    return gas_type.value if isinstance(gas_type, ExhaustGasType) else str(gas_type)


# ==================================================================
#  核心功能 1：冷热负荷计算
#  ------------------------------------------------------------------
#  依据 GB 50736-2012 围护结构传热 / 人员散热，GB 50881-2013 第 7.4.5 条
#  设备发热量计入空调负荷。总负荷 = 各项之和 × 安全系数 1.15。
# ==================================================================
def calculate_cooling_heating_load(
    area: float,
    height: float,
    window_area: float,
    wall_type: str,
    equipment_heat_load_w: float,
    personnel_count: int,
    lighting_power_w: float,
    summer_outdoor_temp_c: float,
    winter_outdoor_temp_c: float,
    indoor_summer_temp_c: float,
    indoor_winter_temp_c: float,
    outdoor_enthalpy_kjkg: float,
    indoor_enthalpy_kjkg: float,
    air_change_rate: float,
    volume: float,
) -> CoolingHeatingLoadDetail:
    """冷热负荷计算 —— 输出总冷/热负荷 (W) 及各项分项明细。

    围护结构：外墙/外窗/屋顶/地面传热（GB 50736-2012 第 5.2.3 条）
    人员：显热 + 潜热（GB 50736-2012 人员散热指标）
    设备：直接取输入散热量（GB 50881-2013 第 7.4.5 条）
    新风：按换气次数计算新风量，再计算焓差负荷
    """
    # 围护面积估算（方形近似：边长 = √area，周长 = 4×边长）
    side = math.sqrt(area)
    wall_area = max(4.0 * side * height - window_area, 0.0)  # 外墙净面积 m²
    roof_area = area
    floor_area = area

    u_wall = HVAC_WALL_U_VALUE.get(wall_type, 0.5)

    # ---- 夏季冷负荷 ----
    dt_summer = max(summer_outdoor_temp_c - indoor_summer_temp_c, 0.0)  # ℃
    # 外墙传热 Q = U × F × ΔT（GB 50736-2012 第 5.2.3 条）
    wall_load_w = u_wall * wall_area * dt_summer
    window_load_w = HVAC_WINDOW_U_VALUE * window_area * dt_summer
    roof_load_w = HVAC_ROOF_U_VALUE * roof_area * dt_summer
    floor_load_w = HVAC_FLOOR_U_VALUE * floor_area * dt_summer

    # 人员负荷：显热 + 潜热（GB 50736-2012 人员散热指标）
    personnel_sensible_w = personnel_count * HVAC_PERSON_SENSIBLE_W
    personnel_latent_w = personnel_count * HVAC_PERSON_LATENT_W

    # 设备负荷：直接计入（GB 50881-2013 第 7.4.5 条：设备发热量应计入空调负荷）
    equipment_load_w = equipment_heat_load_w
    lighting_load_w = lighting_power_w

    # 新风负荷（焓差法）：Q = ρ × V_新 × (h外 − h内) / 3.6 [W]
    # V_新 = 换气次数 × 房间体积；实验室通常 100% 新风
    fresh_air_volume = air_change_rate * volume  # m³/h
    fresh_air_load_w = (
        HVAC_AIR_DENSITY
        * fresh_air_volume
        * (outdoor_enthalpy_kjkg - indoor_enthalpy_kjkg)
        / 3.6
    )
    fresh_air_load_w = max(fresh_air_load_w, 0.0)

    # 总冷负荷 = 各项之和 × 1.15 安全系数
    total_cooling_w = (
        wall_load_w
        + window_load_w
        + roof_load_w
        + floor_load_w
        + personnel_sensible_w
        + personnel_latent_w
        + equipment_load_w
        + lighting_load_w
        + fresh_air_load_w
    ) * HVAC_LOAD_SAFETY_FACTOR

    # ---- 冬季热负荷（保守：不计设备/人员/照明得热）----
    dt_winter = max(indoor_winter_temp_c - winter_outdoor_temp_c, 0.0)  # ℃
    heat_wall = u_wall * wall_area * dt_winter
    heat_window = HVAC_WINDOW_U_VALUE * window_area * dt_winter
    heat_roof = HVAC_ROOF_U_VALUE * roof_area * dt_winter
    heat_floor = HVAC_FLOOR_U_VALUE * floor_area * dt_winter
    # 新风热负荷：Q = ρ × V × cp × ΔT / 3.6 [W]，cp = 1.005 kJ/(kg·K)
    fresh_air_heat = HVAC_AIR_DENSITY * fresh_air_volume * HVAC_AIR_CP * dt_winter / 3.6
    total_heating_w = (
        heat_wall + heat_window + heat_roof + heat_floor + fresh_air_heat
    ) * HVAC_LOAD_SAFETY_FACTOR

    return CoolingHeatingLoadDetail(
        wall_load_w=round(wall_load_w, 1),
        window_load_w=round(window_load_w, 1),
        roof_load_w=round(roof_load_w, 1),
        floor_load_w=round(floor_load_w, 1),
        personnel_sensible_w=round(personnel_sensible_w, 1),
        personnel_latent_w=round(personnel_latent_w, 1),
        equipment_load_w=round(equipment_load_w, 1),
        lighting_load_w=round(lighting_load_w, 1),
        fresh_air_load_w=round(fresh_air_load_w, 1),
        total_cooling_load_w=round(total_cooling_w, 1),
        total_heating_load_w=round(total_heating_w, 1),
        safety_factor=HVAC_LOAD_SAFETY_FACTOR,
        regulation_reference=(
            "GB 50736-2012 第 5.2.3 条（围护结构传热）/ 人员散热指标 / "
            "GB 50881-2013 第 7.4.5 条（设备发热量计入空调负荷）"
        ),
    )


# ==================================================================
#  核心功能 2：通风量计算
#  ------------------------------------------------------------------
#  全面通风量按换气次数（GB 50881 表7.4.1 / JGJ 91-2019 表8.1.3）
#  局部排风量按通风柜面风速法（22K523：有毒 0.5m/s / 无毒 0.3m/s）
#  总排风量 = max(全面通风量, 局部排风量 + 补风量)
#  新风量 = max(人员新风需求, 补风量)
# ==================================================================
def calculate_ventilation(
    room_function,
    area: float,
    height: float,
    fume_hood_count: int,
    fume_hood_face_area: float,
    fume_hood_toxic: bool,
    personnel_count: int,
) -> VentilationDetail:
    """通风量计算 —— 输出全面/局部/总排风量、新风量及推荐系统类型。"""
    volume = area * height  # m³
    key = _room_function_key(room_function)
    ach = HVAC_ACH_TABLE[key]

    # 全面通风量：Q_全 = n × V（GB 50881 表7.4.1 / JGJ 91-2019 表8.1.3）
    general_ventilation = ach * volume  # m³/h

    # 局部排风量：Q_柜 = v_面 × A_操作口 × 3600 × 台数（22K523）
    face_v = HVAC_FACE_VELOCITY_TOXIC if fume_hood_toxic else HVAC_FACE_VELOCITY_NONTOXIC
    local_exhaust_per_hood = face_v * fume_hood_face_area * 3600.0  # m³/h
    local_exhaust = local_exhaust_per_hood * fume_hood_count  # m³/h

    # 补风量 = 局部排风量 × 补风比（补风小于排风维持负压）
    makeup_air = local_exhaust * HVAC_MAKEUP_RATIO  # m³/h

    # 总排风量 = max(全面通风量, 局部排风量 + 补风量)
    total_exhaust = max(general_ventilation, local_exhaust + makeup_air)

    # 新风量 = max(人员新风需求, 补风量)（GB 50736-2012 人员新风量）
    personnel_fresh = personnel_count * HVAC_FRESH_AIR_PER_PERSON
    fresh_air = max(personnel_fresh, makeup_air)

    # 推荐通风系统类型（22K523 四种典型系统）
    if fume_hood_count == 0:
        sys_type = "系统类型4：补风系统 —— 无局部排风，按全面通风配置机械补风"
    elif fume_hood_count <= 2:
        sys_type = "系统类型1：定风量系统（CAV）—— 通风柜少、使用稳定"
    else:
        sys_type = "系统类型2：变风量系统（VAV）—— 通风柜多、使用频率变化大"

    return VentilationDetail(
        general_ventilation_m3h=round(general_ventilation, 1),
        local_exhaust_m3h=round(local_exhaust, 1),
        total_exhaust_m3h=round(total_exhaust, 1),
        fresh_air_m3h=round(fresh_air, 1),
        face_velocity_used_mps=face_v,
        air_change_rate_used=ach,
        recommended_system_type=sys_type,
        regulation_reference=(
            "GB 50881-2013 表7.4.1 / JGJ 91-2019 表8.1.3（换气次数）/ "
            "22K523（通风柜面风速 0.5/0.3 m/s 及四种典型通风系统）"
        ),
    )


# ==================================================================
#  核心功能 3：压差控制计算
#  ------------------------------------------------------------------
#  依据 GB 50346-2011：
#    BSL-2：核心 -20Pa / 缓冲 -10Pa / 走廊 0Pa
#    BSL-3：核心 -40Pa / 缓冲 -20Pa / 走廊 0Pa
#  洁净室：正压梯度，相邻房间 ≥5Pa（GB 50333-2013）
#  化学实验室：相对走廊 -5Pa（微负压）
# ==================================================================
def calculate_pressure_control(
    lab_type,
    room_sequence: list[str],
    area: float,
) -> PressureControlDetail:
    """压差控制计算 —— 输出各房间设定压差、送排风量差值及控制方式。"""
    key = _lab_type_key(lab_type)
    gradient = HVAC_PRESSURE_GRADIENT.get(key, {})

    rooms: list[PressureControlRoomItem] = []
    # 缝隙有效面积估算：A_eff = 房间面积 × 系数
    a_effective = area * HVAC_CRACK_AREA_PER_M2

    for name in room_sequence:
        # 按房间名关键词匹配压差目标
        target_dp = 0.0
        matched = False
        for kw, pa in gradient.items():
            if kw in name:
                target_dp = pa
                matched = True
                break

        # 洁净室无显式匹配时按正压梯度递增（相邻 ≥5Pa，GB 50333-2013）
        if key == "cleanroom" and not matched:
            target_dp = (len(rooms) + 1) * HVAC_CLEANROOM_STEP

        # 维持压差所需送排风量差值（缝隙渗漏量）
        # L_leak = 0.827 × A_eff × |ΔP|^0.5 × 3600 [m³/h]
        leak_m3h = HVAC_LEAK_COEFF * a_effective * (abs(target_dp) ** 0.5) * 3600.0
        # 正压房间送风>排风，负压房间排风>送风（差值绝对量同 leak）
        diff_m3h = leak_m3h

        rooms.append(
            PressureControlRoomItem(
                room_name=name,
                target_pressure_pa=target_dp,
                supply_exhaust_diff_m3h=round(diff_m3h, 1),
            )
        )

    # 推荐压差控制方式：BSL-2/3 用变风量精确控压，洁净室/化学可用定风量
    if key in ("bsl2", "bsl3"):
        mode = "变风量（VAV）—— BSL 实验室需精确维持压差梯度，推荐 VAV + 定风量旁通"
    elif key == "cleanroom":
        mode = "定风量（CAV）—— 洁净室压差稳定，定风量即可满足 ≥5Pa 梯度"
    else:
        mode = "定风量（CAV）—— 微负压维持，定风量系统经济可靠"

    return PressureControlDetail(
        rooms=rooms,
        recommended_control_mode=mode,
        regulation_reference=(
            "GB 50346-2011 第 5.2 条（BSL 压差梯度）/ "
            "GB 50333-2013（洁净室正压 ≥5Pa）"
        ),
    )


# ==================================================================
#  核心功能 4：废气处理方案
#  ------------------------------------------------------------------
#  依据 22K523 / GB 50346-2011：
#    酸性废气 → 喷淋塔中和处理
#    有机废气 → 活性炭吸附 + 催化燃烧
#    生物废气 → HEPA 高效过滤器（≥99.97%@0.3μm）
#    混合废气 → 多级串联处理
#  排放要求：排风口距楼顶 ≥3m，远离新风取风口（水平距离 ≥10m）
# ==================================================================
def calculate_exhaust_treatment(
    lab_type,
    exhaust_gas_type,
    exhaust_volume: float,
) -> ExhaustTreatmentDetail:
    """废气处理方案 —— 输出处理工艺、设备选型及排放口位置要求。"""
    gkey = _gas_type_key(exhaust_gas_type)

    if gkey == "acid":
        process = "酸性废气 → 喷淋塔中和处理（碱液喷淋吸收酸性气溶胶）"
        equipment = "PP/FRP 喷淋塔 + 循环泵 + pH 在线监测；空塔流速 0.8~1.2 m/s"
        filtration = None
    elif gkey == "organic":
        process = "有机废气 → 活性炭吸附 + 催化燃烧（高浓度废气深度处理）"
        equipment = "活性炭吸附箱（蜂窝活性炭）+ 催化燃烧装置（CO）；吸附效率 ≥90%"
        filtration = None
    elif gkey == "biological":
        process = "生物废气 → HEPA 高效过滤器过滤（气溶胶拦截）"
        equipment = "HEPA 高效过滤箱（H13/H14 级）+ 排风消毒段"
        filtration = HVAC_HEPA_EFFICIENCY
    else:  # mixed
        process = "混合废气 → 多级串联处理（喷淋 + 活性炭 + HEPA）"
        equipment = "喷淋塔 → 活性炭吸附箱 → HEPA 过滤箱 串联配置"
        filtration = HVAC_HEPA_EFFICIENCY

    # 排放口位置要求（GB 50016 防火 + 22K523 排放要求）
    emission = (
        "排风口距楼顶 ≥3m，远离新风取风口（水平距离 ≥10m）；"
        "排风主管设防火阀（70℃关闭，GB 50016-2014）"
    )

    return ExhaustTreatmentDetail(
        process_scheme=process,
        equipment_recommendation=equipment,
        emission_requirements=emission,
        filtration_efficiency=filtration,
        regulation_reference=(
            "22K523《化学实验室通风系统设计与安装》/ "
            "GB 50346-2011（HEPA 过滤）/ GB 50016-2014（防火阀）"
        ),
    )


# ==================================================================
#  核心功能 5：通风系统选型
#  ------------------------------------------------------------------
#  依据 22K523 四种典型系统：
#    系统类型1 CAV 定风量 —— 通风柜少、使用稳定
#    系统类型2 VAV 变风量 —— 通风柜多、频率变化大
#    系统类型3 独立排风 —— 不同污染类型分别处理（GB 50881 第 7.4.4 条）
#    系统类型4 补风系统 —— 排风量大于新风量时设机械补风
# ==================================================================
def select_ventilation_system(
    lab_type,
    fume_hood_count: int,
    total_exhaust_volume: float,
    fresh_air_volume: float,
    exhaust_gas_type,
    duct_length_m: float,
) -> VentilationSystemDetail:
    """通风系统选型 —— 输出推荐系统类型、风机参数及风管管径估算。"""
    lkey = _lab_type_key(lab_type)
    gkey = _gas_type_key(exhaust_gas_type)

    # 系统类型判定
    needs_separate = gkey == "mixed" or lkey in ("bsl2", "bsl3", "cleanroom")
    needs_makeup = total_exhaust_volume > fresh_air_volume

    if needs_separate:
        sys_type = "系统类型3：独立排风系统"
        sys_desc = (
            "不同污染类型需分别处理或 BSL/洁净室要求独立排风，"
            "设独立排风主管（GB 50881-2013 第 7.4.4 条）"
        )
    elif needs_makeup and fume_hood_count == 0:
        sys_type = "系统类型4：补风系统"
        sys_desc = "排风量大于新风量，设机械补风系统维持房间压力"
    elif fume_hood_count <= 2:
        sys_type = "系统类型1：定风量系统（CAV）"
        sys_desc = "通风柜数量少、使用稳定，采用定风量系统经济可靠"
    else:
        sys_type = "系统类型2：变风量系统（VAV）"
        sys_desc = "通风柜数量多、使用频率变化大，采用 VAV 节能且控压精确"

    # 风机选型参数
    fan_flow = total_exhaust_volume * HVAC_FAN_FLOW_MARGIN  # m³/h
    accessory_dp = HVAC_ACCESSORY_PRESSURE.get(gkey, 0.0)
    # 风机静压 = (比摩阻 × 管长 + 附件阻力) × 余量
    fan_pressure = (HVAC_DUCT_FRICTION * duct_length_m + accessory_dp) * HVAC_FAN_PRESSURE_MARGIN
    # 风机功率 P = Q × ΔP / (3600 × η) [W] → /1000 [kW]
    fan_power = fan_flow * fan_pressure / (3600.0 * HVAC_FAN_EFFICIENCY) / 1000.0

    # 风管管径估算：D = √(4 × Q / (3600 × π × v)) × 1000 [mm]
    duct_diameter = math.sqrt(
        4.0 * total_exhaust_volume / (3600.0 * math.pi * HVAC_DUCT_VELOCITY)
    ) * 1000.0

    return VentilationSystemDetail(
        recommended_system_type=sys_type,
        system_description=sys_desc,
        fan_flow_m3h=round(fan_flow, 1),
        fan_pressure_pa=round(fan_pressure, 1),
        fan_power_kw=round(fan_power, 3),
        duct_diameter_mm=round(duct_diameter, 1),
        regulation_reference=(
            "22K523《化学实验室通风系统设计与安装》（四种典型通风系统）/ "
            "GB 50881-2013 第 7.4.4 条（独立排风）"
        ),
    )


# ---------- 编排函数：组合五大功能 + 规范引用 + 公式说明 ----------
HVAC_REGULATION_REFERENCES = [
    "22K523《化学实验室通风系统设计与安装》",
    "GB 50736-2012《民用建筑供暖通风与空气调节设计规范》",
    "GB 50189-2015《公共建筑节能设计标准》",
    "GB 50881-2013《疾病预防控制中心建筑技术规范》",
    "JGJ 91-2019《科研建筑设计标准》",
    "GB 50346-2011《生物安全实验室建筑技术规范》",
    "GB 50016-2014(2018版)《建筑设计防火规范》",
]

HVAC_FORMULA_EXPLANATIONS = [
    "Q_围护 = U × F × ΔT（外墙/外窗/屋顶/地面传热，GB 50736-2012 第 5.2.3 条）",
    "Q_人员 = 人数 × (108W 显热 + 70W 潜热)（GB 50736-2012 人员散热指标）",
    "Q_设备 = 设备散热量（GB 50881-2013 第 7.4.5 条，直接计入空调负荷）",
    "Q_新风 = ρ × V_新 × (h外 − h内) / 3.6（焓差法，V_新 = 换气次数 × 体积）",
    "Q_总 = (Σ各项) × 1.15 安全系数",
    "Q_全面 = n × V（换气次数法，GB 50881 表7.4.1 / JGJ 91 表8.1.3）",
    "Q_柜 = v_面 × A × 3600（面风速法，22K523：有毒 0.5/无毒 0.3 m/s）",
    "Q_总排 = max(Q_全面, Q_局部 + 补风量)",
    "Q_新风 = max(人员新风 30 m³/h·人, 补风量)",
    "BSL-2 压差：核心 -20Pa / 缓冲 -10Pa / 走廊 0Pa（GB 50346-2011）",
    "BSL-3 压差：核心 -40Pa / 缓冲 -20Pa / 走廊 0Pa（GB 50346-2011）",
    "洁净室相邻房间压差 ≥5Pa（GB 50333-2013）",
    "L_leak = 0.827 × A_eff × |ΔP|^0.5 × 3600（缝隙渗漏量，维持压差送排风差值）",
    "P_风机 = (R × L + ΔP_附件) × 1.1（风机静压，附件：喷淋 500/活性炭 300/HEPA 250 Pa）",
    "N_风机 = Q × ΔP / (3600 × η) / 1000 [kW]（风机功率，η=0.6）",
    "D_风管 = √(4 × Q / (3600 × π × v)) × 1000 [mm]（风管管径，v=7 m/s）",
]


def calculate_hvac(inp: HVACInput) -> HVACResult:
    """暖通计算 V2 主入口：负荷 → 通风量 → 压差控制 → 废气处理 → 系统选型。

    五大功能按实验室类型驱动，所有预设参数集中在常量区。
    """
    volume = inp.area * inp.height  # 房间体积 m³
    ach = HVAC_ACH_TABLE[_room_function_key(inp.room_function)]

    # 1) 冷热负荷计算
    load = calculate_cooling_heating_load(
        area=inp.area,
        height=inp.height,
        window_area=inp.window_area,
        wall_type=inp.wall_type,
        equipment_heat_load_w=inp.equipment_heat_load_w,
        personnel_count=inp.personnel_count,
        lighting_power_w=inp.lighting_power_w,
        summer_outdoor_temp_c=inp.summer_outdoor_temp_c,
        winter_outdoor_temp_c=inp.winter_outdoor_temp_c,
        indoor_summer_temp_c=inp.indoor_summer_temp_c,
        indoor_winter_temp_c=inp.indoor_winter_temp_c,
        outdoor_enthalpy_kjkg=inp.outdoor_enthalpy_kjkg,
        indoor_enthalpy_kjkg=inp.indoor_enthalpy_kjkg,
        air_change_rate=ach,
        volume=volume,
    )

    # 2) 通风量计算
    ventilation = calculate_ventilation(
        room_function=inp.room_function,
        area=inp.area,
        height=inp.height,
        fume_hood_count=inp.fume_hood_count,
        fume_hood_face_area=inp.fume_hood_face_area,
        fume_hood_toxic=inp.fume_hood_toxic,
        personnel_count=inp.personnel_count,
    )

    # 3) 压差控制计算
    pressure_control = calculate_pressure_control(
        lab_type=inp.lab_type,
        room_sequence=inp.room_sequence,
        area=inp.area,
    )

    # 4) 废气处理方案（排风量优先用入参覆盖，否则取通风计算结果）
    exhaust_volume = (
        inp.exhaust_volume_override
        if inp.exhaust_volume_override is not None
        else ventilation.total_exhaust_m3h
    )
    exhaust_treatment = calculate_exhaust_treatment(
        lab_type=inp.lab_type,
        exhaust_gas_type=inp.exhaust_gas_type,
        exhaust_volume=exhaust_volume,
    )

    # 5) 通风系统选型
    ventilation_system = select_ventilation_system(
        lab_type=inp.lab_type,
        fume_hood_count=inp.fume_hood_count,
        total_exhaust_volume=exhaust_volume,
        fresh_air_volume=ventilation.fresh_air_m3h,
        exhaust_gas_type=inp.exhaust_gas_type,
        duct_length_m=inp.duct_length_m,
    )

    return HVACResult(
        load=load,
        ventilation=ventilation,
        pressure_control=pressure_control,
        exhaust_treatment=exhaust_treatment,
        ventilation_system=ventilation_system,
        regulation_references=HVAC_REGULATION_REFERENCES,
        formula_explanations=HVAC_FORMULA_EXPLANATIONS,
    )
