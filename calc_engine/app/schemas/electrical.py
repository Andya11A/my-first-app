"""电气计算模块入参/出参数据模型 (Pydantic)。

依据规范：
- GB 50052-2009《供配电系统设计规范》
- GB 50054-2011《低压配电设计规范》
- GB 50055-2011《通用用电设备配电设计规范》
- GB 51348-2019《民用建筑电气设计标准》
- GB 50217-2018《电力工程电缆设计标准》
- GB 50057-2010《建筑物防雷设计规范》
- GB 50343-2012《建筑物电子信息系统防雷技术规范》
- GB 50189-2015《公共建筑节能设计标准》
- GB 50303-2015《建筑电气工程施工质量验收规范》
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Phase(str, Enum):
    """供电相制。"""

    THREE_PHASE = "3-phase"
    SINGLE_PHASE = "1-phase"


class LoadType(str, Enum):
    """负荷类型 —— 决定需要系数 Kx 与功率因数 cosφ。"""

    POWER = "power"        # 动力
    LIGHTING = "lighting"   # 照明
    HVAC = "hvac"           # 空调


class InstallationMethod(str, Enum):
    """电缆敷设方式 —— 影响载流量查表。"""

    BRIDGE = "bridge"      # 桥架敷设
    CONDUIT = "conduit"    # 穿管敷设


# ==================== 入参 ====================


class EquipmentItem(BaseModel):
    """单台用电设备。"""

    name: str = Field(..., description="设备名称")
    power_kw: float = Field(..., gt=0, le=2000, description="单台安装功率 kW")
    voltage_v: float = Field(380.0, gt=0, le=1000, description="额定电压 V（默认 380）")
    phase: Phase = Field(Phase.THREE_PHASE, description="相制（3-phase/1-phase）")
    load_type: LoadType = Field(LoadType.POWER, description="负荷类型（power/lighting/hvac）")


class ElectricalInput(BaseModel):
    """电气计算入参：设备清单 + 敷设条件 + 变压器/短路参数。"""

    equipment: List[EquipmentItem] = Field(..., min_length=1, description="用电设备清单")
    installation_method: InstallationMethod = Field(
        InstallationMethod.BRIDGE, description="电缆敷设方式"
    )
    temperature: float = Field(30.0, ge=5, le=60, description="环境温度 ℃（载流量校正）")

    # 短路校核参数
    transformer_kva: float = Field(1000.0, gt=0, le=10000, description="变压器容量 kVA")
    uk_percent: float = Field(6.0, gt=0, le=20, description="变压器阻抗电压 %")
    distance_m: float = Field(50.0, gt=0, le=2000, description="计算点到变压器距离 m")
    breaker_capacity_ka: float = Field(35.0, gt=0, le=100, description="断路器分断能力 kA")


# ==================== 出参 ====================


class LoadGroupItem(BaseModel):
    """按负荷类型分组的计算明细。"""

    load_type: LoadType
    p_install_kw: float = Field(..., description="该组安装功率 kW")
    kx: float = Field(..., description="需要系数")
    cos_phi: float = Field(..., description="功率因数")
    pjs_kw: float = Field(..., description="该组有功计算负荷 kW")
    qjs_kvar: float = Field(..., description="该组无功计算负荷 kvar")


class LoadDetail(BaseModel):
    """负荷计算详情。"""

    p_total_kw: float = Field(..., description="总安装功率 kW")
    equipment_count: int = Field(..., description="设备数量")
    effective_kx: float = Field(..., description="综合需要系数 Kx（=Pjs/P_total）")
    effective_cos_phi: float = Field(..., description="综合功率因数 cosφ（=Pjs/Sjs）")
    effective_tan_phi: float = Field(..., description="综合无功正切 tanφ")
    pjs_kw: float = Field(..., description="总有功计算负荷 kW")
    qjs_kvar: float = Field(..., description="总无功计算负荷 kvar")
    sjs_kva: float = Field(..., description="总视在功率 kVA")
    ijs_a: float = Field(..., description="计算电流 A")
    system_voltage_v: float = Field(..., description="系统电压 V")
    phase: Phase = Field(..., description="系统相制")
    groups: List[LoadGroupItem] = Field(..., description="按负荷类型分组明细")


class CableResult(BaseModel):
    """电缆选型结果。"""

    model: str = Field(..., description="电缆完整型号，如 YJV-4*16+1*16")
    conductor: str = Field(..., description="相线规格，如 4*16")
    cross_section_mm: float = Field(..., description="相线截面 mm²")
    pe_cross_section_mm: float = Field(..., description="PE 线截面 mm²")
    rated_capacity_a: float = Field(..., description="表载额定载流量 A")
    correction_factor: float = Field(..., description="温度校正系数")
    corrected_capacity_a: float = Field(..., description="校正后载流量 A")
    meets_demand: bool = Field(..., description="校正后载流量是否满足计算电流")
    regulation_reference: str = Field(..., description="选型依据规范条款")


class BreakerResult(BaseModel):
    """断路器选型结果。"""

    model: str = Field(..., description="断路器完整型号，如 CM1-63/3P D50")
    rated_current_a: float = Field(..., description="额定电流 In A")
    frame_a: float = Field(..., description="壳架等级 A")
    trip_curve: str = Field(..., description="脱扣曲线（C/D）")
    poles: str = Field(..., description="极数（3P / 1P+N）")
    breaking_capacity_ka: float = Field(..., description="分断能力 kA")
    coordination_ok: bool = Field(..., description="In 是否 ≤ 电缆校正载流量（导体保护协调）")
    note: str = Field(..., description="选型说明/协调冲突提示")
    regulation_reference: str = Field(..., description="选型依据规范条款")


class ShortCircuitResult(BaseModel):
    """短路校核结果。"""

    transformer_rated_current_a: float = Field(..., description="变压器额定电流 A")
    transformer_short_circuit_ka: float = Field(..., description="变压器出口三相短路电流 kA")
    line_impedance_mohm: float = Field(..., description="线路阻抗 mΩ")
    end_short_circuit_ka: float = Field(..., description="末端预期短路电流 kA")
    breaker_capacity_ka: float = Field(..., description="断路器分断能力 kA")
    capacity_sufficient: bool = Field(..., description="分断能力是否满足要求")
    regulation_reference: str = Field(..., description="校核依据规范条款")


class ElectricalResult(BaseModel):
    """电气计算结果：负荷 + 电缆 + 断路器 + 短路校核 + 规范引用 + 公式说明。"""

    load: LoadDetail
    cable: CableResult
    breaker: BreakerResult
    short_circuit: ShortCircuitResult
    regulation_references: List[str] = Field(..., description="计算依据规范编号清单")
    formula_explanations: List[str] = Field(..., description="关键公式与计算步骤说明")
