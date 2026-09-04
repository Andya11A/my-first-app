"""噪声计算Schema"""
from pydantic import BaseModel, Field


class NoiseInput(BaseModel):
    source_noise_db: float = Field(..., gt=0, le=150, description="声源噪声级(dB)")
    distance_m: float = Field(..., gt=0, description="距离(m)")
    room_absorption_coefficient: float = Field(default=0.15, ge=0, le=1, description="房间吸声系数")
    source_count: int = Field(default=1, ge=1, description="声源数量")


class NoiseResult(BaseModel):
    source_noise_db: float
    distance_m: float
    source_count: int
    noise_level_at_distance_db: float
    day_limit_db: float
    night_limit_db: float
    compliant_day: bool
    compliant_night: bool
    formula: str
