"""焓湿计算Schema"""
from typing import Optional

from pydantic import BaseModel, Field


class PsychroInput(BaseModel):
    """焓湿计算输入

    大气压规则：pressure 不传时按 city+season 自动查询气候库；
    显式传 pressure 时手动覆盖（kPa）。
    室外设计参数（城市季节干球/湿球/湿度）随 city+season 自动带出，供参考。
    """
    mode: str = Field(default="db_rh", description="计算模式：db_rh=干球+相对湿度 / db_wb=干球+湿球")
    dry_bulb: float = Field(..., gt=-50, lt=100, description="干球温度(℃)")
    relative_humidity: float = Field(default=50, ge=0, le=100, description="相对湿度(%)")
    wet_bulb: float = Field(default=20, gt=-50, lt=100, description="湿球温度(℃)，mode=db_wb时使用")
    pressure: Optional[float] = Field(
        default=None, ge=50, le=120,
        description="大气压(kPa)，可选；不传则按 city+season 自动查询，传了则手动覆盖",
    )
    city: str = Field(default="广州", description="城市名（用于自动查询当地大气压与室外设计参数）")
    season: str = Field(default="summer", pattern="^(summer|winter)$", description="季节：summer/winter")


class PsychroResult(BaseModel):
    """焓湿计算结果"""
    dry_bulb_c: float = Field(..., description="干球温度(℃)")
    relative_humidity_pct: float = Field(..., description="相对湿度(%)")
    humidity_ratio_g_kg: float = Field(..., description="含湿量(g/kg干空气)")
    enthalpy_kj_kg: float = Field(..., description="焓值(kJ/kg)")
    dew_point_c: float = Field(..., description="露点温度(℃)")
    wet_bulb_c: float = Field(..., description="湿球温度(℃)")
    specific_volume_m3_kg: float = Field(..., description="比容(m³/kg)")
    pressure_kpa: Optional[float] = Field(default=None, description="计算采用的大气压(kPa)")
    city: Optional[str] = Field(default=None, description="城市（按城市自动取压时返回）")
    season: Optional[str] = Field(default=None, description="季节（按城市自动取压时返回）")
    altitude_m: Optional[float] = Field(default=None, description="城市海拔(m)")
    climate: Optional[dict] = Field(default=None, description="城市该季节室外设计参数（含数据来源说明）")


class SupplyAirInput(BaseModel):
    """送风量计算输入

    室内设计状态（温湿度）为人工输入；大气压按 city 夏季自动取。
    """
    room_area: float = Field(..., gt=0, description="房间面积(㎡)")
    room_height: float = Field(..., gt=0, description="房间层高(m)")
    room_temp: float = Field(..., gt=-50, lt=100, description="室内设计温度(℃)")
    room_rh: float = Field(..., ge=0, le=100, description="室内设计相对湿度(%)")
    supply_temp: float = Field(..., gt=-50, lt=100, description="送风温度(℃)")
    supply_rh: float = Field(..., ge=0, le=100, description="送风相对湿度(%)")
    air_changes: float | None = Field(default=None, gt=0, description="换气次数(次/h)，不传默认15")
    city: str = Field(default="广州", description="城市名（自动取该城市夏季大气压）")


class SupplyAirResult(BaseModel):
    """送风量计算结果"""
    room_state: PsychroResult
    supply_state: PsychroResult
    room_volume_m3: float
    airflow_m3_h: float
    cooling_capacity_kw: float
    dehumidification_kg_h: float
    city: Optional[str] = Field(default=None, description="城市（大气压来源）")
    pressure_kpa: Optional[float] = Field(default=None, description="计算采用的夏季大气压(kPa)")
