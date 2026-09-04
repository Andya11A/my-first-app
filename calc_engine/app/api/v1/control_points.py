"""自控点位API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.control_points import ControlPointsInput, ControlPointsResult
from app.services.control_points_service import calculate_control_points

router = APIRouter(prefix="/control-points", tags=["control_points"])


@router.post("/calculate", response_model=CalculationResult[ControlPointsResult], summary="自控系统点位表计算")
def calculate(payload: ControlPointsInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_control_points(
        room_count=payload.room_count,
        ahu_count=payload.ahu_count,
        has_chiller=payload.has_chiller,
        has_boiler=payload.has_boiler,
        has_humidifier=payload.has_humidifier,
    )

    result = CalculationResult.ok(
        module="control_points",
        module_version="1.0.0",
        data=ControlPointsResult(**data),
        references=["GB 50339-2013 智能建筑工程质量验收规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="control_points", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
