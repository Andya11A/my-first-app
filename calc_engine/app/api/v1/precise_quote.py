"""精确报价引擎 API（纯计算，不落库）"""
import time

from fastapi import APIRouter

from app.schemas.common import CalculationResult, CalculationWarning
from app.schemas.precise_quote import PreciseQuoteInput, PreciseQuoteResult
from app.services.precise_quote_service import calculate_precise_quote

router = APIRouter(prefix="/precise-quote", tags=["precise_quote"])


@router.post(
    "/calculate",
    response_model=CalculationResult[PreciseQuoteResult],
    summary="实验室装修工程精确报价（材料+人工+辅材+管理费+利润+税金）",
)
def calculate_precise_quote_api(payload: PreciseQuoteInput):
    """按工程量清单逐项计价并汇总，返回低/中/高三档报价。纯计算接口，不落库。"""
    t0 = time.perf_counter()

    items = [item.model_dump() for item in payload.items]

    try:
        data = calculate_precise_quote(
            items=items,
            city=payload.city,
            tax_type=payload.tax_type,
        )
    except ValueError as e:
        return CalculationResult.fail(
            module="precise_quote",
            module_version="1.0.0",
            message=str(e),
            code="QUOTE_E001",
            field="items",
            references=["GB 50500-2013 建设工程工程量清单计价规范"],
            duration_ms=(time.perf_counter() - t0) * 1000.0,
        )

    # 明细中的告警上提到统一契约 warnings（状态转为 warning）
    warnings = [
        CalculationWarning(code="QUOTE_W001", message=w)
        for w in data.get("meta", {}).get("warnings", [])
    ]

    return CalculationResult.ok(
        module="precise_quote",
        module_version="1.0.0",
        data=PreciseQuoteResult(**data),
        warnings=warnings,
        references=[
            "GB 50500-2013 建设工程工程量清单计价规范",
            "湖南省住建厅建筑安装工程费用标准表（2025-09）",
            "JGJ 91-2019 科学实验建筑设计规范",
        ],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
