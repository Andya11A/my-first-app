"""消防排烟Schema"""
from pydantic import BaseModel, Field


class SmokeExhaustInput(BaseModel):
    room_area: float = Field(..., gt=0, description="房间面积(㎡)")
    room_height: float = Field(..., gt=0, description="房间高度(m)")
    room_type: str = Field(default="normal", description="房间类型：normal/atrium/corridor")
    fire_zone_area: float | None = Field(default=None, gt=0, description="防烟分区面积(㎡)，不传按≤500自动划分")


class SmokeExhaustResult(BaseModel):
    fire_zone_area_m2: float
    exhaust_volume_m3_h: float
    vent_count: int
    makeup_air_m3_h: float
    room_type: str
    formula: str
