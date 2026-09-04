"""风管尺寸API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.duct import DuctInput, DuctResult
from app.services.duct_service import calculate_duct_size

router = APIRouter(prefix="/duct", tags=["duct"])


@router.post("/calculate", response_model=CalculationResult[DuctResult], summary="风管尺寸计算")
def calculate(payload: DuctInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_duct_size(
        airflow_m3_h=payload.airflow_m3_h,
        max_velocity_m_s=payload.max_velocity_m_s,
        aspect_ratio=payload.aspect_ratio,
    )

    result = CalculationResult.ok(
        module="duct",
        module_version="1.0.0",
        data=DuctResult(**data),
        references=["GB 50736-2012 民用建筑供暖通风与空气调节设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="duct", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
