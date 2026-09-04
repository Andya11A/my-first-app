"""能耗计算API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.energy import EnergyInput, EnergyResult
from app.services.energy_service import calculate_annual_energy

router = APIRouter(prefix="/energy", tags=["energy"])


@router.post("/calculate", response_model=CalculationResult[EnergyResult], summary="年运行能耗与电费估算")
def calculate(payload: EnergyInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_annual_energy(
        cooling_load_kw=payload.cooling_load_kw,
        heating_load_kw=payload.heating_load_kw,
        fan_power_kw=payload.fan_power_kw,
        pump_power_kw=payload.pump_power_kw,
        lighting_power_kw=payload.lighting_power_kw,
        equipment_power_kw=payload.equipment_power_kw,
        operating_hours_per_day=payload.operating_hours_per_day,
        operating_days_per_year=payload.operating_days_per_year,
        electricity_price=payload.electricity_price,
    )

    result = CalculationResult.ok(
        module="energy",
        module_version="1.0.0",
        data=EnergyResult(**data),
        references=["GB 50189-2015 公共建筑节能设计标准"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="energy", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
