"""计算记录查询API"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db, CalculationRecord

router = APIRouter(prefix="/records", tags=["records"])


def _serialize(r: CalculationRecord) -> dict:
    """序列化单条记录（warnings_json 映射为 warnings；模型无 duration_ms 列返回 None）"""
    return {
        "id": r.id,
        "module": r.module,
        "module_version": r.module_version,
        "status": r.status,
        "input_json": r.input_json,
        "output_json": r.output_json,
        "warnings": r.warnings_json,
        "duration_ms": None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/", summary="查询计算记录（支持筛选+分页）")
def list_records(
    db: Optional[Session] = Depends(get_db),
    module: Optional[str] = Query(default=None, description="模块名筛选"),
    status: Optional[str] = Query(default=None, description="状态筛选：success/warning/error"),
    limit: int = Query(default=20, ge=1, le=200, description="每页数量"),
    offset: int = Query(default=0, ge=0, description="偏移量"),
):
    """查询历史计算记录"""
    if db is None:
        raise HTTPException(status_code=503, detail="数据库未配置")

    query = select(CalculationRecord)
    if module:
        query = query.where(CalculationRecord.module == module)
    if status:
        query = query.where(CalculationRecord.status == status)

    count_query = select(func.count()).select_from(CalculationRecord)
    if module:
        count_query = count_query.where(CalculationRecord.module == module)
    if status:
        count_query = count_query.where(CalculationRecord.status == status)
    total = db.scalar(count_query) or 0
    records = db.scalars(
        query.order_by(CalculationRecord.created_at.desc()).offset(offset).limit(limit)
    ).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": [_serialize(r) for r in records],
    }


@router.get("/{record_id}", summary="查询单条计算记录详情")
def get_record(record_id: int, db: Optional[Session] = Depends(get_db)):
    """查询单条计算记录"""
    if db is None:
        raise HTTPException(status_code=503, detail="数据库未配置")

    r = db.get(CalculationRecord, record_id)
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")

    return _serialize(r)
