"""装饰装修工程量计算模块入参/出参数据模型 (Pydantic)。

依据规范：
- GB 50210-2018《建筑装饰装修工程质量验收标准》
- GB 50346-2011《生物安全实验室建筑技术规范》
- GB 50016-2014(2018版)《建筑设计防火规范》
- GB 50325-2020《民用建筑工程室内环境污染控制标准》
"""
from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class RoomType(str, Enum):
    """房间类型 —— 决定地面/墙面/吊顶/门窗材料选型。"""

    CHEMICAL_LAB = "chemical_lab"   # 化学实验室
    BIO_LAB = "bio_lab"             # 生物实验室
    CLEANROOM = "cleanroom"         # 洁净室
    OFFICE = "office"               # 办公区
    CORRIDOR = "corridor"           # 走廊


# ==================== 入参 ====================


class RoomParam(BaseModel):
    """单房间装修参数。"""

    name: str = Field(..., description="房间名称")
    area: float = Field(..., gt=0, le=5000, description="房间面积 m²")
    perimeter_m: Optional[float] = Field(
        None, gt=0, le=500, description="房间周长 m（墙裙/踢脚线计算用，无则按面积反算 ≈4×√area）"
    )
    height_m: Optional[float] = Field(
        None, gt=0, le=10, description="房间净高 m（墙面面积计算用，无则按 3.0m 估算）"
    )
    ceiling_height: Optional[float] = Field(
        None, gt=0, le=10, description="吊顶下方高度 m（吊顶选型参考）"
    )
    room_type: RoomType = Field(..., description="房间类型")
    door_count: int = Field(1, ge=0, le=50, description="门数量")
    window_count: int = Field(0, ge=0, le=100, description="窗数量")
    has_cleanroom: bool = Field(False, description="是否洁净/BSL 实验室（影响墙面/门窗选型）")
    has_anti_static: bool = Field(False, description="是否防静电（精密仪器室，地面选防静电材料）")


class DecorationInput(BaseModel):
    """装修工程量计算入参：房间清单。"""

    rooms: List[RoomParam] = Field(..., min_length=1, description="房间清单")


# ==================== 出参：各分项结果 ====================


class FloorResult(BaseModel):
    """地面工程量结果。"""

    recommended_material: str = Field(..., description="推荐地面材料")
    area_m2: float = Field(..., description="地面材料面积 m²（含损耗）")
    skirt_length_m: float = Field(..., description="踢脚线长度 m")
    weld_seam_length_m: float = Field(..., description="PVC 焊缝长度 m（非 PVC 材料为 0）")
    unit_price_yuan_m2: float = Field(..., description="材料单价 元/m²")
    subtotal_yuan: float = Field(..., description="小计 元")
    regulation_reference: str = Field(..., description="选型依据规范条款")


class WallResult(BaseModel):
    """墙面工程量结果。"""

    recommended_material: str = Field(..., description="推荐墙面材料")
    wall_area_m2: float = Field(..., description="墙面面积 m²")
    skirt_area_m2: float = Field(..., description="墙裙面积 m²（化学/生物实验室）")
    upper_paint_area_m2: float = Field(..., description="上部涂料面积 m²")
    color_steel_area_m2: float = Field(..., description="彩钢板面积 m²（洁净室）")
    unit_price_yuan_m2: float = Field(..., description="主要材料单价 元/m²")
    subtotal_yuan: float = Field(..., description="小计 元")
    regulation_reference: str = Field(..., description="选型依据规范条款")


class CeilingResult(BaseModel):
    """吊顶工程量结果。"""

    recommended_material: str = Field(..., description="推荐吊顶材料")
    area_m2: float = Field(..., description="吊顶面积 m²（含损耗）")
    main_keel_length_m: float = Field(..., description="主龙骨长度 m")
    sub_keel_length_m: float = Field(..., description="次龙骨长度 m")
    unit_price_yuan_m2: float = Field(..., description="材料单价 元/m²")
    subtotal_yuan: float = Field(..., description="小计 元")
    regulation_reference: str = Field(..., description="选型依据规范条款")


class DoorWindowResult(BaseModel):
    """门窗工程量结果。"""

    recommended_door_material: str = Field(..., description="推荐门材料")
    recommended_window_material: str = Field(..., description="推荐窗材料")
    door_count: int = Field(..., description="门数量")
    window_count: int = Field(..., description="窗数量")
    door_area_m2: float = Field(..., description="门面积 m²")
    window_area_m2: float = Field(..., description="窗面积 m²")
    door_unit_price_yuan: float = Field(..., description="门单价 元/樘")
    window_unit_price_yuan: float = Field(..., description="窗单价 元/樘")
    subtotal_yuan: float = Field(..., description="小计 元")
    regulation_reference: str = Field(..., description="选型依据规范条款")


class RoomSummary(BaseModel):
    """单房间装修工程量汇总。"""

    name: str
    room_type: RoomType
    floor: FloorResult
    wall: WallResult
    ceiling: CeilingResult
    doors_windows: DoorWindowResult
    room_total_yuan: float = Field(..., description="该房间装修总价 元")


# ==================== 出参：整体汇总 ====================


class MaterialTotalItem(BaseModel):
    """材料总用量项。"""

    name: str = Field(..., description="材料名称")
    area_m2: float = Field(..., description="用量 m²")
    fire_rating: str = Field(..., description="燃烧性能等级（GB 50016：A/B1）")


class DecorationSummary(BaseModel):
    """装修汇总：各材料总用量、总造价估算、燃烧性能等级汇总。"""

    total_floor_area_m2: float = Field(..., description="地面总面积 m²")
    total_wall_area_m2: float = Field(..., description="墙面总面积 m²")
    total_ceiling_area_m2: float = Field(..., description="吊顶总面积 m²")
    total_door_area_m2: float = Field(..., description="门总面积 m²")
    total_window_area_m2: float = Field(..., description="窗总面积 m²")
    material_totals: List[MaterialTotalItem] = Field(..., description="各材料总用量")
    total_cost_yuan: float = Field(..., description="总造价估算 元")
    fire_rating_summary: Dict[str, float] = Field(
        ..., description="按燃烧性能等级汇总用量 m²（GB 50016：A 级 / B1 级）"
    )


class DecorationResult(BaseModel):
    """装修计算结果：各房间明细 + 汇总 + 规范引用 + 公式说明。"""

    rooms: List[RoomSummary]
    summary: DecorationSummary
    regulation_references: List[str] = Field(..., description="计算依据规范编号清单")
    formula_explanations: List[str] = Field(..., description="关键公式与计算步骤说明")
