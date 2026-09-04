"""冷却水系统Schema"""
from pydantic import BaseModel, Field


class CoolingWaterInput(BaseModel):
    cooling_load_kw: float = Field(..., gt=0, description="冷却负荷(kW)")
    inlet_temp_c: float = Field(default=37.0, gt=0, le=60, description="冷却塔进水温度(℃)")
    outlet_temp_c: float = Field(default=32.0, gt=0, le=60, description="冷却塔出水温度(℃)")
    wet_bulb_temp_c: float = Field(default=28.0, gt=0, le=40, description="当地湿球温度(℃)")


class CoolingWaterResult(BaseModel):
    cooling_load_kw: float
    cooling_water_flow_m3_h: float
    cooling_tower_capacity_kw: float
    makeup_water_m3_h: float
    approach_k: float
    delta_t_k: float
    formula: str
