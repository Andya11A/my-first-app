"""统一计算结果数据模型 (Unified Calculation Result)
====================================================

所有专业模块（暖通/电气/供气/装修/智能化）的计算服务都必须返回
``CalculationResult[T]``，保证平台层（前端/消息/审批流）以完全一致的
格式消费任何专业的计算结果。

统一契约:
{
    "module":   "hvac",                      # 模块标识
    "status":   "success|warning|failed",    # 状态三态
    "data":     { ... },                     # 各模块自定义的业务数据（泛型 T）
    "warnings": [ {"code","message","field"} ],
    "meta": {
        "module_version": "1.0.0",
        "engine_version": "1.0.0",
        "duration_ms": 12.3,
        "calculated_at": "...",
        "references": ["GB 50019-2015", ...]   # 计算依据规范，可追溯
    }
}
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

from app.config import get_settings

DataT = TypeVar("DataT")


class CalculationStatus(str, Enum):
    """计算状态三态。"""

    SUCCESS = "success"   # 计算成功且无告警
    WARNING = "warning"   # 计算成功，但存在需要人工复核的工程告警
    FAILED = "failed"     # 计算失败（参数不满足计算前提），data 为 None


class CalculationWarning(BaseModel):
    """工程告警：不同于异常，表示"算得出来，但要人工注意"。"""

    code: str = Field(..., examples=["HVAC_W001"], description="告警编码，模块前缀_类型_序号")
    message: str = Field(..., description="人类可读的告警说明")
    field: Optional[str] = Field(None, description="关联的入参字段，便于前端定位")


class CalculationMeta(BaseModel):
    """计算元信息：版本、耗时、依据规范 —— 满足设计留痕与审计要求。"""

    module: str
    module_version: str
    engine_version: str = Field(default_factory=lambda: get_settings().engine_version)
    duration_ms: float = 0.0
    calculated_at: datetime = Field(default_factory=datetime.now)
    references: List[str] = Field(default_factory=list, description="计算依据规范编号")
    record_id: Optional[int] = Field(default=None, description="数据库记录ID（用于导出计算书）")
    extra: Optional[Dict[str, Any]] = Field(default=None, description="模块自定义元信息（如实际采用的城市/大气压）")


class CalculationResult(BaseModel, Generic[DataT]):
    """统一计算结果封装（所有专业模块的返回契约）。"""

    module: str = Field(..., description="模块标识: hvac/electrical/gas/decoration/intelligence")
    status: CalculationStatus = CalculationStatus.SUCCESS
    data: Optional[DataT] = None
    warnings: List[CalculationWarning] = Field(default_factory=list)
    meta: Optional[CalculationMeta] = None

    # ---------- 构造工厂，供各 Service 基类调用 ----------

    @classmethod
    def ok(
        cls,
        *,
        module: str,
        module_version: str,
        data: DataT,
        warnings: Optional[List[CalculationWarning]] = None,
        references: Optional[List[str]] = None,
        duration_ms: float = 0.0,
        extra: Optional[Dict[str, Any]] = None,
    ) -> "CalculationResult[DataT]":
        warnings = warnings or []
        return cls(
            module=module,
            status=CalculationStatus.WARNING if warnings else CalculationStatus.SUCCESS,
            data=data,
            warnings=warnings,
            meta=CalculationMeta(
                module=module,
                module_version=module_version,
                duration_ms=round(duration_ms, 2),
                references=references or [],
                extra=extra,
            ),
        )

    @classmethod
    def fail(
        cls,
        *,
        module: str,
        module_version: str,
        message: str,
        code: str = "CALC_E001",
        field: Optional[str] = None,
        references: Optional[List[str]] = None,
        duration_ms: float = 0.0,
    ) -> "CalculationResult[DataT]":
        return cls(
            module=module,
            status=CalculationStatus.FAILED,
            data=None,
            warnings=[CalculationWarning(code=code, message=message, field=field)],
            meta=CalculationMeta(
                module=module,
                module_version=module_version,
                duration_ms=round(duration_ms, 2),
                references=references or [],
            ),
        )
