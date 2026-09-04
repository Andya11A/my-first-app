"""弱电智能化计算 API（来源：洁净EPC-AI 朋友项目合并，适配统一契约）"""
import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.weak_current import WeakCurrentInput, WeakCurrentResult
from app.services.weak_current_service import calculate_weak_current

router = APIRouter(prefix="/weak-current", tags=["weak-current"])

_WEAK_REFERENCES = [
    "GB 50311-2016 综合布线 / GB 50314-2015 智能建筑标准",
    "GB 50395-2007 视频监控 / GB 50396-2007 出入口控制",
    "GB 50346-2011 BSL / GB 50333-2013 洁净手术部",
    "GB 50343-2012 防雷 / GB 50057-2010 接地 / T/CPPC 1080.1-2024",
]


@router.post(
    "/calculate",
    response_model=CalculationResult[WeakCurrentResult],
    summary="弱电智能化计算（信息点/线缆/安防/环境监测/防雷接地）",
)
def calculate(payload: WeakCurrentInput, db: Optional[Session] = Depends(get_db)):
    t0 = time.perf_counter()
    data = calculate_weak_current(payload)
    duration_ms = (time.perf_counter() - t0) * 1000.0
    result = CalculationResult.ok(
        module="weak_current",
        module_version="1.0.0",
        data=data,
        references=_WEAK_REFERENCES,
        duration_ms=duration_ms,
    )
    save_calculation_record(
        db,
        module="weak_current",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=data,
        warnings=result.warnings,
    )
    return result
