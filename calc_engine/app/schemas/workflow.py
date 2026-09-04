"""图纸联动计算模块 - 输入/输出 Pydantic Schema（来源：洁净EPC-AI 朋友项目合并）

输入：图纸识别模块 (drawing /parse) 返回的 JSON（equipments 列表为主）；
输出：每个通风柜的风量计算结果列表。

兼容两种设备图块格式：
    - 朋友版 drawing_parser：xscale / yscale 独立字段
    - calc_engine drawing_parser：scale: [sx, sy] 数组字段
多余字段（walls/doors/windows/warnings/meta 等）由 Pydantic 默认忽略，
前端可直接把 /drawing/parse 的完整响应作为本接口请求体。
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class WorkflowEquipment(BaseModel):
    """设备图块（兼容两种 drawing_parser 输出格式）"""
    name: str = Field(..., description="图块名称，如 'FUME_HOOD' / '通风柜'")
    insert: list[float] = Field(default_factory=lambda: [0.0, 0.0], description="插入点 [x, y]")
    layer: str = Field("", description="图层名")
    rotation: float | None = Field(None, description="旋转角 (度)")
    # 朋友版 drawing_parser 格式
    xscale: float | None = Field(None, description="X 方向缩放（朋友版格式）")
    yscale: float | None = Field(None, description="Y 方向缩放（朋友版格式）")
    # calc_engine drawing_parser 格式
    scale: list[float] | None = Field(None, description="缩放 [sx, sy]（calc_engine 格式）")
    category: str | None = Field(None, description="设备分类（hood/bench/sink/gas/other）")


class WorkflowInput(BaseModel):
    """图纸联动计算输入（即 drawing /parse 输出的全部或部分）"""
    equipments: list[WorkflowEquipment] = Field(default_factory=list, description="设备图块清单")


class FumeHoodAirflow(BaseModel):
    """单台通风柜风量计算结果"""
    name: str = Field(..., description="图块名称")
    position: list[float] = Field(..., description="插入点 [x, y]")
    airflow: float = Field(..., description="所需风量 (m3/h)")
    area: float = Field(..., description="估算占地面积 (m2)")
    height: float = Field(..., description="层高 (m)")
    air_changes: float = Field(..., description="换气次数 (次/h)")
    formula: str | None = Field(None, description="风量计算公式可追溯串")


class WorkflowResult(BaseModel):
    """图纸联动计算总结果"""
    fume_hoods: list[FumeHoodAirflow] = Field(default_factory=list, description="各通风柜风量结果")
    summary: dict[str, Any] = Field(default_factory=dict, description="汇总统计")
    errors: list[str] = Field(default_factory=list, description="处理失败记录 (设备名 + 错误)")
