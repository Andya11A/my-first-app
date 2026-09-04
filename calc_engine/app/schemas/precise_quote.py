"""精确报价引擎 Schema"""
from typing import List, Optional

from pydantic import BaseModel, Field


class PreciseQuoteItemInput(BaseModel):
    """工程量清单项"""
    part_type: str = Field(
        ...,
        description="部位类型：ground地面 / wall墙面 / partition墙体 / ceiling吊顶 / "
                    "door门窗 / countertop台面 / custom自定义",
    )
    material_name: str = Field(..., description="材料名称（从材料库选，支持模糊匹配，如 PVC卷材）")
    quantity: float = Field(..., gt=0, description="工程量（㎡/樘/延米/项，按部位）")
    width_factor: float = Field(
        default=1.0,
        gt=0,
        description="仅台面用：边台1.0 / 仪器台1.2 / 中央台2.0 / 天平台0.8",
    )
    material_grade: Optional[str] = Field(
        default=None,
        description="材料档位（多档价格材料用）：如不锈钢台面 201/304/316L、防火门 甲级/乙级/丙级、"
                    "彩钢板 机制/手工、气密门 国产/中端/高端；不传则取默认（经济/最低档）",
    )


class PreciseQuoteInput(BaseModel):
    """精确报价输入"""
    items: List[PreciseQuoteItemInput] = Field(..., min_length=1, description="工程量清单")
    city: str = Field(default="广州", description="地区（广州/深圳/上海/北京/成都/其他），影响人工费城市系数")
    tax_type: str = Field(default="general", description="计税方式：general一般计税(9%) / simplified简易计税(3%)")


class PreciseQuoteResult(BaseModel):
    """精确报价结果（明细/汇总/三档/元信息）"""
    items: list = Field(default_factory=list, description="逐项计价明细")
    summary: dict = Field(default_factory=dict, description="费用汇总表")
    price_tiers: dict = Field(default_factory=dict, description="低/中/高三档含税总价")
    meta: dict = Field(default_factory=dict, description="地区、费率、计价依据等元信息")
