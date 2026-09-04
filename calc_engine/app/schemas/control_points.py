"""自控点位Schema"""
from pydantic import BaseModel, Field


class ControlPointsInput(BaseModel):
    room_count: int = Field(..., gt=0, description="房间数量")
    ahu_count: int = Field(default=1, ge=1, description="空调机组数量")
    has_chiller: bool = Field(default=True, description="是否有冷水机组")
    has_boiler: bool = Field(default=False, description="是否有锅炉")
    has_humidifier: bool = Field(default=True, description="是否有加湿器")


class ControlPointsResult(BaseModel):
    temperature_sensors: int
    humidity_sensors: int
    pressure_sensors: int
    airflow_sensors: int
    valve_actuators: int
    damper_actuators: int
    vfd_drives: int
    total_points: int
    ddc_controller_count: int
    formula: str
