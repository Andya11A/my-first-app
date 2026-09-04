"""消防排烟API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.smoke_exhaust import SmokeExhaustInput, SmokeExhaustResult
from app.services.smoke_exhaust_service import calculate_smoke_exhaust

router = APIRouter(prefix="/smoke-exhaust", tags=["smoke_exhaust"])


@router.post("/calculate", response_model=CalculationResult[SmokeExhaustResult], summary="消防排烟计算")
def calculate(payload: SmokeExhaustInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_smoke_exhaust(
        room_area=payload.room_area,
        room_height=payload.room_height,
        room_type=payload.room_type,
        fire_zone_area=payload.fire_zone_area,
    )

    result = CalculationResult.ok(
        module="smoke_exhaust",
        module_version="1.0.0",
        data=SmokeExhaustResult(**data),
        references=["GB 51251-2017 建筑防烟排烟系统技术标准"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="smoke_exhaust", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
