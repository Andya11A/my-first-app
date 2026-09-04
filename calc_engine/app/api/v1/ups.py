"""UPS计算API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.ups import UPSInput, UPSResult
from app.services.ups_service import calculate_ups_capacity

router = APIRouter(prefix="/ups", tags=["ups"])


@router.post("/calculate", response_model=CalculationResult[UPSResult], summary="UPS容量与电池配置计算")
def calculate(payload: UPSInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_ups_capacity(
        total_load_kw=payload.total_load_kw,
        power_factor=payload.power_factor,
        backup_time_min=payload.backup_time_min,
        system_efficiency=payload.system_efficiency,
        battery_voltage=payload.battery_voltage,
    )

    result = CalculationResult.ok(
        module="ups",
        module_version="1.0.0",
        data=UPSResult(**data),
        references=["GB 50174-2017 数据中心设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db,
        module="ups",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=result.data,
        warnings=result.warnings,
    )
    return result
