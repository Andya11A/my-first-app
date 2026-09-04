"""DXF 图纸解析模块 (Drawing Parser Service)
=============================================

专业职责：解析上传的 DXF 图纸文件，提取墙体、门窗、设备图块等关键信息，
转换为标准 JSON 数据格式，供前端画布进行重绘。

DXF 实体类型速查（ezdxf 视角）
-------------------------------
- LINE        直线实体，由 start/end 两个 3D 点定义，是墙线最常见的表达方式
- LWPOLYLINE  轻量多段线，一组连续的 2D 顶点，可闭合；常用于墙体外轮廓
- ARC         圆弧实体，由 center/radius/start_angle/end_angle 定义；
              建筑制图中常用来表示门的开启轨迹（90° 弧）
- CIRCLE      圆实体，center + radius；偶尔出现在门窗符号中
- INSERT      图块引用实体（Block Reference），将预定义图块插入到图纸中；
              dxf.name 是图块名，dxf.insert 是插入点坐标
              实验室图纸中的通风柜、实验台、洗手台等设备通常以 INSERT 形式存在
- POLYLINE    （旧版） heavyweight 多段线，3D 版本，功能类似 LWPOLYLINE

图层命名约定（行业惯例）
------------------------
- WALL / A-WALL / 墙体    → 墙体线段
- DOOR / A-DOOR / 门      → 门（ARC 为开启轨迹）
- WINDOW / A-WIN / 窗     → 窗框
- 设备图块名通常含通风柜/实验台/FOOD/HOOD/BENCH 等关键词
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import ezdxf
from ezdxf.entities import DXFGraphic
from ezdxf.layouts import Modelspace


# ==================== 数据结构 ====================


@dataclass
class WallSegment:
    """一段墙线：起点和终点坐标。"""

    start: Tuple[float, float]
    end: Tuple[float, float]
    layer: str = ""
    thickness: Optional[float] = None  # 墙厚（mm），来自图层名或线宽推断

    def to_dict(self) -> dict:
        return {
            "start": list(self.start),
            "end": list(self.end),
            "layer": self.layer,
            "thickness": self.thickness,
        }


@dataclass
class DoorWindow:
    """门或窗：位置、尺寸、类型。"""

    type: str  # "door" / "window"
    layer: str
    # 位置与尺寸（前端重绘用）
    center: Optional[Tuple[float, float]] = None  # 中心点
    width: Optional[float] = None  # 宽度（mm）
    height: Optional[float] = None  # 高度（mm），窗有标高
    # 几何细节
    points: List[Tuple[float, float]] = field(default_factory=list)  # 构成轮廓的点集
    # 门特有
    arc_center: Optional[Tuple[float, float]] = None  # 弧心（开启轨迹）
    arc_radius: Optional[float] = None
    arc_start_angle: Optional[float] = None  # 度
    arc_end_angle: Optional[float] = None

    def to_dict(self) -> dict:
        d: Dict[str, Any] = {
            "type": self.type,
            "layer": self.layer,
            "points": [list(p) for p in self.points],
        }
        if self.center is not None:
            d["center"] = list(self.center)
        if self.width is not None:
            d["width"] = round(self.width, 2)
        if self.height is not None:
            d["height"] = round(self.height, 2)
        if self.arc_center is not None:
            d["arc_center"] = list(self.arc_center)
            d["arc_radius"] = round(self.arc_radius or 0, 2)
            d["arc_start_angle"] = round(self.arc_start_angle or 0, 2)
            d["arc_end_angle"] = round(self.arc_end_angle or 0, 2)
        return d


@dataclass
class Equipment:
    """设备图块：图块名、插入点、缩放、旋转。"""

    name: str  # 图块名（dxf.name），如 "VENTILATION_HOOD"
    insert: Tuple[float, float]  # 插入点坐标（dxf.insert 投影到 2D）
    layer: str = ""
    rotation: float = 0.0  # 旋转角度（度）
    scale_x: float = 1.0
    scale_y: float = 1.0
    # 设备分类（基于图块名关键词推断）
    category: str = "other"  # hood(通风柜) / bench(实验台) / sink(水槽) / gas(气瓶) / other

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "insert": list(self.insert),
            "layer": self.layer,
            "rotation": round(self.rotation, 2),
            "scale": [self.scale_x, self.scale_y],
            "category": self.category,
        }


@dataclass
class ParseResult:
    """图纸解析结果。"""

    walls: List[WallSegment] = field(default_factory=list)
    doors: List[DoorWindow] = field(default_factory=list)
    windows: List[DoorWindow] = field(default_factory=list)
    equipments: List[Equipment] = field(default_factory=list)
    # 元信息
    file_name: str = ""
    entity_count: int = 0  # 模型空间总实体数
    layers: List[str] = field(default_factory=list)  # 涉及的图层名
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "walls": [w.to_dict() for w in self.walls],
            "doors": [d.to_dict() for d in self.doors],
            "windows": [w.to_dict() for w in self.windows],
            "equipments": [e.to_dict() for e in self.equipments],
            "meta": {
                "file_name": self.file_name,
                "entity_count": self.entity_count,
                "layers": self.layers,
                "wall_count": len(self.walls),
                "door_count": len(self.doors),
                "window_count": len(self.windows),
                "equipment_count": len(self.equipments),
                "warnings": self.warnings,
            },
        }


# ==================== 关键词与辅助 ====================

# 墙体图层关键词（不区分大小写匹配）
WALL_KEYWORDS = ("wall", "墙体", "墙")

# 门图层关键词
DOOR_KEYWORDS = ("door", "门", "gate")

# 窗图层关键词
WINDOW_KEYWORDS = ("window", "win", "窗", "玻璃")

# 设备图块名关键词 → 分类
EQUIPMENT_KEYWORD_MAP = {
    "hood": ("hood", "通风柜", "通风橱", "fume"),
    "bench": ("bench", "实验台", "table", "台面", "工作台"),
    "sink": ("sink", "水槽", "水池", "wash", "洗手"),
    "gas": ("gas", "气瓶", "cylinder", "供气", "汇流"),
    "emergency": ("emergency", "紧急", "洗眼", "eyewash", "shower"),
    "power": ("power", "配电", "插座", "outlet", "电气"),
}


def _layer_matches(layer: str, keywords: Tuple[str, ...]) -> bool:
    """判断图层名是否包含任一关键词（不区分大小写）。"""
    low = (layer or "").lower()
    return any(kw.lower() in low for kw in keywords)


def _classify_equipment(block_name: str) -> str:
    """根据图块名关键词推断设备分类。"""
    low = (block_name or "").lower()
    for cat, kws in EQUIPMENT_KEYWORD_MAP.items():
        if any(kw.lower() in low for kw in kws):
            return cat
    return "other"


def _distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """两点间欧氏距离。"""
    return math.hypot(p2[0] - p1[0], p2[1] - p1[1])


def _bbox_center(points: List[Tuple[float, float]]) -> Optional[Tuple[float, float]]:
    """计算点集包围盒中心。"""
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)


def _bbox_size(points: List[Tuple[float, float]]) -> Tuple[Optional[float], Optional[float]]:
    """计算点集包围盒宽高。"""
    if not points:
        return None, None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return max(xs) - min(xs), max(ys) - min(ys)


# ==================== 核心解析逻辑 ====================


def _parse_walls(msp: Modelspace, result: ParseResult) -> None:
    """墙体识别：遍历 LINE 和 LWPOLYLINE，按图层名或线宽特征识别墙体线段。"""
    for ent in msp:
        dxftype = ent.dxftype()
        layer = ent.dxf.get("layer", "")

        # 策略：图层名含 WALL 关键词，或线宽 >= 0.35mm（建筑墙线惯例）
        is_wall_layer = _layer_matches(layer, WALL_KEYWORDS)
        line_weight = ent.dxf.get("lineweight", 0)  # ezdxf 线宽单位 1/100mm
        is_thick_line = line_weight >= 35  # >= 0.35mm

        if not (is_wall_layer or is_thick_line):
            continue

        if dxftype == "LINE":
            # LINE 实体：start/end 两点定义一条线段
            s = ent.dxf.start
            e = ent.dxf.end
            result.walls.append(
                WallSegment(
                    start=(float(s.x), float(s.y)),
                    end=(float(e.x), float(e.y)),
                    layer=layer,
                    thickness=float(line_weight) / 100 if line_weight else None,
                )
            )

        elif dxftype == "LWPOLYLINE":
            # LWPOLYLINE 轻量多段线：一组 2D 顶点，相邻顶点连成墙线
            pts = [(float(p[0]), float(p[1])) for p in ent.get_points()]
            # 闭合多段线：最后一点连回第一点
            closed = bool(ent.closed) if hasattr(ent, "closed") else False
            seg_count = len(pts) if closed else len(pts) - 1
            for i in range(seg_count):
                p1 = pts[i]
                p2 = pts[(i + 1) % len(pts)]
                if _distance(p1, p2) < 0.01:
                    continue  # 跳过零长线段
                result.walls.append(
                    WallSegment(start=p1, end=p2, layer=layer,
                                thickness=float(line_weight) / 100 if line_weight else None)
                )

        elif dxftype == "POLYLINE":
            # 旧版 heavyweight 多段线（3D），顶点存于关联子实体
            pts = []
            for v in ent.vertices:
                pts.append((float(v.dxf.location.x), float(v.dxf.location.y)))
            closed = bool(ent.is_closed) if hasattr(ent, "is_closed") else False
            seg_count = len(pts) if closed else len(pts) - 1
            for i in range(seg_count):
                p1 = pts[i]
                p2 = pts[(i + 1) % len(pts)]
                if _distance(p1, p2) < 0.01:
                    continue
                result.walls.append(
                    WallSegment(start=p1, end=p2, layer=layer,
                                thickness=float(line_weight) / 100 if line_weight else None)
                )


def _parse_doors_and_windows(msp: Modelspace, result: ParseResult) -> None:
    """门窗识别：按图层关键词区分门/窗，提取几何信息。"""
    for ent in msp:
        dxftype = ent.dxftype()
        layer = ent.dxf.get("layer", "")

        is_door = _layer_matches(layer, DOOR_KEYWORDS)
        is_window = _layer_matches(layer, WINDOW_KEYWORDS)
        if not (is_door or is_window):
            continue

        target_type = "door" if is_door else "window"

        if dxftype == "ARC":
            # ARC 圆弧：建筑制图中通常代表门的开启轨迹
            # center + radius + start_angle/end_angle（度）
            c = ent.dxf.center
            r = float(ent.dxf.radius)
            sa = float(ent.dxf.start_angle)
            ea = float(ent.dxf.end_angle)
            # 弧的两端点
            p1 = (c.x + r * math.cos(math.radians(sa)), c.y + r * math.sin(math.radians(sa)))
            p2 = (c.x + r * math.cos(math.radians(ea)), c.y + r * math.sin(math.radians(ea)))
            # 门宽 ≈ 弦长
            door_width = _distance(p1, p2)
            dw = DoorWindow(
                type=target_type,
                layer=layer,
                center=(float(c.x), float(c.y)),
                width=door_width,
                points=[p1, p2],
                arc_center=(float(c.x), float(c.y)),
                arc_radius=r,
                arc_start_angle=sa,
                arc_end_angle=ea,
            )
            if is_door:
                result.doors.append(dw)
            else:
                result.windows.append(dw)

        elif dxftype == "LINE":
            # LINE：门窗框的一条边
            s = ent.dxf.start
            e = ent.dxf.end
            pts = [(float(s.x), float(s.y)), (float(e.x), float(e.y))]
            dw = DoorWindow(
                type=target_type, layer=layer,
                center=_bbox_center(pts), width=_distance(pts[0], pts[1]),
                points=pts,
            )
            if is_door:
                result.doors.append(dw)
            else:
                result.windows.append(dw)

        elif dxftype in ("LWPOLYLINE", "POLYLINE"):
            # 多段线：门窗框轮廓（矩形或自定义形状）
            if dxftype == "LWPOLYLINE":
                pts = [(float(p[0]), float(p[1])) for p in ent.get_points()]
            else:
                pts = [(float(v.dxf.location.x), float(v.dxf.location.y)) for v in ent.vertices]
            w, h = _bbox_size(pts)
            dw = DoorWindow(
                type=target_type, layer=layer,
                center=_bbox_center(pts), width=w, height=h, points=pts,
            )
            if is_door:
                result.doors.append(dw)
            else:
                result.windows.append(dw)

        elif dxftype == "CIRCLE":
            # CIRCLE：偶尔用于圆形窗或门符号
            c = ent.dxf.center
            r = float(ent.dxf.radius)
            dw = DoorWindow(
                type=target_type, layer=layer,
                center=(float(c.x), float(c.y)), width=2 * r, height=2 * r,
                points=[(float(c.x) - r, float(c.y)), (float(c.x) + r, float(c.y))],
            )
            if is_door:
                result.doors.append(dw)
            else:
                result.windows.append(dw)

        elif dxftype == "INSERT":
            # 图块引用：门/窗可能被做成块插入
            name = ent.dxf.get("name", "")
            ins = ent.dxf.insert
            dw = DoorWindow(
                type=target_type, layer=layer,
                center=(float(ins.x), float(ins.y)), points=[(float(ins.x), float(ins.y))],
            )
            if is_door:
                result.doors.append(dw)
            else:
                result.windows.append(dw)


def _parse_equipments(msp: Modelspace, result: ParseResult) -> None:
    """设备图块识别：遍历 INSERT 实体，提取图块名和插入点。"""
    for ent in msp:
        if ent.dxftype() != "INSERT":
            continue
        # INSERT 实体（图块引用）：dxf.name 是被引用的图块定义名
        block_name = ent.dxf.get("name", "")
        if not block_name:
            continue
        # 跳过明显是门窗的图块（已在门窗逻辑中处理）
        layer = ent.dxf.get("layer", "")
        if _layer_matches(layer, DOOR_KEYWORDS) or _layer_matches(layer, WINDOW_KEYWORDS):
            continue
        # dxf.insert 是插入点（3D），投影到 2D
        ins = ent.dxf.insert
        eq = Equipment(
            name=block_name,
            insert=(float(ins.x), float(ins.y)),
            layer=layer,
            rotation=float(ent.dxf.get("rotation", 0)),
            scale_x=float(ent.dxf.get("xscale", 1)),
            scale_y=float(ent.dxf.get("yscale", 1)),
            category=_classify_equipment(block_name),
        )
        result.equipments.append(eq)


# ==================== 主入口函数 ====================


def parse_dxf_to_json(file_path: str) -> dict:
    """主函数：读取 DXF 文件，调用各识别功能，返回结构化字典。

    Args:
        file_path: DXF 文件路径

    Returns:
        包含 walls / doors / windows / equipments / meta 的字典
    """
    result = ParseResult(file_name=file_path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1])

    try:
        # ezdxf.readfile 自动检测 DXF 版本与编码；
        # legacy 模式兼容 R12 等老格式
        doc = ezdxf.readfile(file_path)
    except ezdxf.DXFStructureError as e:
        # DXF 文件结构损坏
        result.warnings.append(f"DXF 文件结构错误: {e}")
        return result.to_dict()
    except Exception as e:
        # 编码错误、IO 错误等
        result.warnings.append(f"读取 DXF 文件失败: {e}")
        return result.to_dict()

    # 获取模型空间（Modelspace）—— 图纸的主要绘制区域
    # 布局空间（Paper/Layout）是打印排版，不含设计图形
    msp = doc.modelspace()

    # 统计实体数与图层
    all_entities: List[DXFGraphic] = list(msp)
    result.entity_count = len(all_entities)
    layer_set = set()
    for ent in all_entities:
        layer_set.add(ent.dxf.get("layer", ""))
    result.layers = sorted(layer_set)

    # 依次执行三类识别
    _parse_walls(msp, result)
    _parse_doors_and_windows(msp, result)
    _parse_equipments(msp, result)

    # 如果墙线为零但图层名里没有 WALL，提示可能图层命名不规范
    if not result.walls and not any(_layer_matches(l, WALL_KEYWORDS) for l in result.layers):
        result.warnings.append(
            "未识别到墙体。请检查 DXF 图层命名是否包含 WALL/墙体 等关键词，"
            "或墙线线宽是否 >= 0.35mm。"
        )

    return result.to_dict()
