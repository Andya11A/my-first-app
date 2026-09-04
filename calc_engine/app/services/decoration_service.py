"""装饰装修工程量计算模块 (Decoration Service)
====================================================

从房间清单到地面、墙面、吊顶、门窗工程量与造价估算的自动化计算。
所有预设参数集中在文件顶部常量区，每个计算步骤注释标注具体规范条款。

依据规范：
- GB 50210-2018《建筑装饰装修工程质量验收标准》—— 装修施工与验收
- GB 50346-2011《生物安全实验室建筑技术规范》—— BSL 分级、彩钢板/密闭门/互锁门
- GB 50016-2014(2018版)《建筑设计防火规范》—— 材料燃烧性能等级 A/B1/B2/B3
- GB 50325-2020《民用建筑工程室内环境污染控制标准》—— 室内环保材料选型
"""
from __future__ import annotations

import math

from app.schemas.decoration import (
    CeilingResult,
    DecorationInput,
    DecorationResult,
    DecorationSummary,
    DoorWindowResult,
    FloorResult,
    MaterialTotalItem,
    RoomParam,
    RoomSummary,
    RoomType,
    WallResult,
)


# ==================================================================
#  预设参数常量区（集中定义，便于按规范版本统一升级校准）
# ==================================================================

# ---------- 几何与损耗常量 ----------
DEFAULT_DOOR_WIDTH_M = 1.0          # 默认门宽 m（踢脚线/墙裙扣除）
DEFAULT_DOOR_HEIGHT_M = 2.1         # 默认门高 m
DEFAULT_WINDOW_WIDTH_M = 1.5        # 默认窗宽 m
DEFAULT_WINDOW_HEIGHT_M = 1.5       # 默认窗高 m
DEFAULT_ROOM_HEIGHT_M = 3.0         # 默认房间净高 m（无入参时估算）
FLOOR_WASTE_RATIO = 0.05            # 地面材料损耗率 5%
CEILING_WASTE_RATIO = 0.05          # 吊顶材料损耗率 5%
PVC_ROLL_WIDTH_M = 2.0              # PVC 卷材宽度 m（焊缝间距）
WALL_SKIRT_HEIGHT_M = 1.5           # 墙裙高度 m（化学/生物实验室）
MAIN_KEEL_SPACING_M = 1.2           # 主龙骨间距 m
SUB_KEEL_SPACING_M = 0.6            # 次龙骨间距 m

# ---------- 地面材料选型 —— 引用 GB 50346-2011 / GB 50016-2014(2018版) ----------
# (材料描述, 单价 元/m²)
FLOOR_MATERIAL: dict[str, tuple[str, float]] = {
    "chemical_lab": ("2-3mm 同质透心 PVC 卷材（耐酸碱）", 180.0),   # 化学实验室
    "bio_lab":      ("2mm 同质透心 PVC 卷材（抑菌）", 160.0),        # 生物实验室
    "cleanroom":    ("环氧自流平 / PVC 卷材（无缝，转角 R≥30mm）", 260.0),  # 洁净室
    "office":       ("普通 PVC / 地砖", 90.0),                        # 办公区
    "corridor":     ("普通 PVC / 地砖", 90.0),                        # 走廊
}
# 防静电地面覆盖（精密仪器室，表面电阻 1e6~1e9 Ω）
ANTI_STATIC_FLOOR: tuple[str, float] = ("防静电 PVC / 防静电环氧（表面电阻 1e6~1e9 Ω）", 320.0)

# ---------- 墙面材料选型 —— 引用 GB 50346-2011 / GB 50325-2020 ----------
WALL_MATERIAL: dict[str, tuple[str, float]] = {
    "chemical_lab": ("耐酸碱瓷砖（1.5m 墙裙）+ 上部乳胶漆", 150.0),   # 化学实验室
    "bio_lab":      ("50mm 玻镁彩钢板（表面光滑、转角圆弧）", 280.0),  # 生物实验室
    "cleanroom":    ("50mm 玻镁彩钢板（表面光滑、转角圆弧）", 280.0),  # 洁净室
    "office":       ("乳胶漆（环保，GB 50325）", 60.0),              # 办公区
    "corridor":     ("玻镁彩钢板 / 瓷砖", 220.0),                     # 走廊
}

