"""消火栓Schema"""
from pydantic import BaseModel, Field


class FireHydrantInput(BaseModel):
    building_area: float = Field(..., gt=0, description="建筑面积(㎡)")
    building_type: str = Field(default="laboratory", description="建筑类型：laboratory/office/warehouse")
    fire_duration_h: float = Field(default=2.0, gt=0, le=4, description="火灾持续时间(h)")


class FireHydrantResult(BaseModel):
    gun_count: int
    water_flow_per_gun_l_s: float
    total_flow_l_s: float
    fire_duration_h: float
    total_water_m3: float
    hydrant_count: int
    water_tank_volume_m3: float
    formula: str
