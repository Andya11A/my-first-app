"""暖通计算 V2 路由
====================

POST /hvac/calculate
    接收房间参数，一次性返回冷热负荷、风量、压差策略、节能校核、
    规范引用与公式说明。

计算依据规范：
- GB 50736-2012《民用建筑供暖通风与空气调节设计规范》
- GB 50019-2015《工业建筑供暖通风与空气调节设计规范》
- GB 50346-2011《生物安全实验室建筑技术规范》
- GB 50333-2013《医院洁净手术部建筑技术规范》
- GB 50189-2015《公共建筑节能设计标准》
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.hvac import HVACInput, HVACResult
from app.services.hvac_service import (
    HVAC_REGULATION_REFERENCES,
    calculate_hvac,
)

router = APIRouter(prefix="/hvac", tags=["暖通计算 V2"])


@router.post(
    "/calculate",
    response_model=CalculationResult[HVACResult],
    summary="暖通综合计算（冷热负荷/通风量/压差控制/废气处理/系统选型）",
)
def calculate(payload: HVACInput, db: Optional[Session] = Depends(get_db)) -> CalculationResult[HVACResult]:
    """单次调用完成五大功能：
    1. 冷热负荷（围护/人员/设备/照明/新风焓差，GB 50736 / GB 50881 7.4.5）
    2. 通风量（全面通风/局部排风/总排风/新风，GB 50881 表7.4.1 / 22K523）
    3. 压差控制（BSL-2/3 梯度、洁净室正压、化学微负压，GB 50346）
    4. 废气处理（酸/有机/生物/混合，22K523 / GB 50346 HEPA）
    5. 通风系统选型（CAV/VAV/独立排风/补风，22K523 四种典型系统）
    """
    t0 = time.perf_counter()
    data = calculate_hvac(payload)
    duration_ms = (time.perf_counter() - t0) * 1000.0
    result = CalculationResult.ok(
        module="hvac_v2",
        module_version="3.0.0",
        data=data,
        references=HVAC_REGULATION_REFERENCES,
        duration_ms=duration_ms,
    )
    save_calculation_record(
        db,
        module="hvac_v2",
        module_version="3.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=data,
        warnings=result.warnings,
    )
    return result