# ---------- 吊顶材料选型 ----------
CEILING_MATERIAL: dict[str, tuple[str, float]] = {
    "chemical_lab": ("铝扣板吊顶（耐腐蚀）", 180.0),                  # 化学实验室
    "bio_lab":      ("彩钢板吊顶（与墙同材质，密封）", 260.0),         # 生物实验室
    "cleanroom":    ("彩钢板吊顶（与墙同材质，密封）", 260.0),         # 洁净室
    "office":       ("矿棉板 / 石膏板", 90.0),                        # 办公区
    "corridor":     ("矿棉板 / 石膏板", 90.0),                        # 走廊
}

# ---------- 门材料选型 —— 引用 GB 50346-2011 第 5.3 条 / GB 50016-2014(2018版) ----------
# (材料描述, 单价 元/樘)
DOOR_MATERIAL: dict[str, tuple[str, float]] = {
    "cleanroom":    ("不锈钢密闭门（带观察窗）", 4500.0),             # 洁净室门
    "bio_lab":      ("自动互锁门（GB 50346 第 5.3 条）", 8000.0),     # BSL 实验室门
    "chemical_lab": ("钢质防火门（耐火极限≥1h）", 2200.0),           # 化学实验室门
    "office":       ("实木复合 / 钢质门", 1200.0),                    # 普通门
    "corridor":     ("钢质防火门", 2200.0),                           # 走廊门
}
# 窗材料 —— 引用 GB 50189-2015《公共建筑节能设计标准》
WINDOW_MATERIAL: tuple[str, float] = ("断桥铝合金 + 中空玻璃（GB 50189 节能）", 900.0)

# ---------- 材料燃烧性能等级 —— 引用 GB 50016-2014(2018版) ----------
# A 级（不燃）/ B1 级（难燃）
FIRE_RATING: dict[str, str] = {
    "彩钢板": "A",       # 含玻镁彩钢板
    "铝扣板": "A",
    "矿棉板": "B1",
    "石膏板": "B1",
    "PVC": "B1",        # 含防静电 PVC
    "乳胶漆": "B1",
    "瓷砖": "A",        # 含耐酸碱瓷砖
    "环氧": "A",        # 含环氧自流平、防静电环氧
    "不锈钢": "A",
    "断桥铝合金": "A",
    "钢质": "A",        # 含钢质防火门
    "实木复合": "B1",
}


def _fire_rating_of(material_desc: str) -> str:
    """根据材料描述判定燃烧性能等级，引用 GB 50016-2014(2018版)。

    按预设关键字顺序匹配，第一个命中即返回；未命中默认 B1 级（保守）。
    """
    for key, rating in FIRE_RATING.items():
        if key in material_desc:
            return rating
    return "B1"


# ==================================================================
#  核心功能 1：地面工程量计算
# ==================================================================


