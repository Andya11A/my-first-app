"""冷热源选型Schema"""
from pydantic import BaseModel, Field


class ChillerInput(BaseModel):
    total_cooling_load_kw: float = Field(..., gt=0, description="总冷负荷(kW)")
    chilled_water_supply_temp: float = Field(default=7.0, description="冷冻水供水温度(℃)")
    chilled_water_return_temp: float = Field(default=12.0, description="冷冻水回水温度(℃)")
    cooling_water_supply_temp: float = Field(default=32.0, description="冷却水供水温度(℃)")
    cooling_water_return_temp: float = Field(default=37.0, description="冷却水回水温度(℃)")
    chiller_count: int = Field(default=2, ge=2, le=6, description="机组台数")


class ChillerResult(BaseModel):
    total_cooling_load_kw: float
    chiller_count: int
    per_chiller_capacity_kw: float
    redundancy: str
    chilled_water_flow_total_m3_h: float
    chilled_water_flow_per_chiller_m3_h: float
    cooling_water_flow_total_m3_h: float
    chilled_pump_head_m: float
    chilled_pump_power_kw: float
    cooling_pump_head_m: float
    cooling_pump_power_kw: float
    formula: str
