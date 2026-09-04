"""装修配置API"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.finish_config import FinishConfigInput, FinishConfigResult
from app.services.finish_config_service import (
    generate_finish_plan,
    list_lab_types,
    recommend_finish_config,
)

router = APIRouter(prefix="/finish-config", tags=["finish_config"])


@router.get("/lab-types", summary="实验室类型清单（12大类及可用洁净等级）")
def get_lab_types():
    return list_lab_types()


@router.get("/recommend/{lab_type}/{clean_level}", summary="装修配置推荐（不含造价）")
def recommend(lab_type: str, clean_level: str):
    return recommend_finish_config(lab_type, clean_level)


@router.get("/recommend/{lab_type}", summary="装修配置推荐（默认洁净等级，不含造价）")
def recommend_default(lab_type: str, clean_level: Optional[str] = Query(None)):
    return recommend_finish_config(lab_type, clean_level)


@router.post("/plan", response_model=CalculationResult[FinishConfigResult], summary="装修方案生成（含材料清单+三档造价）")
def plan(payload: FinishConfigInput, db: Optional[Session] = Depends(get_db)):
    import time
    t0 = time.perf_counter()

    try:
        data = generate_finish_plan(
            lab_type=payload.lab_type,
            clean_level=payload.clean_level,
            area=payload.area,
            countertop_type=payload.countertop_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = CalculationResult.ok(
        module="finish_config",
        module_version="2.0.0",
        data=FinishConfigResult(**data),
        references=[
            "GB 50346-2011 生物安全实验室建筑技术规范",
            "GB 50073-2013 洁净厂房设计规范",
            "GB 50591-2010 洁净室施工及验收规范",
            "GB 14925-2023 实验动物环境及设施",
            "GB 50447-2019 实验动物设施建筑技术规范",
            "JGJ 91-2019 科学实验建筑设计规范",
        ],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    record_id = save_calculation_record(
        db, module="finish_config", module_version="2.0.0",
        status=result.status.value, input_data=payload,
        output_data=result.data, warnings=result.warnings,
    )
    if record_id and result.meta:
        result.meta.record_id = record_id
    return result
