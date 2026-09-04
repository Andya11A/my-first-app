"""噪声计算API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.noise import NoiseInput, NoiseResult
from app.services.noise_service import calculate_noise_level

router = APIRouter(prefix="/noise", tags=["noise"])


@router.post("/calculate", response_model=CalculationResult[NoiseResult], summary="噪声传播衰减计算")
def calculate(payload: NoiseInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_noise_level(
        source_noise_db=payload.source_noise_db,
        distance_m=payload.distance_m,
        room_absorption_coefficient=payload.room_absorption_coefficient,
        source_count=payload.source_count,
    )

    result = CalculationResult.ok(
        module="noise",
        module_version="1.0.0",
        data=NoiseResult(**data),
        references=["GB 12348-2008 工业企业厂界环境噪声排放标准"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="noise", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
