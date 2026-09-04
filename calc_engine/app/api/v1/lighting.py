"""照度计算API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.lighting import LightingInput, LightingResult
from app.services.lighting_service import calculate_lamp_count

router = APIRouter(prefix="/lighting", tags=["lighting"])


@router.post("/calculate", response_model=CalculationResult[LightingResult], summary="照度计算（利用系数法）")
def calculate(payload: LightingInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_lamp_count(
        room_length=payload.room_length,
        room_width=payload.room_width,
        target_illuminance=payload.target_illuminance,
        utilization_factor=payload.utilization_factor,
        maintenance_factor=payload.maintenance_factor,
        lamp_luminous_flux=payload.lamp_luminous_flux,
        work_plane_height=payload.work_plane_height,
        luminaire_height=payload.luminaire_height,
    )

    result = CalculationResult.ok(
        module="lighting",
        module_version="1.0.0",
        data=LightingResult(**data),
        references=["GB 50034-2013 建筑照明设计标准"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db,
        module="lighting",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=result.data,
        warnings=result.warnings,
    )
    return result
