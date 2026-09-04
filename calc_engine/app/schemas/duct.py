"""风管尺寸Schema"""
from pydantic import BaseModel, Field


class DuctInput(BaseModel):
    airflow_m3_h: float = Field(..., gt=0, description="风量(m³/h)")
    max_velocity_m_s: float = Field(default=8.0, gt=0, le=20, description="最大风速(m/s)")
    aspect_ratio: float = Field(default=2.0, gt=0, le=4, description="宽高比")


class DuctResult(BaseModel):
    airflow_m3_h: float
    max_velocity_m_s: float
    required_area_m2: float
    duct_width_mm: int
    duct_height_mm: int
    actual_velocity_m_s: float
    equivalent_diameter_mm: float
    formula: str
