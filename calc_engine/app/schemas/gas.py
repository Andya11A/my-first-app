"""集中供气模块入参/出参数据模型 (Pydantic)。"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class PurityGrade(str, Enum):
    INDUSTRIAL = "industrial"            # 普通/工业级
    HIGH_PURITY = "high_purity"          # 高纯 (≤5.0N)
    ULTRA_HIGH_PURITY = "ultra_high_purity"  # 超高纯 (6.0N，半导体级)


class GasPoint(BaseModel):
    """用气点（如一台色谱仪的载气/检测器气）。"""

    gas: str = Field(..., min_length=1, max_length=10, description="气体代码: N2/O2/H2/Ar/He/CO2/CH4/C2H2/HCl...")
    count: int = Field(1, ge=1, le=500, description="同种用气点数量（如色谱仪台数）")
    peak_flow_lpm: float = Field(..., gt=0, le=500, description="单点峰值流量 L/min")
    avg_flow_lpm: Optional[float] = Field(
        None, gt=0, le=500, description="单点日均流量 L/min；留空按峰值×0.25 负载率估算"
    )


class GasSupplyInput(BaseModel):
    points: List[GasPoint] = Field(..., min_length=1, description="用气点清单")

    purity: PurityGrade = Field(PurityGrade.HIGH_PURITY, description="用气纯度等级（决定管材内表面）")
    operating_hours_per_day: float = Field(8, gt=0, le=24, description="日均用气小时数 h")
    delivery_pressure_bar: float = Field(
        0.8, gt=0, le=8, description="终端设备入口压力 bar(g)"
    )
    line_velocity_mps: float = Field(
        8.0, gt=1, le=15, description="管内流速上限 m/s（常用 5~10）"
    )
    line_length_m: float = Field(
        30, ge=1, le=500, description="气瓶间→最远用气点管长 m（压降校核用）"
    )


# ==================== 出参 ====================


class RegulatorPlan(BaseModel):
    mode: str = Field(..., description="two_stage 两级减压 / single_stage 一级直供")
    stage1_inlet_max_mpa: float = Field(15.0, description="一级减压阀入口额定压力 MPa（钢瓶压力）")
    stage1_outlet_bar: Optional[str] = Field(None, description="一级减压出口压力 bar(g)")
    stage2_outlet_bar: Optional[str] = Field(None, description="二级减压出口压力 bar(g)")
    notes: List[str] = Field(default_factory=list, description="阀件选材/结构要求")


class LineDesign(BaseModel):
    """单一气体管路设计结果。"""

    gas_code: str
    gas_name: str
    hazard_category: str = Field(..., description="inert/oxidizing/flammable/corrosive/toxic")
    point_count: int
    total_peak_lpm: float = Field(..., description="Σ(单点峰值×数量) L/min")
    simultaneity_factor: float = Field(..., description="同时使用系数")
    design_flow_nm3h: float = Field(..., description="同时系数后标态流量 Nm³/h")
    line_flow_nm3h: float = Field(..., description="工作压力下管内流量 m³/h")
    pipe_material: str = Field(..., description="管材及内表面等级")
    tube_od_mm: float = Field(..., description="推荐管外径 mm（标准系列）")
    tube_wall_mm: float = Field(..., description="壁厚 mm")
    tube_id_mm: float = Field(..., description="管内径 mm")
    actual_velocity_mps: float = Field(..., description="选定管径下实际流速 m/s")
    pressure_drop_bar: float = Field(..., description="全程估算压降 bar")
    regulator: RegulatorPlan
    special_requirements: List[str] = Field(default_factory=list, description="安全/工艺特殊要求")


class CylinderPlan(BaseModel):
    """气瓶/汇流排/杜瓦罐供应方案。"""

    gas_code: str
    daily_usage_nm3: float = Field(..., description="日用气量 Nm³/天")
    cylinder_usable_nm3: float = Field(..., description="单瓶可供气量 Nm³")
    autonomy_days_per_cylinder: float = Field(..., description="单瓶续航天数")
    scheme: str = Field(..., description="single单瓶 / manifold汇流排 / dewar杜瓦罐 / custom专项")
    cylinders_per_side: Optional[int] = Field(None, description="汇流排每侧瓶数（2×N 配置）")
    dewar_volume_l: Optional[float] = Field(None, description="推荐杜瓦罐容积 L")
    refill_interval_days: float = Field(..., description="换瓶/补液周期 天")
    notes: List[str] = Field(default_factory=list)


class GasSupplyOutput(BaseModel):
    lines: List[LineDesign]
    cylinder_plans: List[CylinderPlan]
    total_points: int = Field(..., description="用气点总数")
    gas_codes: List[str] = Field(..., description="涉及的气体清单")
