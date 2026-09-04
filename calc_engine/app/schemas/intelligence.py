"""智能化设计模块 - 输入/输出 Pydantic Schema"""
from __future__ import annotations

from pydantic import BaseModel, Field


class RoomFunction(BaseModel):
    """房间功能描述"""
    name: str = Field(..., description="房间名称/编号")
    function: str = Field("lab", description="功能: lab/office/corridor/warehouse/meeting")
    lab_type: str = Field("chemical", description="若为实验室: chemical/biological/physical")
    area: float = Field(..., description="面积 (m2)")
    count: int = Field(1, description="同类房间数量")


class IntelligenceInput(BaseModel):
    """智能化计算输入"""
    rooms: list[RoomFunction] = Field(..., description="房间功能清单")
    distribution_boxes: int = Field(1, description="配电箱数量 (用于智能电表规划)")
    water_inlets: int = Field(1, description="进水管路数量")


class IntelligenceResultItem(BaseModel):
    """单项计算结果条目"""
    name: str = Field(..., description="条目名称")
    value: float = Field(..., description="数值")
    unit: str = Field(..., description="单位")
    formula: str = Field("", description="计算公式/依据")
    remark: str = Field("", description="备注")


class IntelligenceResult(BaseModel):
    """智能化计算总结果：点位统计 + 环境监控 + 能耗监测"""
    items: list[IntelligenceResultItem] = Field(default_factory=list, description="结果条目")
    summary: dict[str, float] = Field(default_factory=dict, description="关键汇总值")
    formula_notes: list[str] = Field(default_factory=list, description="计算说明与告警")
