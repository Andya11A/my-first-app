"""FFU循环风系统Schema"""
from pydantic import BaseModel, Field


class FFUInput(BaseModel):
    room_length_m: float = Field(..., gt=0, description="房间长度(m)")
    room_width_m: float = Field(..., gt=0, description="房间宽度(m)")
    room_height_m: float = Field(..., gt=0, description="房间层高(m)")
    clean_class: str = Field(..., description="洁净等级：ISO5/ISO6/ISO7/ISO8")
    ffu_spec: str = Field(default="1175x575", description="FFU规格：575x575/1175x575/1175x1175")
    hepa_grade: str = Field(default="H14", description="高效过滤器等级：H13/H14")
    filter_condition: str = Field(default="design", description="过滤器状态：initial/design/final")
    single_ffu_airflow_m3_h: float | None = Field(default=None, gt=0, description="单台风量(m³/h)，不传用典型值")


class FFUResult(BaseModel):
    clean_class: str
    clean_class_name: str
    room: dict
    airflow: dict
    ffu: dict
    face_velocity: dict
    pressure: dict
    power: dict
    formula: str
