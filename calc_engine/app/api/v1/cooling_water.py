"""冷却水系统API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.cooling_water import CoolingWaterInput, CoolingWaterResult
from app.services.cooling_water_service import calculate_cooling_tower

router = APIRouter(prefix="/cooling-water", tags=["cooling_water"])


@router.post("/calculate", response_model=CalculationResult[CoolingWaterResult], summary="冷却塔选型计算")
def calculate(payload: CoolingWaterInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_cooling_tower(
        cooling_load_kw=payload.cooling_load_kw,
        inlet_temp_c=payload.inlet_temp_c,
        outlet_temp_c=payload.outlet_temp_c,
        wet_bulb_temp_c=payload.wet_bulb_temp_c,
    )

    result = CalculationResult.ok(
        module="cooling_water",
        module_version="1.0.0",
        data=CoolingWaterResult(**data),
        references=["GB 50019-2015 工业建筑供暖通风与空气调节设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="cooling_water", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
