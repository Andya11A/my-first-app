"""纯水系统API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.pure_water import PureWaterInput, PureWaterResult
from app.services.pure_water_service import calculate_pure_water_system

router = APIRouter(prefix="/pure-water", tags=["pure_water"])


@router.post("/calculate", response_model=CalculationResult[PureWaterResult], summary="纯水系统设计计算")
def calculate(payload: PureWaterInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_pure_water_system(
        daily_usage_l=payload.daily_usage_l,
        peak_factor=payload.peak_factor,
        water_quality=payload.water_quality,
        usage_hours=payload.usage_hours,
        recovery_rate=payload.recovery_rate,
    )

    result = CalculationResult.ok(
        module="pure_water",
        module_version="1.0.0",
        data=PureWaterResult(**data),
        references=["GB 50073-2013 洁净厂房设计规范", "GB/T 50109-2014 工业用水软化除盐设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="pure_water", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
