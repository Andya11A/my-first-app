"""报价联动API"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from pydantic import BaseModel, Field

router = APIRouter(prefix="/quote", tags=["quote"])


class QuoteInput(BaseModel):
    lab_type: str = Field(..., description="实验室类型")
    area: float = Field(..., gt=0, description="面积(㎡)")
    clean_level: str = Field(default="普通", description="洁净等级")
    management_fee_rate: float = Field(default=0.12, ge=0, le=0.5, description="管理费率")
    profit_rate: float = Field(default=0.10, ge=0, le=0.5, description="利润率")


@router.post("/integrated", summary="生成完整报价（设备+施工+暖通+管理费+利润）")
def generate_quote(payload: QuoteInput, db: Optional[Session] = Depends(get_db)):
    import time
    from app.services.quote_integration_service import generate_integrated_quote

    t0 = time.perf_counter()
    data = generate_integrated_quote(
        lab_type=payload.lab_type,
        area=payload.area,
        clean_level=payload.clean_level,
        management_fee_rate=payload.management_fee_rate,
        profit_rate=payload.profit_rate,
    )

    result = CalculationResult.ok(
        module="quote_integration",
        module_version="1.0.0",
        data=data,
        references=["行业报价参考"],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    save_calculation_record(
        db, module="quote_integration", module_version="1.0.0",
        status=result.status.value, input_data=payload,
        output_data=data, warnings=result.warnings,
    )
    return result
