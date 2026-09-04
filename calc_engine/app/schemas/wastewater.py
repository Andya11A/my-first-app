"""废水处理Schema"""
from pydantic import BaseModel, Field


class WastewaterInput(BaseModel):
    daily_flow_m3: float = Field(..., gt=0, description="日废水流量(m³)")
    wastewater_type: str = Field(default="laboratory", description="废水类型：laboratory/acid/alkali/organic")
    cod_inlet_mg_l: float = Field(default=500, gt=0, description="进口COD(mg/L)")
    ph_inlet: float = Field(default=7.0, ge=0, le=14, description="进口pH")


class WastewaterResult(BaseModel):
    daily_flow_m3: float
    wastewater_type: str
    treatment_process: str
    cod_inlet_mg_l: float
    cod_outlet_mg_l: float
    cod_limit_mg_l: float
    cod_compliant: bool
    ph_inlet: float
    ph_outlet: float
    ph_range: str
    ph_compliant: bool
    equipment_capacity_m3_d: float
    formula: str