def calculate_floor(area: float, room_type: str, has_anti_static: bool) -> FloorResult:
    """地面工程量计算，引用 GB 50346-2011 / GB 50016-2014(2018版)。

    - 化学实验室 → 2-3mm 同质透心 PVC 卷材（耐酸碱）
    - 生物实验室 → 2mm 同质透心 PVC 卷材（抑菌）
    - 洁净室 → 环氧自流平 / PVC 卷材（无缝，转角 R≥30mm）
    - 防静电（精密仪器室） → 防静电 PVC / 防静电环氧（表面电阻 1e6~1e9 Ω）
    - 办公区/走廊 → 普通 PVC / 地砖
    """
    # 防静电优先（精密仪器室），其余按 room_type 选型
    if has_anti_static:
        material, unit_price = ANTI_STATIC_FLOOR
    else:
        material, unit_price = FLOOR_MATERIAL[room_type]

    # 地面面积 = area × 1.05（损耗 5%）
    floor_area = area * (1 + FLOOR_WASTE_RATIO)

    # 房间长宽按方形近似：长 = 宽 = √area
    side = math.sqrt(area)
    perimeter = 4 * side  # 周长 ≈ 4 × √area（方形近似）

    # 踢脚线长度 = 周长 − 门宽（门宽默认 1.0m，仅扣除 1 樘门）
    skirt_length = max(perimeter - DEFAULT_DOOR_WIDTH_M, 0.0)

    # PVC 焊缝长度 = 焊缝数 × 房间宽（焊缝数 = ceil(房间长 / 卷材宽 2m)）
    # 仅 PVC 卷材有焊缝；环氧自流平等无缝材料焊缝长度为 0
    if "PVC" in material:
        seam_count = math.ceil(side / PVC_ROLL_WIDTH_M)
        weld_seam_length = float(seam_count) * side
    else:
        weld_seam_length = 0.0

    subtotal = floor_area * unit_price

    return FloorResult(
        recommended_material=material,
        area_m2=round(floor_area, 2),
        skirt_length_m=round(skirt_length, 2),
        weld_seam_length_m=round(weld_seam_length, 2),
        unit_price_yuan_m2=unit_price,
        subtotal_yuan=round(subtotal, 2),
        regulation_reference="GB 50346-2011 / GB 50016-2014(2018版)（地面材料选型与燃烧性能）",
    )


# ==================================================================
#  核心功能 2：墙面工程量计算
# ==================================================================


def calculate_wall(
    wall_area: float,
    room_type: str,
    has_cleanroom: bool,
    perimeter_m: float,
    height_m: float,
    door_area: float,
    window_area: float,
) -> WallResult:
    """墙面工程量计算，引用 GB 50346-2011 / GB 50325-2020。

    - 洁净室/BSL → 50mm 玻镁彩钢板（表面光滑、转角圆弧）
    - 化学实验室 → 耐酸碱瓷砖或彩钢板（1.5m 墙裙 + 上部涂料）
    - 普通实验室/办公 → 乳胶漆（引 GB 50325 环保）
    - 走廊 → 玻镁彩钢板或瓷砖

    工程量：
      墙面面积 = wall_area
      墙裙面积（化学/生物实验室）= 周长 × 1.5 − 门宽 × 1.5（无墙裙则为 0）
      上部涂料面积 = 墙面面积 − 墙裙面积 − 门窗面积
      彩钢板面积（洁净） = 墙面面积
    """
    material, unit_price = WALL_MATERIAL[room_type]

    # 墙裙面积（化学/生物实验室）= 周长 × 1.5 − 门宽 × 1.5
    if room_type in ("chemical_lab", "bio_lab"):
        skirt_area = perimeter_m * WALL_SKIRT_HEIGHT_M - DEFAULT_DOOR_WIDTH_M * WALL_SKIRT_HEIGHT_M
        skirt_area = max(skirt_area, 0.0)
    else:
        skirt_area = 0.0

    # 彩钢板面积（洁净室/BSL）= 墙面面积
    if room_type == "cleanroom" or has_cleanroom:
        color_steel_area = wall_area
    else:
        color_steel_area = 0.0

    # 上部涂料面积 = 墙面面积 − 墙裙面积 − 门窗面积
    upper_paint_area = max(wall_area - skirt_area - door_area - window_area, 0.0)

    subtotal = wall_area * unit_price

    return WallResult(
        recommended_material=material,
        wall_area_m2=round(wall_area, 2),
        skirt_area_m2=round(skirt_area, 2),
        upper_paint_area_m2=round(upper_paint_area, 2),
        color_steel_area_m2=round(color_steel_area, 2),
        unit_price_yuan_m2=unit_price,
        subtotal_yuan=round(subtotal, 2),
        regulation_reference="GB 50346-2011（彩钢板墙裙）/ GB 50325-2020（涂料环保）",
    )


