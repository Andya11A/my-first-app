"""UPS计算Schema"""
from pydantic import BaseModel, Field


class UPSInput(BaseModel):
    """UPS计算输入"""
    total_load_kw: float = Field(..., gt=0, description="总负载(kW)")
    power_factor: float = Field(default=0.9, gt=0, le=1, description="功率因数")
    backup_time_min: int = Field(default=30, gt=0, description="备电时间(分钟)")
    system_efficiency: float = Field(default=0.95, gt=0, le=1, description="系统效率")
    battery_voltage: float = Field(default=384, gt=0, description="电池组电压(V)")


class UPSResult(BaseModel):
    """UPS计算结果"""
    ups_capacity_kva_calculated: float = Field(..., description="UPS容量计算值(kVA)")
    ups_capacity_kva_recommended: int = Field(..., description="UPS容量推荐值(kVA)")
    backup_time_min: int = Field(..., description="备电时间(分钟)")
    battery_energy_kwh: float = Field(..., description="电池能量(kWh)")
    battery_voltage_v: float = Field(..., description="电池组电压(V)")
    battery_capacity_ah: float = Field(..., description="电池容量(Ah)")
    battery_count: int = Field(..., description="电池数量")
    battery_spec: str = Field(..., description="电池配置说明")
    formula: str = Field(..., description="计算公式")
