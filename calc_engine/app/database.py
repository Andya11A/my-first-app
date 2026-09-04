"""SQLAlchemy 数据库接入 —— PostgreSQL（生产），计算记录持久化。

当前阶段仅持久化"计算记录"（审计与追溯用），计算引擎本身不依赖数据库：
DATABASE_URL 未配置或连接失败时，系统仍可正常对外提供计算服务。
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Iterator, Optional

from sqlalchemy import JSON, DateTime, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

engine = None
SessionLocal: Optional[sessionmaker] = None
if settings.database_url:
    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
        SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    except Exception as exc:  # pragma: no cover
        logger.warning("数据库初始化失败，计算记录将不落库: %s", exc)


class Base(DeclarativeBase):
    pass


class CalculationRecord(Base):
    """计算记录表：每次专业计算调用留存输入/输出快照，供审计与方案回溯。"""

    __tablename__ = "calculation_record"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    module: Mapped[str] = mapped_column(String(32), index=True)
    module_version: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16))
    input_json: Mapped[dict] = mapped_column(JSON)
    output_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    warnings_json: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


def get_db() -> Iterator[Optional[Session]]:
    """FastAPI 依赖：未配置数据库时 yield None（计算照常执行）。"""
    if SessionLocal is None:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def save_calculation_record(
    db: Optional[Session],
    *,
    module: str,
    module_version: str,
    status: str,
    input_data: Any,
    output_data: Any = None,
    warnings: Any = None,
) -> Optional[int]:
    """尽力落库：db 为 None 或写库异常时静默降级，不影响计算响应。"""
    if db is None:
        return None
    try:

        def _to_jsonable(obj: Any) -> Any:
            """pydantic 模型与普通 dict/list 均可序列化。"""
            if hasattr(obj, "model_dump_json"):
                return json.loads(obj.model_dump_json())
            return json.loads(json.dumps(obj, ensure_ascii=False, default=str))

        record = CalculationRecord(
            module=module,
            module_version=module_version,
            status=status,
            input_json=_to_jsonable(input_data),
            output_json=_to_jsonable(output_data) if output_data is not None else None,
            warnings_json=[w.model_dump() for w in (warnings or [])],
        )
        db.add(record)
        db.commit()
        return record.id
    except Exception as exc:  # noqa: BLE001
        logger.warning("计算记录写入失败: %s", exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
        return None
