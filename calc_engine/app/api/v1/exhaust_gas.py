"""废气处理API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.exhaust_gas import (
    ExhaustTreatmentInput,
    ExhaustTreatmentResult,
    CarbonLifetimeInput,
    CarbonLifetimeResult,
)
from app.services.exhaust_gas_service import calculate_exhaust_treatment, calculate_carbon_lifetime

router = APIRouter(prefix="/exhaust-gas", tags=["exhaust_gas"])


@router.post("/treatment", response_model=CalculationResult[ExhaustTreatmentResult], summary="废气处理设备选型与达标核算")
def calc_treatment(payload: ExhaustTreatmentInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_exhaust_treatment(
        pollutant_type=payload.pollutant_type,
        inlet_concentration_mg_m3=payload.inlet_concentration_mg_m3,
        exhaust_flow_m3_h=payload.exhaust_flow_m3_h,
        treatment_technology=payload.treatment_technology,
    )

    result = CalculationResult.ok(
        module="exhaust_gas",
        module_version="1.0.0",
        data=ExhaustTreatmentResult(**data),
        references=["GB 16297-1996 大气污染物综合排放标准", "GB 14554-1993 恶臭污染物排放标准"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="exhaust_gas", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result


@router.post("/carbon-lifetime", response_model=CalculationResult[CarbonLifetimeResult], summary="活性炭寿命计算")
def calc_carbon(payload: CarbonLifetimeInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    data = calculate_carbon_lifetime(
        pollutant_type=payload.pollutant_type,
        inlet_concentration_mg_m3=payload.inlet_concentration_mg_m3,
        exhaust_flow_m3_h=payload.exhaust_flow_m3_h,
        carbon_fill_kg=payload.carbon_fill_kg,
        carbon_adsorption_capacity_pct=payload.carbon_adsorption_capacity_pct,
    )

    result = CalculationResult.ok(
        module="exhaust_gas",
        module_version="1.0.0",
        data=CarbonLifetimeResult(**data),
        references=["HJ 2026-2013 吸附法工业有机废气治理工程技术规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="exhaust_gas", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    return result
