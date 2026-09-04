"""完整废气系统Schema"""
from pydantic import BaseModel, Field


class ExhaustSystemInput(BaseModel):
    hood_count: int = Field(default=2, ge=1, le=20, description="收集点数量")
    hood_type: str = Field(default="fume_hood", description="收集点类型：fume_hood/universal_hood/atomic_absorption")
    hood_width_m: float = Field(default=1.5, gt=0, description="通风柜宽度(m)")
    duct_length_m: float = Field(default=20, gt=0, description="风管总长度(m)")
    elbow_count: int = Field(default=4, ge=0, description="90°弯头数量")
    tee_count: int = Field(default=2, ge=0, description="三通数量")
    pollutant_type: str = Field(default="VOCs", description="污染物类型")
    inlet_concentration_mg_m3: float = Field(default=200, gt=0, description="进口浓度(mg/m³)")
    treatment_technology: str = Field(default="activated_carbon", description="处理技术")
    exhaust_stack_height_m: float = Field(default=15, gt=0, description="排气筒高度(m)")


class ExhaustSystemResult(BaseModel):
    collection: dict
    duct: dict
    resistance: dict
    fan: dict
    treatment: dict
    stack_requirement: str
    formula: str
