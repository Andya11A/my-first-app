"""冷热源选型API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.chiller import ChillerInput, ChillerResult
from app.services.chiller_service import calculate_chiller_selection

router = APIRouter(prefix="/chiller", tags=["chiller"])


@router.post("/calculate", response_model=CalculationResult[ChillerResult], summary="冷水机组与水泵选型")
def calculate(payload: ChillerInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_chiller_selection(
        total_cooling_load_kw=payload.total_cooling_load_kw,
        chilled_water_supply_temp=payload.chilled_water_supply_temp,
        chilled_water_return_temp=payload.chilled_water_return_temp,
        cooling_water_supply_temp=payload.cooling_water_supply_temp,
        cooling_water_return_temp=payload.cooling_water_return_temp,
        chiller_count=payload.chiller_count,
    )

    result = CalculationResult.ok(
        module="chiller",
        module_version="1.0.0",
        data=ChillerResult(**data),
        references=["GB 50736-2012 民用建筑供暖通风与空气调节设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="chiller", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
