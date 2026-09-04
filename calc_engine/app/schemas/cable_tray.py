"""桥架选型Schema"""
from pydantic import BaseModel, Field


class CableTrayInput(BaseModel):
    cable_quantities: dict[str, int] = Field(..., description="电缆数量，如 {'2.5mm²': 10}")
    fill_ratio: float = Field(default=0.4, gt=0, le=1, description="填充率")


class CableTrayResult(BaseModel):
    total_cable_area_mm2: float
    required_tray_area_mm2: float
    cable_details: list[dict]
    selected_tray_width_mm: int
    selected_tray_height_mm: int
    fill_ratio_pct: float
    formula: str
