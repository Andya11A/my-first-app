"""工艺规划模块入参/出参数据模型 (Pydantic)。

依据规范：
- JGJ 91-2019《科研建筑设计标准》
- GB 50346-2011《生物安全实验室建筑技术规范》
- GB 50881-2013《疾病预防控制中心建筑技术规范》
- GB 50189-2015《公共建筑节能设计标准》
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class LabType(str, Enum):
    """实验室类型。"""

    CHEMICAL = "chemical"       # 普通化学实验室
    BIOLOGICAL = "biological"   # 普通生物实验室
    PHYSICAL = "physical"       # 物理/精密仪器实验室
    CLEANROOM = "cleanroom"    # 洁净室
    BSL2 = "bsl2"              # 生物安全二级
    BSL3 = "bsl3"              # 生物安全三级
    ANIMAL = "animal"          # 动物房


class RoomFunction(str, Enum):
    """房间功能 —— 环境参数与设备清单的特殊查表键。"""

    GENERAL = "general"                          # 通用实验区
    PRECISION_BALANCE = "precision_balance"      # 高精度天平室
    ELECTRON_MICROSCOPE = "electron_microscope"  # 电镜室
    CULTURE_ROOM = "culture_room"                # 生物培养室


# ==================== 入参 ====================


class ProcessEquipment(BaseModel):
    """设备（用于面积估算的占地输入）。"""

    name: str = Field(..., description="设备名称")
    length_m: float = Field(1.0, gt=0, le=10, description="设备长 m")
    width_m: float = Field(0.8, gt=0, le=10, description="设备宽 m")
    count: int = Field(1, ge=1, le=200, description="数量")


class ProcessInput(BaseModel):
    """工艺规划入参。"""

    lab_type: LabType = Field(..., description="实验室类型")
    total_area: Optional[float] = Field(None, gt=0, le=5000, description="已知总面积 m²（功能分区用，无则按面积估算）")
    personnel_count: int = Field(2, ge=1, le=200, description="人员数量")
    room_function: RoomFunction = Field(RoomFunction.GENERAL, description="房间功能（特殊房间环境参数查表）")
    equipment: List[ProcessEquipment] = Field(default_factory=list, description="设备占地清单")


# ==================== 出参 ====================


class ZoneItem(BaseModel):
    """功能区。"""

    name: str
    area_m2: float = Field(..., description="该功能区面积 m²")
    ratio: float = Field(..., description="占比")


class ZoneResult(BaseModel):
    """功能分区结果。"""

    zones: List[ZoneItem]
    total_area_m2: float = Field(..., description="分区基准总面积 m²")
    layout_mode: str = Field(..., description="建议布局模式")
    regulation_reference: str


class AreaEstimate(BaseModel):
    """面积指标估算。"""

    per_person_area_m2: float = Field(..., description="人均使用面积 m²/人")
    personnel_area_m2: float = Field(..., description="人员使用面积 m²")
    equipment_area_m2: float = Field(..., description="设备占地（含操作间距）m²")
    channel_area_m2: float = Field(..., description="通道面积估算 m²")
    reserve_ratio: float = Field(..., description="预留比例")
    suggested_total_area_m2: float = Field(..., description="建议总面积 m²")
    zone_allocation: List[ZoneItem] = Field(..., description="建议总面积的分区分配")
    regulation_reference: str


class EnvRequirement(BaseModel):
    """环境参数需求。"""

    temp_summer_min_c: float = Field(..., description="夏季温度下限 ℃")
    temp_summer_max_c: float = Field(..., description="夏季温度上限 ℃")
    temp_winter_min_c: float = Field(..., description="冬季温度下限 ℃")
    temp_winter_max_c: float = Field(..., description="冬季温度上限 ℃")
    humidity_min_pct: Optional[float] = Field(None, description="湿度下限 %")
    humidity_max_pct: Optional[float] = Field(None, description="湿度上限 %")
    ach_min: Optional[float] = Field(None, description="换气次数下限 次/h")
    ach_max: Optional[float] = Field(None, description="换气次数上限 次/h")
    fresh_air_note: str = Field(..., description="新风量/换气说明")
    pressure_pa: Optional[float] = Field(None, description="目标压差 Pa")
    note: str
    regulation_reference: str


class EquipmentLoadItem(BaseModel):
    """推荐设备单项。"""

    name: str
    count: int
    heat_w: float = Field(..., description="单台散热量 W")
    power_kw: float = Field(..., description="单台用电功率 kW")
    water_l_h: float = Field(0.0, description="单台用水量 L/h")
    gas_l_min: float = Field(0.0, description="单台用气量 L/min")


class EquipmentLoadResult(BaseModel):
    """设备清单与负荷预估算。"""

    items: List[EquipmentLoadItem]
    total_heat_kw: float = Field(..., description="总散热量 kW（供暖通负荷）")
    total_power_kw: float = Field(..., description="总用电量 kW（供电气负荷）")
    total_water_l_h: float = Field(..., description="总用水量 L/h")
    total_gas_l_min: float = Field(..., description="总用气量 L/min")
    regulation_reference: str


class CirculationPlan(BaseModel):
    """人流物流动线规划。"""

    circulation_type: str = Field(..., description="动线类型")
    key_nodes: List[str] = Field(..., description="关键节点")
    regulation_reference: str


class ProcessResult(BaseModel):
    """工艺规划结果：分区 + 面积 + 环境 + 设备负荷 + 动线 + 规范引用 + 公式说明。"""

    zones: ZoneResult
    area: AreaEstimate
    env: EnvRequirement
    equipment_load: EquipmentLoadResult
    circulation: CirculationPlan
    regulation_references: List[str] = Field(..., description="计算依据规范编号清单")
    formula_explanations: List[str] = Field(..., description="关键计算步骤说明")
