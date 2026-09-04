"""专业计算服务抽象基类 (Base Calculation Service)
==================================================

所有专业模块（暖通/电气/供气/装修/智能化）继承本基类，只需实现
``_calculate()`` 纯计算逻辑，即可自动获得:

1. 统一入口 ``calculate()`` → 返回统一 CalculationResult
2. 自动计时 / 元信息填充 / 规范依据挂载
3. 告警收集机制 (self.warn) → 状态自动升级为 warning
4. 业务异常 (CalculationError) 与未预期异常的分级处理
5. 材料库注入 (self.materials) —— 跨专业特性匹配
"""
from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import ClassVar, Generic, List, Optional, TypeVar

from app.schemas.common import CalculationResult, CalculationWarning
from app.services.material_db import MaterialLibrary, get_material_library

logger = logging.getLogger(__name__)

I = TypeVar("I")   # 入参类型 (Pydantic BaseModel)
O = TypeVar("O")   # 出参类型 (Pydantic BaseModel)


class CalculationError(Exception):
    """业务可预期错误 → 结果标记 FAILED，信息放入 warnings。

    例: 房间无任何排风设备且面积为 0，无法计算。
    """

    def __init__(self, message: str, code: str = "CALC_E001", field: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.field = field


class BaseCalculationService(ABC, Generic[I, O]):
    """专业计算服务基类。

    子类必须声明:
        module_name:    模块标识（与 CalculationResult.module 一致）
        module_version: 公式版本号（公式升级只改版本号，便于结果追溯）
        references:     计算依据规范编号列表
    """

    module_name: ClassVar[str] = "base"
    module_version: ClassVar[str] = "1.0.0"
    references: ClassVar[List[str]] = []

    def __init__(self, material_library: Optional[MaterialLibrary] = None):
        self.materials = material_library or get_material_library()
        self._warnings: List[CalculationWarning] = []

    # ---------- 给子类的工具 ----------

    def warn(self, code: str, message: str, field: Optional[str] = None) -> None:
        """记录工程告警（不中断计算，最终状态升级为 warning）。"""
        self._warnings.append(CalculationWarning(code=code, message=message, field=field))

    @abstractmethod
    def _calculate(self, data: I) -> O:
        """纯计算逻辑，由子类实现。可能抛出 CalculationError。"""

    # ---------- 统一入口 ----------

    def calculate(self, data: I) -> CalculationResult[O]:
        t0 = time.perf_counter()
        self._warnings = []  # 每次计算独立收集告警

        def _duration() -> float:
            return (time.perf_counter() - t0) * 1000.0

        try:
            out = self._calculate(data)
            return CalculationResult.ok(
                module=self.module_name,
                module_version=self.module_version,
                data=out,
                warnings=self._warnings,
                references=self.references,
                duration_ms=_duration(),
            )
        except CalculationError as exc:
            logger.warning("模块 %s 业务计算失败: %s", self.module_name, exc.message)
            return CalculationResult.fail(
                module=self.module_name,
                module_version=self.module_version,
                message=exc.message,
                code=exc.code,
                field=exc.field,
                references=self.references,
                duration_ms=_duration(),
            )
        except Exception:  # noqa: BLE001 —— 兜底：任何模块崩溃都返回统一失败结构
            logger.exception("模块 %s 发生未预期异常", self.module_name)
            return CalculationResult.fail(
                module=self.module_name,
                module_version=self.module_version,
                message="计算发生内部错误，请联系管理员并留存入参",
                code="SYS_E500",
                references=self.references,
                duration_ms=_duration(),
            )
