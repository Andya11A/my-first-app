"""防雷接地Schema"""
from pydantic import BaseModel, Field


class LightningInput(BaseModel):
    building_length: float = Field(..., gt=0, description="建筑长度(m)")
    building_width: float = Field(..., gt=0, description="建筑宽度(m)")
    building_height: float = Field(..., gt=0, description="建筑高度(m)")
    lightning_density: float = Field(default=4.0, gt=0, description="落雷密度(次/km²/年)")


class LightningResult(BaseModel):
    equivalent_area_m2: float
    expected_lightning_strikes: float
    protection_class: str
    grid_width_m: float
    grid_length_m: float
    down_conductor_spacing_m: float
    ground_resistance_ohm: float
    formula: str
