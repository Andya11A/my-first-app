"""工艺规划路由
================

POST /process/calculate
    接收实验室类型、总面积、人员数量、设备清单，一次性返回功能分区、
    面积估算、环境参数、设备负荷、动线规划结果。

计算依据规范：
- JGJ 91-2019《科研建筑设计标准》
- GB 50346-2011《生物安全实验室建筑技术规范》
- GB 50881-2013《疾病预防控制中心建筑技术规范》
- GB 50189-2015《公共建筑节能设计标准》
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.process import ProcessInput, ProcessResult
from app.services.process_service import (
    PROCESS_REGULATION_REFERENCES,
    calculate_process,
)

router = APIRouter(prefix="/process", tags=["工艺规划"])


@router.post(
    "/calculate",
    response_model=CalculationResult[ProcessResult],
    summary="工艺规划计算（分区/面积/环境/设备负荷/动线）",
)
def calculate(payload: ProcessInput, db: Optional[Session] = Depends(get_db)) -> CalculationResult[ProcessResult]:
    """单次调用完成五大功能：
    1. 功能分区（按实验室类型预设比例，JGJ 91/GB 50346）
    2. 面积估算（人均指标 + 设备占地 + 通道 + 预留，JGJ 91 表 4.1）
    3. 环境参数（温湿度/换气/压差，GB 50881 表 7.4.1）
    4. 设备负荷（总散热/总用电，供暖通与电气模块）
    5. 动线规划（人流/物流分离，GB 50346-2011）
    """
    t0 = time.perf_counter()
    data = calculate_process(payload)
    duration_ms = (time.perf_counter() - t0) * 1000.0
    result = CalculationResult.ok(
        module="process",
        module_version="1.0.0",
        data=data,
        references=PROCESS_REGULATION_REFERENCES,
        duration_ms=duration_ms,
    )
    save_calculation_record(
        db,
        module="process",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=data,
        warnings=result.warnings,
    )
    return result
