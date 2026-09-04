"""桥架选型API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.cable_tray import CableTrayInput, CableTrayResult
from app.services.cable_tray_service import calculate_cable_tray

router = APIRouter(prefix="/cable-tray", tags=["cable_tray"])


@router.post("/calculate", response_model=CalculationResult[CableTrayResult], summary="电缆桥架尺寸选型")
def calculate(payload: CableTrayInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_cable_tray(
        cable_quantities=payload.cable_quantities,
        fill_ratio=payload.fill_ratio,
    )

    result = CalculationResult.ok(
        module="cable_tray",
        module_version="1.0.0",
        data=CableTrayResult(**data),
        references=["GB 50054-2011 低压配电设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="cable_tray", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
