"""计算书导出API"""
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db, CalculationRecord
from app.services.export_service import build_calculation_report

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/report/{record_id}", summary="导出计算书Word文档")
def export_report(record_id: int, db: Session = Depends(get_db)):
    """根据计算记录ID导出Word计算书"""
    record = db.query(CalculationRecord).filter(CalculationRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    buffer = build_calculation_report(
        module_name=record.module,
        module_version=record.module_version,
        status=record.status,
        input_json=record.input_json or '{}',
        output_json=record.output_json or '{}',
        references=None,
    )

    filename = f"calc-report-{record.module}-{record_id}.docx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