# ==================================================================
#  核心功能 3：吊顶工程量计算
# ==================================================================


def calculate_ceiling(area: float, room_type: str, ceiling_height: float) -> CeilingResult:
    """吊顶工程量计算，引用 GB 50210-2018 / GB 50346-2011。

    - 洁净室 → 彩钢板吊顶（与墙同材质，密封）
    - 化学实验室 → 铝扣板吊顶（耐腐蚀）
    - 普通实验室/办公 → 矿棉板或石膏板

    工程量：
      吊顶面积 = area × 1.05（损耗 5%）
      主龙骨长度 = ceil(长边/1.2) × 宽（间距 1.2m，长宽按 √area 近似）
      次龙骨长度 = ceil(长边/0.6) × 宽（间距 0.6m）
    """
    material, unit_price = CEILING_MATERIAL[room_type]

    # 吊顶面积 = area × 1.05（损耗 5%）
    ceiling_area = area * (1 + CEILING_WASTE_RATIO)

    # 长宽按方形近似：长 = 宽 = √area
    side = math.sqrt(area)

    # 主龙骨数 = ceil(长边 / 1.2)，每根长 = 宽
    main_keel_count = math.ceil(side / MAIN_KEEL_SPACING_M)
    main_keel_length = float(main_keel_count) * side

    # 次龙骨按间距 0.6m
    sub_keel_count = math.ceil(side / SUB_KEEL_SPACING_M)
    sub_keel_length = float(sub_keel_count) * side

    subtotal = ceiling_area * unit_price

    return CeilingResult(
        recommended_material=material,
        area_m2=round(ceiling_area, 2),
        main_keel_length_m=round(main_keel_length, 2),
        sub_keel_length_m=round(sub_keel_length, 2),
        unit_price_yuan_m2=unit_price,
        subtotal_yuan=round(subtotal, 2),
        regulation_reference="GB 50210-2018（吊顶施工验收）/ GB 50346-2011（洁净室密封吊顶）",
    )


# ==================================================================
#  核心功能 4：门窗工程量计算
# ==================================================================


def calculate_doors_windows(
    room_type: str,
    door_count: int,
    window_count: int,
    has_cleanroom: bool,
) -> DoorWindowResult:
    """门窗工程量计算，引用 GB 50346-2011 第 5.3 条 / GB 50016-2014(2018版) / GB 50189。

    - 洁净室门 → 不锈钢密闭门（带观察窗）
    - BSL 实验室门 → 自动互锁门（引 GB 50346 第 5.3 条）
    - 化学实验室门 → 钢质防火门（耐火极限 ≥1h）
    - 普通门 → 实木复合或钢质
    - 窗 → 断桥铝合金 + 中空玻璃（引 GB 50189 节能）

    工程量：
      门面积 = 门宽 1.0 × 门高 2.1 × 数量
      窗面积 = 窗宽 1.5 × 窗高 1.5 × 数量
    """
    # has_cleanroom=True 时统一选不锈钢密闭门；否则按 room_type 选型
    door_key = "cleanroom" if has_cleanroom else room_type
    door_material, door_price = DOOR_MATERIAL[door_key]

    window_material, window_price = WINDOW_MATERIAL

    # 门面积 = 门宽 1.0 × 门高 2.1 × 数量
    door_area = DEFAULT_DOOR_WIDTH_M * DEFAULT_DOOR_HEIGHT_M * door_count
    # 窗面积 = 窗宽 1.5 × 窗高 1.5 × 数量
    window_area = DEFAULT_WINDOW_WIDTH_M * DEFAULT_WINDOW_HEIGHT_M * window_count

    subtotal = door_price * door_count + window_price * window_count

    return DoorWindowResult(
        recommended_door_material=door_material,
        recommended_window_material=window_material,
        door_count=door_count,
        window_count=window_count,
        door_area_m2=round(door_area, 2),
        window_area_m2=round(window_area, 2),
        door_unit_price_yuan=door_price,
        window_unit_price_yuan=window_price,
        subtotal_yuan=round(subtotal, 2),
        regulation_reference="GB 50346-2011 第 5.3 条（互锁门）/ GB 50016-2014(2018版)（防火门）/ GB 50189（节能窗）",
    )


