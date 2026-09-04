"""智能化设计计算 API（来源：洁净EPC-AI 朋友项目合并，适配统一契约）"""
import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.intelligence import IntelligenceInput, IntelligenceResult
from app.services.intelligence_service import calculate_intelligence

router = APIRouter(prefix="/intelligence", tags=["intelligence"])

_INTEL_REFERENCES = [
    "GB 50314-2015 智能建筑设计标准（系统分级框架）",
    "GB 50311-2016 综合布线系统工程设计规范（信息点配置）",
    "GB 50189-2015 公共建筑节能设计标准（能耗监测）",
]


@router.post(
    "/calculate",
    response_model=CalculationResult[IntelligenceResult],
    summary="智能化设计计算（信息点位/环境监控/能耗监测）",
)
def calculate(payload: IntelligenceInput, db: Optional[Session] = Depends(get_db)):
    t0 = time.perf_counter()
    data = calculate_intelligence(payload)
    duration_ms = (time.perf_counter() - t0) * 1000.0
    result = CalculationResult.ok(
        module="intelligence",
        module_version="1.0.0",
        data=data,
        references=_INTEL_REFERENCES,
        duration_ms=duration_ms,
    )
    save_calculation_record(
        db,
        module="intelligence",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=data,
        warnings=result.warnings,
    )
    return result
