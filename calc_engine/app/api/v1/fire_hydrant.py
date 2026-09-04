"""消火栓API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.fire_hydrant import FireHydrantInput, FireHydrantResult
from app.services.fire_hydrant_service import calculate_fire_hydrants

router = APIRouter(prefix="/fire-hydrant", tags=["fire_hydrant"])


@router.post("/calculate", response_model=CalculationResult[FireHydrantResult], summary="消火栓配置计算")
def calculate(payload: FireHydrantInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_fire_hydrants(
        building_area=payload.building_area,
        building_type=payload.building_type,
        fire_duration_h=payload.fire_duration_h,
    )

    result = CalculationResult.ok(
        module="fire_hydrant",
        module_version="1.0.0",
        data=FireHydrantResult(**data),
        references=["GB 50974-2014 消防给水及消火栓系统技术规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="fire_hydrant", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