# ==================================================================
#  核心功能 5：装修汇总
# ==================================================================


def _resolve_geometry(room: RoomParam) -> tuple[float, float, float, float, float]:
    """反算房间几何：周长、净高、墙面面积、门面积、窗面积。"""
    # 周长：有入参则用，无则按方形近似 ≈ 4×√area
    perimeter = room.perimeter_m if room.perimeter_m else 4 * math.sqrt(room.area)
    # 净高：有入参则用，无则按默认 3.0m
    height = room.height_m if room.height_m else DEFAULT_ROOM_HEIGHT_M
    # 门面积 / 窗面积（按默认洞口尺寸）
    door_area = DEFAULT_DOOR_WIDTH_M * DEFAULT_DOOR_HEIGHT_M * room.door_count
    window_area = DEFAULT_WINDOW_WIDTH_M * DEFAULT_WINDOW_HEIGHT_M * room.window_count
    # 墙面面积 = 周长 × 高 − 门窗洞口
    wall_area = max(perimeter * height - door_area - window_area, 0.0)
    return perimeter, height, wall_area, door_area, window_area


def calculate_decoration_summary(rooms: list[RoomParam]) -> tuple[list[RoomSummary], DecorationSummary]:
    """汇总所有房间工程量与造价。

    输出：各材料总用量、总造价估算、材料燃烧性能等级汇总（引 GB 50016）。
    """
    room_summaries: list[RoomSummary] = []
    # 材料用量累积：材料描述 -> 用量 m²
    material_acc: dict[str, float] = {}

    def _add(name: str, area: float) -> None:
        if area <= 0:
            return
        material_acc[name] = material_acc.get(name, 0.0) + area

    # 各分项面积累加
    total_floor = 0.0
    total_wall = 0.0
    total_ceiling = 0.0
    total_door = 0.0
    total_window = 0.0
    total_cost = 0.0

    for r in rooms:
        room_type = r.room_type.value
        perimeter, height, wall_area, door_area, window_area = _resolve_geometry(r)

        # 1) 地面
        floor = calculate_floor(r.area, room_type, r.has_anti_static)
        # 2) 墙面
        wall = calculate_wall(
            wall_area=wall_area,
            room_type=room_type,
            has_cleanroom=r.has_cleanroom,
            perimeter_m=perimeter,
            height_m=height,
            door_area=door_area,
            window_area=window_area,
        )
        # 3) 吊顶
        ceiling = calculate_ceiling(r.area, room_type, r.ceiling_height or 0.0)
        # 4) 门窗
        doors_windows = calculate_doors_windows(
            room_type=room_type,
            door_count=r.door_count,
            window_count=r.window_count,
            has_cleanroom=r.has_cleanroom,
        )

        room_total = (
            floor.subtotal_yuan + wall.subtotal_yuan + ceiling.subtotal_yuan + doors_windows.subtotal_yuan
        )

        room_summaries.append(
            RoomSummary(
                name=r.name,
                room_type=r.room_type,
                floor=floor,
                wall=wall,
                ceiling=ceiling,
                doors_windows=doors_windows,
                room_total_yuan=room_total,
            )
        )

        # 累加材料用量
        _add(floor.recommended_material, floor.area_m2)
        if wall.color_steel_area_m2 > 0:
            _add("50mm 玻镁彩钢板", wall.color_steel_area_m2)
        if wall.skirt_area_m2 > 0:
            _add("耐酸碱瓷砖（墙裙）", wall.skirt_area_m2)
        if wall.upper_paint_area_m2 > 0:
            _add("乳胶漆（上部）", wall.upper_paint_area_m2)
        _add(ceiling.recommended_material, ceiling.area_m2)
        if doors_windows.door_area_m2 > 0:
            _add(doors_windows.recommended_door_material, doors_windows.door_area_m2)
        if doors_windows.window_area_m2 > 0:
            _add(doors_windows.recommended_window_material, doors_windows.window_area_m2)

        # 累加总量
        total_floor += floor.area_m2
        total_wall += wall.wall_area_m2
        total_ceiling += ceiling.area_m2
        total_door += doors_windows.door_area_m2
        total_window += doors_windows.window_area_m2
        total_cost += room_total

    # 材料总用量列表（带燃烧性能等级）
    material_totals = [
        MaterialTotalItem(
            name=n,
            area_m2=round(a, 2),
            fire_rating=_fire_rating_of(n),
        )
        for n, a in material_acc.items()
    ]

    # 燃烧性能等级汇总（GB 50016：A 级 / B1 级）
    fire_summary: dict[str, float] = {}
    for mt in material_totals:
        fire_summary[mt.fire_rating] = fire_summary.get(mt.fire_rating, 0.0) + mt.area_m2
    fire_summary = {k: round(v, 2) for k, v in fire_summary.items()}

    summary = DecorationSummary(
        total_floor_area_m2=round(total_floor, 2),
        total_wall_area_m2=round(total_wall, 2),
        total_ceiling_area_m2=round(total_ceiling, 2),
        total_door_area_m2=round(total_door, 2),
        total_window_area_m2=round(total_window, 2),
        material_totals=material_totals,
        total_cost_yuan=round(total_cost, 2),
        fire_rating_summary=fire_summary,
    )
    return room_summaries, summary


