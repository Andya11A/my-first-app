"""暖通模块入参/出参数据模型 (Pydantic)。"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class LabType(str, Enum):
    CHEMISTRY = "chemistry"   # 化学
    BIOLOGY = "biology"       # 生物
    PHYSICS = "physics"       # 物理/精密仪器
    GENERAL = "general"       # 通用辅助


class DeviceType(str, Enum):
    FUME_HOOD = "fume_hood"                  # 通风柜（面风速法）
    SNORKEL = "snorkel"                      # 万向排风罩（额定风量法）
    BSC = "biosafety_cabinet"                # II 级生物安全柜（额定风量法）
    GENERAL_EXHAUST = "general_exhaust"      # 全面排风风口（不参与局部排风）


class ExhaustTreatment(str, Enum):
    NONE = "none"
    ACTIVATED_CARBON = "activated_carbon"    # 活性炭吸附箱
    SCRUBBER = "scrubber"                    # 酸雾/水洗喷淋塔


# ==================== 入参 ====================


class ExhaustDevice(BaseModel):
    type: DeviceType = Field(DeviceType.FUME_HOOD, description="排风设备类型")
    count: int = Field(1, ge=1, le=200, description="数量（台）")
    face_velocity: float = Field(
        0.5, ge=0.3, le=0.8, description="通风柜操作面风速 m/s（规范推荐 0.4~0.6）"
    )
    sash_area: float = Field(
        0.6, ge=0.1, le=2.0, description="单台视窗开启面积 m²（1.5m 柜典型 0.6）"
    )
    rated_flow: Optional[float] = Field(
        None, ge=0, le=5000, description="单台额定排风量 m³/h；留空时万向罩/安全柜取类型默认值"
    )


class HvacInput(BaseModel):
    """暖通计算入参：房间几何 + 实验室类型 + 排风设备 + 设计参数。"""

    # 房间几何
    length_m: float = Field(..., gt=0, le=100, description="房间长 m")
    width_m: float = Field(..., gt=0, le=100, description="房间宽 m")
    height_m: float = Field(..., ge=2.4, le=10, description="房间净高 m")

    lab_type: LabType = Field(..., description="实验室类型（决定换气次数与防腐等级）")
    air_change_rate: Optional[float] = Field(
        None, ge=2, le=30, description="换气次数 次/h；留空按实验室类型推荐值"
    )

    devices: List[ExhaustDevice] = Field(default_factory=list, description="局部排风设备清单")

    # 负荷参数
    occupants: int = Field(2, ge=0, le=50, description="同时工作人员")
    equipment_power_kw: float = Field(0, ge=0, le=1000, description="室内设备总安装功率 kW")

    # 设计参数（室内外设计条件，可按项目所在地调整）
    supply_ratio: float = Field(0.85, ge=0.5, le=1.0, description="补风比（补风/排风）")
    summer_outdoor_temp_c: float = Field(35.0, description="夏季室外空调计算干球温度 ℃")
    winter_outdoor_temp_c: float = Field(-5.0, description="冬季室外空调计算干球温度 ℃")
    indoor_summer_temp_c: float = Field(24.0, ge=18, le=30, description="夏季室内设计温度 ℃")
    indoor_winter_temp_c: float = Field(20.0, ge=14, le=26, description="冬季室内设计温度 ℃")
    outdoor_enthalpy_kjkg: float = Field(85.0, description="夏季室外空气比焓 kJ/kg")
    indoor_enthalpy_kjkg: float = Field(47.0, description="夏季室内空气比焓 kJ/kg")

    # 风管/风机
    duct_length_m: float = Field(30, ge=1, le=500, description="最不利环路风管长度 m")
    exhaust_treatment: ExhaustTreatment = Field(ExhaustTreatment.NONE, description="排风净化方式")
    main_duct_velocity: float = Field(7.0, ge=3, le=12, description="主风管设计风速 m/s")
    branch_duct_velocity: float = Field(5.0, ge=2, le=10, description="支风管设计风速 m/s")


# ==================== 出参 ====================


class DeviceExhaustItem(BaseModel):
    type: DeviceType
    count: int
    unit_flow_m3h: float = Field(..., description="单台计算排风量 m³/h")
    total_flow_m3h: float = Field(..., description="该类设备合计排风量 m³/h")
    method: str = Field(..., description="计算方法：面风速法 / 额定风量法")


class ExhaustSummary(BaseModel):
    air_change_m3h: float = Field(..., description="换气次数法排风量 m³/h")
    local_exhaust_m3h: float = Field(..., description="局部排风设备合计 m³/h")
    total_m3h: float = Field(..., description="设计排风量 = max(局部, 换气) m³/h")
    controlling_method: str = Field(..., description="控制项：local_exhaust / air_change")


class CoolingLoad(BaseModel):
    envelope_kw: float = Field(..., description="围护结构冷负荷 kW")
    fresh_air_kw: float = Field(..., description="新风(补风)冷负荷 kW")
    equipment_kw: float = Field(..., description="设备冷负荷 kW（计同时系数）")
    lighting_kw: float = Field(..., description="照明冷负荷 kW")
    occupants_kw: float = Field(..., description="人员冷负荷 kW")
    total_kw: float = Field(..., description="总冷负荷 kW（含 1.1 安全系数）")


class HeatingLoad(BaseModel):
    envelope_kw: float = Field(..., description="围护结构热负荷 kW")
    fresh_air_kw: float = Field(..., description="新风(补风)热负荷 kW")
    total_kw: float = Field(..., description="总热负荷 kW（含 1.1 安全系数）")


class DuctDesign(BaseModel):
    label: str
    flow_m3h: float
    design_velocity_mps: float
    round_diameter_mm: float = Field(..., description="等效圆形风管直径 mm")
    rect_width_mm: int = Field(..., description="推荐矩形风管宽 mm（标准系列）")
    rect_height_mm: int = Field(..., description="推荐矩形风管高 mm（标准系列）")
    actual_velocity_mps: float = Field(..., description="选定尺寸下的实际风速 m/s")
    material: str = Field(..., description="按排气腐蚀性匹配的风管材质")


class FanSuggestion(BaseModel):
    label: str
    flow_m3h: float = Field(..., description="风机风量 m³/h（含 1.1 余量）")
    static_pressure_pa: float = Field(..., description="估算机外静压 Pa（比摩阻+附件阻力+余量）")
    material: str = Field(..., description="风机材质（防腐匹配）")


class HvacOutput(BaseModel):
    room_volume_m3: float
    used_air_change_rate: float = Field(..., description="实际采用的换气次数 次/h")
    devices: List[DeviceExhaustItem]
    exhaust: ExhaustSummary
    makeup_air_m3h: float = Field(..., description="设计补风量 m³/h")
    cooling: CoolingLoad
    heating: HeatingLoad
    main_duct: DuctDesign
    branch_duct: DuctDesign
    makeup_duct: DuctDesign
    exhaust_fan: FanSuggestion
    supply_fan: FanSuggestion


# ==================================================================
#  暖通计算模块 V2（冷热负荷/通风量/压差控制/废气处理/系统选型）
#  依据：
#    22K523《化学实验室通风系统设计与安装》—— 4种典型通风系统流程
#    GB 50736-2012《民用建筑供暖通风与空气调节设计规范》—— 暖通设计基础
#    GB 50189-2015《公共建筑节能设计标准》—— 节能强制要求
#    GB 50881-2013《疾病预防控制中心建筑技术规范》—— 实验室换气次数/温湿度
#    JGJ 91-2019《科研建筑设计标准》—— 科研建筑暖通参数
#    GB 50346-2011《生物安全实验室建筑技术规范》—— BSL压差梯度/HEPA
#    GB 50016-2014(2018版)《建筑设计防火规范》—— 防火阀/排烟
# ==================================================================


class HVACLabType(str, Enum):
    """实验室类型 —— 决定换气次数、压差梯度、废气处理工艺。"""

    CHEMICAL = "chemical"        # 化学实验室
    BIOLOGICAL = "biological"    # 生物实验室
    PHYSICAL = "physical"        # 物理实验室
    CLEANROOM = "cleanroom"     # 洁净室
    BSL2 = "bsl2"               # 生物安全二级实验室
    BSL3 = "bsl3"               # 生物安全三级实验室
    ANIMAL = "animal"           # 动物房


class HVACRoomFunction(str, Enum):
    """房间功能类型 —— 决定换气次数与室内设计参数（GB 50881 表7.4.1 / JGJ 91-2019 表8.1.3）。"""

    CHEMICAL_LAB = "chemical_lab"      # 化学实验室
    BIOLOGICAL_LAB = "biological_lab"  # 生物实验室
    PHYSICAL_LAB = "physical_lab"      # 物理实验室
    BALANCE_ROOM = "balance_room"      # 高精度天平室
    EM_ROOM = "em_room"                # 电镜室
    CULTURE_ROOM = "culture_room"      # 生物培养室
    CLEANROOM = "cleanroom"            # 洁净室


class ExhaustGasType(str, Enum):
    """废气类型 —— 决定处理工艺。"""

    ACID = "acid"                  # 酸性废气
    ORGANIC = "organic"           # 有机废气
    BIOLOGICAL = "biological"     # 生物废气
    MIXED = "mixed"               # 混合废气


class PressureControlMode(str, Enum):
    """压差控制方式。"""

    CAV = "cav"   # 定风量
    VAV = "vav"   # 变风量


# ==================== 入参 ====================


class HVACInput(BaseModel):
    """暖通计算 V2 入参：房间参数 + 设备散热 + 通风柜信息 + 压差需求。"""

    # 房间几何
    area: float = Field(..., gt=0, le=2000, description="房间面积 m²")
    height: float = Field(3.0, gt=0, le=10, description="房间层高 m")
    orientation: str = Field("south", description="朝向（south/north/east/west）")
    window_area: float = Field(0.0, ge=0, le=500, description="外窗面积 m²")
    wall_type: str = Field(
        "insulated_panel", description="外墙类型（insulated_panel/brick/concrete）"
    )

    # 负荷参数
    equipment_heat_load_w: float = Field(0.0, ge=0, le=200000, description="设备散热量 W")
    personnel_count: int = Field(2, ge=0, le=200, description="人员数量")
    lighting_power_w: float = Field(0.0, ge=0, le=50000, description="照明功率 W")

    # 通风参数
    lab_type: HVACLabType = Field(HVACLabType.CHEMICAL, description="实验室类型")
    room_function: HVACRoomFunction = Field(
        HVACRoomFunction.CHEMICAL_LAB, description="房间功能类型（换气次数查表键）"
    )
    fume_hood_count: int = Field(0, ge=0, le=50, description="通风柜数量")
    fume_hood_face_area: float = Field(
        0.6, gt=0, le=3.0, description="单台通风柜操作口面积 m²"
    )
    fume_hood_toxic: bool = Field(
        True, description="是否有毒操作（决定面风速 0.5/0.3 m/s）"
    )

    # 压差参数
    room_sequence: List[str] = Field(
        default_factory=lambda: ["走廊", "缓冲间", "核心实验区"],
        description="房间序列（压差梯度计算用）",
    )

    # 废气处理参数
    exhaust_gas_type: ExhaustGasType = Field(
        ExhaustGasType.ACID, description="废气类型"
    )
    exhaust_volume_override: Optional[float] = Field(
        None, ge=0, description="排风量 m³/h（留空按通风计算结果）"
    )

    # 室内外设计参数
    summer_outdoor_temp_c: float = Field(35.0, description="夏季室外计算温度 ℃")
    winter_outdoor_temp_c: float = Field(-5.0, description="冬季室外计算温度 ℃")
    indoor_summer_temp_c: float = Field(25.0, description="夏季室内设计温度 ℃")
    indoor_winter_temp_c: float = Field(20.0, description="冬季室内设计温度 ℃")
    outdoor_enthalpy_kjkg: float = Field(85.0, description="夏季室外空气比焓 kJ/kg")
    indoor_enthalpy_kjkg: float = Field(50.0, description="夏季室内空气比焓 kJ/kg")

    # 风管参数
    duct_length_m: float = Field(30.0, ge=0, le=500, description="最不利环路风管长度 m")


# ==================== 出参：五大功能子模型 ====================


class CoolingHeatingLoadDetail(BaseModel):
    """冷热负荷计算详情（单位：W）。引用 GB 50736-2012 / GB 50881-2013。"""

    wall_load_w: float = Field(..., description="外墙传热负荷 W")
    window_load_w: float = Field(..., description="外窗传热负荷 W")
    roof_load_w: float = Field(..., description="屋顶传热负荷 W")
    floor_load_w: float = Field(..., description="地面传热负荷 W")
    personnel_sensible_w: float = Field(..., description="人员显热负荷 W")
    personnel_latent_w: float = Field(..., description="人员潜热负荷 W")
    equipment_load_w: float = Field(..., description="设备散热量 W（直接计入）")
    lighting_load_w: float = Field(..., description="照明负荷 W")
    fresh_air_load_w: float = Field(..., description="新风焓差负荷 W")
    total_cooling_load_w: float = Field(..., description="总冷负荷 W（含 1.15 安全系数）")
    total_heating_load_w: float = Field(..., description="总热负荷 W（含 1.15 安全系数）")
    safety_factor: float = Field(..., description="安全系数")
    regulation_reference: str = Field(..., description="负荷计算依据规范")


class VentilationDetail(BaseModel):
    """通风量计算详情（单位：m³/h）。引用 GB 50881 / JGJ 91 / 22K523。"""

    general_ventilation_m3h: float = Field(..., description="全面通风量 m³/h（按换气次数）")
    local_exhaust_m3h: float = Field(..., description="局部排风量 m³/h（通风柜面风速法）")
    total_exhaust_m3h: float = Field(..., description="总排风量 = max(全面, 局部+补风) m³/h")
    fresh_air_m3h: float = Field(..., description="新风量 = max(人员新风, 补风量) m³/h")
    face_velocity_used_mps: float = Field(..., description="实际采用面风速 m/s")
    air_change_rate_used: float = Field(..., description="实际采用换气次数 次/h")
    recommended_system_type: str = Field(..., description="推荐通风系统类型（22K523 四种典型）")
    regulation_reference: str = Field(..., description="通风量计算依据规范")


class PressureControlRoomItem(BaseModel):
    """单房间压差控制项。"""

    room_name: str = Field(..., description="房间名称")
    target_pressure_pa: float = Field(..., description="目标压差 Pa（负压为负，正压为正）")
    supply_exhaust_diff_m3h: float = Field(..., description="维持压差所需送排风量差值 m³/h")


class PressureControlDetail(BaseModel):
    """压差控制计算详情。引用 GB 50346-2011。"""

    rooms: List[PressureControlRoomItem] = Field(..., description="各房间压差设定")
    recommended_control_mode: str = Field(..., description="推荐压差控制方式（定风量/变风量）")
    regulation_reference: str = Field(..., description="压差控制依据规范")


class ExhaustTreatmentDetail(BaseModel):
    """废气处理方案详情。引用 22K523 / GB 50346-2011。"""

    process_scheme: str = Field(..., description="处理工艺方案")
    equipment_recommendation: str = Field(..., description="设备选型建议")
    emission_requirements: str = Field(..., description="排放口位置要求")
    filtration_efficiency: Optional[str] = Field(None, description="过滤效率（HEPA）")
    regulation_reference: str = Field(..., description="废气处理依据规范")


class VentilationSystemDetail(BaseModel):
    """通风系统选型详情。引用 22K523 / GB 50881-2013。"""

    recommended_system_type: str = Field(..., description="推荐系统类型（CAV/VAV/独立排风/补风）")
    system_description: str = Field(..., description="系统类型说明")
    fan_flow_m3h: float = Field(..., description="风机风量 m³/h")
    fan_pressure_pa: float = Field(..., description="风机风压 Pa")
    fan_power_kw: float = Field(..., description="风机功率 kW")
    duct_diameter_mm: float = Field(..., description="风管管径估算 mm")
    regulation_reference: str = Field(..., description="系统选型依据规范")


class HVACResult(BaseModel):
    """暖通计算 V2 结果：负荷 + 通风量 + 压差 + 废气处理 + 系统选型 + 规范引用。"""

    load: CoolingHeatingLoadDetail
    ventilation: VentilationDetail
    pressure_control: PressureControlDetail
    exhaust_treatment: ExhaustTreatmentDetail
    ventilation_system: VentilationSystemDetail
    regulation_references: List[str] = Field(..., description="计算依据规范编号清单")
    formula_explanations: List[str] = Field(..., description="关键公式与计算步骤说明")
