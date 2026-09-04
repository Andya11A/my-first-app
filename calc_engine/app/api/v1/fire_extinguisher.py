"""灭火器配置API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.fire_extinguisher import FireExtinguisherInput, FireExtinguisherResult
from app.services.fire_extinguisher_service import calculate_fire_extinguishers

router = APIRouter(prefix="/fire-extinguisher", tags=["fire_extinguisher"])


@router.post("/calculate", response_model=CalculationResult[FireExtinguisherResult], summary="灭火器配置计算")
def calculate(payload: FireExtinguisherInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_fire_extinguishers(
        room_area=payload.room_area,
        fire_risk_level=payload.fire_risk_level,
    )

    result = CalculationResult.ok(
        module="fire_extinguisher",
        module_version="1.0.0",
        data=FireExtinguisherResult(**data),
        references=["GB 50140-2005 建筑灭火器配置设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db,
        module="fire_extinguisher",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=result.data,
        warnings=result.warnings,
    )
    return result
