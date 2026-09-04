"""纯水系统Schema"""
from pydantic import BaseModel, Field


class PureWaterInput(BaseModel):
    daily_usage_l: float = Field(..., gt=0, description="日用水量(L)")
    peak_factor: float = Field(default=2.0, gt=1, le=5, description="峰值系数")
    water_quality: str = Field(default="ultrapure", description="水质：pure/ultrapure")
    usage_hours: float = Field(default=8.0, gt=0, le=24, description="日使用时长(h)")
    recovery_rate: float = Field(default=0.6, gt=0, le=1, description="回收率")


class PureWaterResult(BaseModel):
    daily_usage_l: float
    peak_flow_l_h: float
    equipment_capacity_l_h: float
    equipment_type: str
    storage_tank_l: float
    raw_water_daily_l: float
    recovery_rate_pct: float
    formula: str
