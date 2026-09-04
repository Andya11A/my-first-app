"""防雷接地API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.lightning import LightningInput, LightningResult
from app.services.lightning_service import calculate_lightning_protection

router = APIRouter(prefix="/lightning", tags=["lightning"])


@router.post("/calculate", response_model=CalculationResult[LightningResult], summary="防雷等级与接闪器布置计算")
def calculate(payload: LightningInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_lightning_protection(
        building_length=payload.building_length,
        building_width=payload.building_width,
        building_height=payload.building_height,
        lightning_density=payload.lightning_density,
    )

    result = CalculationResult.ok(
        module="lightning",
        module_version="1.0.0",
        data=LightningResult(**data),
        references=["GB 50057-2010 建筑物防雷设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="lightning", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
