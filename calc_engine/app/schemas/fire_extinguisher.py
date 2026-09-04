"""灭火器计算Schema"""
from pydantic import BaseModel, Field


class FireExtinguisherInput(BaseModel):
    """灭火器计算输入"""
    room_area: float = Field(..., gt=0, description="房间面积(㎡)")
    fire_risk_level: str = Field(default="medium", description="危险等级：low/medium/high")


class FireExtinguisherResult(BaseModel):
    """灭火器计算结果"""
    fire_risk_level: str = Field(..., description="危险等级")
    protection_area_per_unit_m2: float = Field(..., description="单具最大保护面积(㎡)")
    extinguisher_count_calculated: float = Field(..., description="灭火器数量（计算值）")
    extinguisher_count_recommended: int = Field(..., description="灭火器数量（推荐值）")
    max_distance_to_extinguisher_m: float = Field(..., description="最大保护距离(m)")
    formula: str = Field(..., description="计算公式")
