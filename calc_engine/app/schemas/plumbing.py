"""给排水模块 - 输入/输出 Pydantic Schema

依《建筑给水排水设计标准》GB 50015-2019 需要系数思路：
    Q_total = Σ q_i                    总排水流量 (L/s)
    管径 DN 按流量对照表选取（模拟数据，可替换数据库）
    坡度按排水类型取最小坡度（防沉积/自清）
    流速校核：假设充满度 h/D=0.5，v = Q / A_half ∈ [0.6, 2.5] m/s
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class PlumbingEquipment(BaseModel):
    """单台排水设备"""
    name: str = Field(..., description="设备名称")
    drainage_l_s: float = Field(0.5, ge=0, description="排水流量 (L/s)，默认 0.5")
    drainage_type: str = Field(
        "waste",
        description="排水类型: waste(生活废水) / acid(酸性废水) / organic(有机废水)",
    )


class PlumbingInput(BaseModel):
    """给排水计算输入"""
    equipment: list[PlumbingEquipment] = Field(..., description="设备清单")
    # 预留：室内温度/管材偏好等扩展参数
    velocity_min: float = Field(0.6, description="自清流速下限 (m/s)")
    velocity_max: float = Field(2.5, description="流速上限 (m/s)")


class FlowData(BaseModel):
    """流量汇总"""
    total_l_s: float = Field(..., description="总排水流量 Q_total (L/s)")
    equipment_count: int = Field(..., description="设备数量")
    by_type: dict[str, float] = Field(
        default_factory=dict, description="按排水类型汇总 {waste: x, acid: y, ...}")
    mixed_types: bool = Field(..., description="是否存在多种排水类型（需分质排水时提示）")


class PipeSelection(BaseModel):
    """管径选型结果"""
    dn_mm: int = Field(..., description="公称管径 DN (mm)")
    label: str = Field(..., description="管径标签，如 'DN50'")
    basis: str = Field(..., description="选型依据（流量区间）")


class SlopeSelection(BaseModel):
    """坡度选型结果"""
    value: float = Field(..., description="推荐坡度 i (m/m)，如 0.026")
    permille: float = Field(..., description="坡度 (‰)，便于施工放线")
    basis: str = Field(..., description="取值依据（类型最小坡度规则）")


class VelocityCheck(BaseModel):
    """流速校核（充满度 0.5）"""
    velocity: float = Field(..., description="校核流速 v (m/s)")
    fullness: float = Field(0.5, description="假设充满度 h/D")
    flow_area_m2: float = Field(..., description="过水断面积 (m²)")
    ok: bool = Field(..., description="是否在允许区间 [v_min, v_max]")
    remark: str = Field("", description="校核说明（偏低时建议加大坡度等）")


class MaterialRecommendation(BaseModel):
    """管材推荐"""
    name: str = Field(..., description="推荐材质，如 'UPVC (硬聚氯乙烯)'")
    code: str = Field(..., description="材质代码，如 'UPVC'")
    alternatives: list[str] = Field(default_factory=list, description="备选材质")
    note: str = Field("", description="选材说明")


class PlumbingResult(BaseModel):
    """给排水计算总结果：流量 + 管径 + 坡度 + 流速校核 + 材质 + 公式说明"""
    flow: FlowData
    pipe: PipeSelection
    slope: SlopeSelection
    velocity: VelocityCheck
    material: MaterialRecommendation
    formula_notes: list[str] = Field(default_factory=list, description="计算公式与选型依据说明")
