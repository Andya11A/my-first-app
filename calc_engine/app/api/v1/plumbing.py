"""给排水计算 API（来源：洁净EPC-AI 朋友项目合并，适配统一契约）"""
import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.plumbing import PlumbingInput, PlumbingResult
from app.services.plumbing_service import calculate_plumbing

router = APIRouter(prefix="/plumbing", tags=["plumbing"])

_PLUMBING_REFERENCES = [
    "GB 50015-2019 建筑给水排水设计标准（流量/管径/坡度/流速）",
    "实验室分质排水行业惯例（酸性/有机废水单独收集）",
]


@router.post(
    "/calculate",
    response_model=CalculationResult[PlumbingResult],
    summary="给排水计算（排水流量/管径/坡度/流速校核/管材推荐）",
)
def calculate(payload: PlumbingInput, db: Optional[Session] = Depends(get_db)):
    t0 = time.perf_counter()
    data = calculate_plumbing(payload)
    duration_ms = (time.perf_counter() - t0) * 1000.0
    result = CalculationResult.ok(
        module="plumbing",
        module_version="1.0.0",
        data=data,
        references=_PLUMBING_REFERENCES,
        duration_ms=duration_ms,
    )
    save_calculation_record(
        db,
        module="plumbing",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=data,
        warnings=result.warnings,
    )
    return result
