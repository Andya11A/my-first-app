"""废水处理API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.wastewater import WastewaterInput, WastewaterResult
from app.services.wastewater_service import calculate_wastewater_treatment

router = APIRouter(prefix="/wastewater", tags=["wastewater"])


@router.post("/calculate", response_model=CalculationResult[WastewaterResult], summary="废水处理系统计算")
def calculate(payload: WastewaterInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_wastewater_treatment(
        daily_flow_m3=payload.daily_flow_m3,
        wastewater_type=payload.wastewater_type,
        cod_inlet_mg_l=payload.cod_inlet_mg_l,
        ph_inlet=payload.ph_inlet,
    )

    result = CalculationResult.ok(
        module="wastewater",
        module_version="1.0.0",
        data=WastewaterResult(**data),
        references=["GB 8978-1996 污水综合排放标准"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="wastewater", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
