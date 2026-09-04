"""完整废气系统API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.exhaust_system import ExhaustSystemInput, ExhaustSystemResult
from app.services.exhaust_system_service import calculate_exhaust_system_complete

router = APIRouter(prefix="/exhaust-system", tags=["exhaust_system"])


@router.post("/calculate", response_model=CalculationResult[ExhaustSystemResult], summary="完整废气系统设计计算")
def calculate(payload: ExhaustSystemInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_exhaust_system_complete(
        hood_count=payload.hood_count,
        hood_type=payload.hood_type,
        hood_width_m=payload.hood_width_m,
        duct_length_m=payload.duct_length_m,
        elbow_count=payload.elbow_count,
        tee_count=payload.tee_count,
        pollutant_type=payload.pollutant_type,
        inlet_concentration_mg_m3=payload.inlet_concentration_mg_m3,
        treatment_technology=payload.treatment_technology,
        exhaust_stack_height_m=payload.exhaust_stack_height_m,
    )

    result = CalculationResult.ok(
        module="exhaust_system",
        module_version="2.0.0",
        data=ExhaustSystemResult(**data),
        references=["GB 16297-1996 大气污染物综合排放标准", "GB 50019-2015 工业建筑供暖通风与空气调节设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="exhaust_system", module_version="2.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
