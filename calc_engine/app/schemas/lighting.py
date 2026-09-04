"""照度计算Schema"""
from pydantic import BaseModel, Field


class LightingInput(BaseModel):
    """照度计算输入"""
    room_length: float = Field(..., gt=0, description="房间长度(m)")
    room_width: float = Field(..., gt=0, description="房间宽度(m)")
    target_illuminance: float = Field(..., gt=0, description="目标照度(lx)")
    utilization_factor: float = Field(default=0.6, gt=0, le=1, description="利用系数")
    maintenance_factor: float = Field(default=0.8, gt=0, le=1, description="维护系数")
    lamp_luminous_flux: float = Field(default=3200, gt=0, description="单灯光通量(lm)")
    work_plane_height: float = Field(default=0.75, ge=0, description="工作面高度(m)")
    luminaire_height: float = Field(default=2.8, gt=0, description="灯具安装高度(m)")


class LightingResult(BaseModel):
    """照度计算结果"""
    room_index: float = Field(..., description="室形指数")
    area_m2: float = Field(..., description="房间面积(㎡)")
    total_luminous_flux_lm: float = Field(..., description="总光通量(lm)")
    lamp_count_calculated: float = Field(..., description="灯具数量（计算值）")
    lamp_count_recommended: int = Field(..., description="灯具数量（推荐值）")
    actual_illuminance_lx: float = Field(..., description="实际照度(lx)")
    formula: str = Field(..., description="计算公式")
