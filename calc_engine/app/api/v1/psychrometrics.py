"""焓湿计算API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.psychrometrics import (
    PsychroInput,
    PsychroResult,
    SupplyAirInput,
    SupplyAirResult,
)
from app.services.psychrometrics_service import (
    calc_from_db_rh,
    calc_from_db_wb,
    calc_state_from_city,
    calc_supply_air,
)
from app.services.city_climate_db import get_city_climate

router = APIRouter(prefix="/psychrometrics", tags=["psychrometrics"])

MODULE_VERSION = "1.1.0"


@router.post("/state", response_model=CalculationResult[PsychroResult], summary="空气状态点计算（焓湿图）")
def calc_state(payload: PsychroInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    # 大气压解析：显式传 pressure 则手动覆盖；否则按 city+season 自动查询
    manual = payload.pressure is not None
    try:
        climate = None if manual else get_city_climate(payload.city, payload.season)
    except ValueError as exc:
        result = CalculationResult.fail(
            module="psychrometrics",
            module_version=MODULE_VERSION,
            message=str(exc),
            code="PSYCHRO_E001",
            field="city" if "城市" in str(exc) else "season",
            duration_ms=(time.perf_counter() - t0) * 1000.0,
        )
        save_calculation_record(
            db,
            module="psychrometrics",
            module_version=MODULE_VERSION,
            status=result.status.value,
            input_data=payload,
            output_data=None,
            warnings=result.warnings,
        )
        return result

    if manual:
        pressure_kpa = payload.pressure
    else:
        pressure_kpa = climate["pressure_kpa"]

    if payload.mode == "db_wb":
        data = calc_from_db_wb(payload.dry_bulb, payload.wet_bulb, pressure_kpa)
    else:
        data = calc_from_db_rh(payload.dry_bulb, payload.relative_humidity, pressure_kpa)

    if not manual and climate is not None:
        data["city"] = climate["city"]
        data["season"] = payload.season
        data["altitude_m"] = climate["altitude_m"]
        data["climate"] = climate

    meta_extra = {
        "pressure_kpa": pressure_kpa,
        "pressure_source": "manual" if manual else "city",
        "city": None if manual else climate["city"],
        "season": None if manual else payload.season,
    }

    result = CalculationResult.ok(
        module="psychrometrics",
        module_version=MODULE_VERSION,
        data=PsychroResult(**data),
        references=[
            "ASHRAE Handbook - Fundamentals",
            "GB 50736-2012 民用建筑供暖通风与空气调节设计规范 附录A",
        ],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
        extra=meta_extra,
    )
    save_calculation_record(
        db,
        module="psychrometrics",
        module_version=MODULE_VERSION,
        status=result.status.value,
        input_data=payload,
        output_data=result.data,
        warnings=result.warnings,
    )
    return result


@router.post("/supply-air", response_model=CalculationResult[SupplyAirResult], summary="送风量/冷量/除湿量计算")
def calc_supply(payload: SupplyAirInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    try:
        climate = get_city_climate(payload.city, "summer")
    except ValueError as exc:
        result = CalculationResult.fail(
            module="psychrometrics",
            module_version=MODULE_VERSION,
            message=str(exc),
            code="PSYCHRO_E001",
            field="city",
            duration_ms=(time.perf_counter() - t0) * 1000.0,
        )
        save_calculation_record(
            db,
            module="psychrometrics",
            module_version=MODULE_VERSION,
            status=result.status.value,
            input_data=payload,
            output_data=None,
            warnings=result.warnings,
        )
        return result

    data = calc_supply_air(
        room_area=payload.room_area,
        room_height=payload.room_height,
        room_temp=payload.room_temp,
        room_rh=payload.room_rh,
        supply_temp=payload.supply_temp,
        supply_rh=payload.supply_rh,
        air_changes=payload.air_changes,
        city=payload.city,
    )

    result = CalculationResult.ok(
        module="psychrometrics",
        module_version=MODULE_VERSION,
        data=SupplyAirResult(**data),
        references=["GB 50736-2012 民用建筑供暖通风与空气调节设计规范"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
        extra={
            "city": climate["city"],
            "season": "summer",
            "pressure_kpa": climate["pressure_kpa"],
            "pressure_source": "city",
            "note": "室内设计状态为人工输入；大气压按城市夏季自动取值",
        },
    )
    save_calculation_record(
        db,
        module="psychrometrics",
        module_version=MODULE_VERSION,
        status=result.status.value,
        input_data=payload,
        output_data=result.data,
        warnings=result.warnings,
    )
    return result