# ==================================================================
#  编排函数：组合五大功能 + 规范引用 + 公式说明
# ==================================================================


DECORATION_REGULATION_REFERENCES = [
    "GB 50210-2018《建筑装饰装修工程质量验收标准》",
    "GB 50346-2011《生物安全实验室建筑技术规范》",
    "GB 50016-2014（2018版）《建筑设计防火规范》",
    "GB 50325-2020《民用建筑工程室内环境污染控制标准》",
]

DECORATION_FORMULA_EXPLANATIONS = [
    "地面面积 = area × 1.05（5% 损耗）",
    "踢脚线长度 = 周长 − 门宽（周长 ≈ 4×√area，方形近似，门宽默认 1.0m）",
    "PVC 焊缝长度 = 焊缝数 × 房间宽（焊缝数 = ceil(长/2m)，仅 PVC 卷材有焊缝）",
    "墙裙面积 = 周长 × 1.5 − 门宽 × 1.5（化学/生物实验室，墙裙高 1.5m）",
    "上部涂料面积 = 墙面面积 − 墙裙面积 − 门窗面积",
    "彩钢板面积 = 墙面面积（洁净室/BSL，GB 50346-2011）",
    "吊顶面积 = area × 1.05（5% 损耗）",
    "主龙骨长度 = ceil(长/1.2) × 宽（间距 1.2m，长宽按 √area 近似）",
    "次龙骨长度 = ceil(长/0.6) × 宽（间距 0.6m）",
    "门面积 = 1.0 × 2.1 × 数量；窗面积 = 1.5 × 1.5 × 数量",
    "墙面面积 = 周长 × 净高 − 门窗洞口面积",
    "燃烧性能等级：彩钢板/铝扣板/瓷砖/环氧/不锈钢 A 级；矿棉板/PVC/乳胶漆 B1 级（GB 50016）",
]


def calculate_decoration(inp: DecorationInput) -> DecorationResult:
    """装修工程量计算主入口：地面 → 墙面 → 吊顶 → 门窗 → 汇总。"""
    rooms, summary = calculate_decoration_summary(inp.rooms)
    return DecorationResult(
        rooms=rooms,
        summary=summary,
        regulation_references=DECORATION_REGULATION_REFERENCES,
        formula_explanations=DECORATION_FORMULA_EXPLANATIONS,
    )
