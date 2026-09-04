"""FFU循环风系统API"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.ffu import FFUInput, FFUResult
from app.services.ffu_service import calculate_ffu_system

router = APIRouter(prefix="/ffu", tags=["ffu"])


@router.post("/calculate", response_model=CalculationResult[FFUResult], summary="FFU循环风系统计算（工程级）")
def calculate(payload: FFUInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    try:
        data = calculate_ffu_system(
            room_length_m=payload.room_length_m,
            room_width_m=payload.room_width_m,
            room_height_m=payload.room_height_m,
            clean_class=payload.clean_class,
            ffu_spec=payload.ffu_spec,
            hepa_grade=payload.hepa_grade,
            filter_condition=payload.filter_condition,
            single_ffu_airflow_m3_h=payload.single_ffu_airflow_m3_h,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = CalculationResult.ok(
        module="ffu",
        module_version="2.0.0",
        data=FFUResult(**data),
        references=["GB 50073-2013 洁净厂房设计规范", "ISO 14644-1 洁净室及相关受控环境"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    record_id = save_calculation_record(
        db, module="ffu", module_version="2.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    if record_id and result.meta:
        result.meta.record_id = record_id
    return result
