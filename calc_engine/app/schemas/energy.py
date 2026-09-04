"""能耗计算Schema"""
from pydantic import BaseModel, Field


class EnergyInput(BaseModel):
    cooling_load_kw: float = Field(default=0, ge=0, description="冷负荷(kW)")
    heating_load_kw: float = Field(default=0, ge=0, description="热负荷(kW)")
    fan_power_kw: float = Field(default=0, ge=0, description="风机功率(kW)")
    pump_power_kw: float = Field(default=0, ge=0, description="水泵功率(kW)")
    lighting_power_kw: float = Field(default=0, ge=0, description="照明功率(kW)")
    equipment_power_kw: float = Field(default=0, ge=0, description="设备功率(kW)")
    operating_hours_per_day: float = Field(default=10, gt=0, le=24, description="每日运行小时数")
    operating_days_per_year: int = Field(default=260, gt=0, le=365, description="年运行天数")
    electricity_price: float = Field(default=0.8, gt=0, description="电价(元/kWh)")


class EnergyResult(BaseModel):
    hours_per_year: float
    cooling_energy_kwh: float
    heating_energy_kwh: float
    fan_energy_kwh: float
    pump_energy_kwh: float
    lighting_energy_kwh: float
    equipment_energy_kwh: float
    total_energy_kwh: float
    annual_electricity_cost_yuan: float
    electricity_price_yuan_kwh: float
    formula: str
