"""装修工程量计算路由
================

POST /decoration/calculate
    接收房间清单（含面积/周长/净高/类型/门窗数量等），一次性返回地面、
    墙面、吊顶、门窗工程量与造价估算，以及各材料总用量和燃烧性能等级汇总。

计算依据规范：
- GB 50210-2018《建筑装饰装修工程质量验收标准》
- GB 50346-2011《生物安全实验室建筑技术规范》
- GB 50016-2014(2018版)《建筑设计防火规范》
- GB 50325-2020《民用建筑工程室内环境污染控制标准》
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.decoration import DecorationInput, DecorationResult
from app.services.decoration_service import (
    DECORATION_REGULATION_REFERENCES,
    calculate_decoration,
)

router = APIRouter(prefix="/decoration", tags=["装修工程量"])


@router.post(
    "/calculate",
    response_model=CalculationResult[DecorationResult],
    summary="装修工程量计算（地面/墙面/吊顶/门窗/造价）",
)
def calculate(payload: DecorationInput, db: Optional[Session] = Depends(get_db)) -> CalculationResult[DecorationResult]:
    """单次调用完成五大功能：
    1. 地面工程量（材料选型/面积/踢脚线/焊缝，GB 50346/GB 50016）
    2. 墙面工程量（墙裙/上部涂料/彩钢板，GB 50346/GB 50325）
    3. 吊顶工程量（面积/主次龙骨，GB 50210/GB 50346）
    4. 门窗工程量（材料/数量/面积，GB 50346 第 5.3 条/GB 50016/GB 50189）
    5. 汇总（材料总用量/总造价/燃烧性能等级，GB 50016）
    """
    t0 = time.perf_counter()
    data = calculate_decoration(payload)
    duration_ms = (time.perf_counter() - t0) * 1000.0
    result = CalculationResult.ok(
        module="decoration",
        module_version="1.0.0",
        data=data,
        references=DECORATION_REGULATION_REFERENCES,
        duration_ms=duration_ms,
    )
    save_calculation_record(
        db,
        module="decoration",
        module_version="1.0.0",
        status=result.status.value,
        input_data=payload,
        output_data=data,
        warnings=result.warnings,
    )
    return result
