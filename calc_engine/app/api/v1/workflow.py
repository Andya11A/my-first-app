"""图纸联动计算 API 路由（来源：洁净EPC-AI 朋友项目合并，适配统一契约）

POST /api/v1/workflow/calculate-hvac
请求体：drawing /parse 的输出（equipments 必需，其余字段自动忽略）
"""
import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult, CalculationStatus, CalculationWarning
from app.schemas.workflow import WorkflowInput, WorkflowResult
from app.services.workflow_service import calculate_fume_hood_airflow

router = APIRouter(prefix="/workflow", tags=["workflow"])

_WORKFLOW_REFERENCES = [
    "GB 50019-2015 工业建筑供暖通风与空气调节设计规范（通风柜面风速/排风量）",
    "JGJ/T 67-2019 办公建筑设计标准（层高取值参考）",
]


@router.post(
    "/calculate-hvac",
    response_model=CalculationResult[WorkflowResult],
    summary="图纸联动暖通计算（DXF 解析结果 → 通风柜识别 → 逐台风量）",
)
def calculate_hvac_from_drawing(
    drawing: WorkflowInput, db: Optional[Session] = Depends(get_db)
):
    """
    接收图纸识别模块返回的完整 JSON，筛选通风柜并逐台计算所需风量。

    请求体即 drawing /parse 的输出（equipments 必需）；
    返回统一契约：data = { fume_hoods, summary, errors }。
    """
    t0 = time.perf_counter()
    raw = drawing.model_dump()
    result_dict = calculate_fume_hood_airflow(raw)
    data = WorkflowResult(**result_dict)
    duration_ms = (time.perf_counter() - t0) * 1000.0

    result = CalculationResult.ok(
        module="workflow",
        module_version="1.0.0",
        data=data,
        references=_WORKFLOW_REFERENCES,
        duration_ms=duration_ms,
    )
    if data.errors:
        result.warnings = [
            CalculationWarning(code="WF_W001", message=err) for err in data.errors
        ]
        result.status = CalculationStatus.WARNING
    save_calculation_record(
        db,
        module="workflow",
        module_version="1.0.0",
        status=result.status.value,
        input_data=drawing,
        output_data=data,
        warnings=result.warnings,
    )
    return result
