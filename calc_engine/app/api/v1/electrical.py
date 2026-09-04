"""电气计算路由
==================

POST /electrical/calculate
    接收设备清单与敷设/变压器参数，一次性返回负荷、电缆、断路器、
    短路校核结果及规范引用与公式说明。

计算依据规范：
- GB 50052-2009《供配电系统设计规范》
- GB 50054-2011《低压配电设计规范》
- GB 50055-2011《通用用电设备配电设计规范》
- GB 51348-2019《民用建筑电气设计标准》
- GB 50217-2018《电力工程电缆设计标准》
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.electrical import ElectricalInput, ElectricalResult
from app.services.electrical_service import (
    ELECTRICAL_REGULATION_REFERENCES,
    calculate_electrical,
)

router = APIRouter(prefix="/electrical", tags=["电气计算"])


@router.post(
    "/calculate",
    response_model=CalculationResult[ElectricalResult],
    summary="电气综合计算（负荷/电缆/断路器/短路校核）",
)
def calculate(payload: ElectricalInput, db: Optional[Session] = Depends(get_db)) -> CalculationResult[ElectricalResult]:
    """单次调用完成四大功能：
    1. 负荷计算（需要系数法，GB 51348-2019）
    2. 电缆选型（YJV 载流量 + 温度校正 + PE 线，GB 50054/GB 50217）
    3. 断路器选型（In/壳架/脱扣曲线，GB 50054 第 6.3.3 条）
    4. 短路校核（末端短路电流 + 分断能力，GB 50054 第 3.1.2 条）
    """
    t0 = time.perf_counter()
    data = calculate_electrical(payload)
    duration_ms = (time.perf_counter() - t0) * 1000.0
    result = CalculationResult.ok(
        module="electrical",
        module_version="1.0.0",
        data=data,
        references=ELECTRICAL_REGULATION_REFERENCES,
        duration_ms=duration_ms,
    )
    save_calculation_record(
        db,
        module="electrical",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=data,
        warnings=result.warnings,
    )
    return result
