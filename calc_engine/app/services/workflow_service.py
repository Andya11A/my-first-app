"""
图纸联动计算服务模块 (Workflow Service) —— 来源：洁净EPC-AI 朋友项目合并
==========================================================================
职责：接收图纸识别模块 (drawing /parse) 解析出的 JSON 数据，
     自动筛选通风柜设备，并为每一台通风柜计算所需风量，
     最后整合成结构化列表返回。

主入口：calculate_fume_hood_airflow(parsed_drawing_data) -> dict

设计要点（沿用朋友版）：
- 服务层只依赖 dict (parsed JSON)，不耦合 FastAPI/Pydantic，便于测试。
- 设备筛选：按图块名包含预设关键词 (大小写不敏感、下划线归一)。
- 面积估算：以"标准通风柜宽 × 深为基准，分别乘以缩放系数"；
           缩放兼容两种格式（xscale/yscale 独立字段 或 scale: [sx, sy] 数组），
           缺失或非法时回退默认面积 1.5 m²。
- 风量计算：V = 面积 × 层高 × 换气次数（朋友版调用 hvac_service.calculate_air_volume，
           calc_engine 无该独立函数，在此内联等价实现，公式可追溯）。
- 异常隔离：单台计算失败只记录错误并继续下一台，不中断整批。
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# ============================================================
# 预设配置
# ============================================================

# 通风柜图块名关键词 (匹配即视为通风柜)
FUME_HOOD_KEYWORDS: list[str] = ["FUME HOOD", "通风柜", "FH-", "VENTILATION_HOOD"]

# 标准通风柜基准尺寸 (m)，用于按缩放系数估算占地面积
#   假设图块定义为标准尺寸，scale 通常为 1.0；若按单位块绘制，scale 即实际尺寸。
DEFAULT_HOOD_WIDTH = 1.5   # 宽 (操作面方向)
DEFAULT_HOOD_DEPTH = 0.8   # 深 (纵深方向)

# 无法估算时的回退默认值
DEFAULT_AREA = 1.5         # m²
DEFAULT_HEIGHT = 2.8       # 层高 m
DEFAULT_AIR_CHANGES = 15   # 换气次数 次/h


# ============================================================
# 设备筛选
# ============================================================
def _is_fume_hood(name: str) -> bool:
    """
    判断图块名是否为通风柜：
        大小写不敏感子串匹配；关键词与图块名均先做归一
        （大写 + 下划线/连字符 → 空格），以兼容
        'FUME_HOOD' / 'Fume-Hood' / 'FH-203' / 'FH_10' 等变体。
    任一关键词命中即返回 True。
    """
    if not name:
        return False
    name_norm = str(name).upper().replace("_", " ").replace("-", " ")  # 下划线/连字符归一为空格
    for kw in FUME_HOOD_KEYWORDS:
        kw_norm = kw.upper().replace("_", " ").replace("-", " ")
        if kw_norm in name_norm:
            return True
    return False


# ============================================================
# 面积估算（兼容两种缩放格式）
# ============================================================
def _estimate_area(eq: dict) -> tuple[float, str]:
    """
    由缩放系数估算通风柜占地面积 (m²)：
        估算宽 = 标准宽 × sx
        估算深 = 标准深 × sy
        area   = 估算宽 × 估算深
    缩放来源优先级：xscale/yscale（朋友版）→ scale: [sx, sy]（calc_engine 版）；
    缺失、为 0 或非数时，回退 DEFAULT_AREA (1.5 m²)。

    :return: (面积, 公式说明串)  公式串用于结果可追溯
    """
    xs = eq.get("xscale")
    ys = eq.get("yscale")
    if xs is None or ys is None:
        scale_arr = eq.get("scale")
        if isinstance(scale_arr, (list, tuple)) and len(scale_arr) >= 2:
            xs, ys = scale_arr[0], scale_arr[1]
    try:
        xs = float(xs) if xs not in (None, "") else None
        ys = float(ys) if ys not in (None, "") else None
    except (TypeError, ValueError):
        xs = ys = None

    if xs and ys and xs > 0 and ys > 0:
        width = DEFAULT_HOOD_WIDTH * xs
        depth = DEFAULT_HOOD_DEPTH * ys
        area = round(width * depth, 2)
        formula = f"({DEFAULT_HOOD_WIDTH}*{xs})*({DEFAULT_HOOD_DEPTH}*{ys}) = {area}"
        return area, formula

    # 回退默认面积
    return DEFAULT_AREA, f"默认面积 {DEFAULT_AREA} m2 (scale 缺失/非法)"


# ============================================================
# 单台风量计算（等价朋友版 hvac_service.calculate_air_volume）
# ============================================================
def _air_volume(area: float, height: float, air_changes: float) -> dict:
    """V = 面积 × 层高 × 换气次数。返回 {'air_volume', 'summary'} 兼容朋友版调用形态。"""
    volume = area * height
    airflow = volume * air_changes
    return {"air_volume": round(airflow, 1), "summary": {"air_volume": round(airflow, 1)}}


# ============================================================
# 主函数
# ============================================================
def calculate_fume_hood_airflow(parsed_drawing_data: dict) -> dict:
    """
    图纸联动计算主入口。

    :param parsed_drawing_data: 图纸识别模块返回的完整 JSON 字典，
                                至少包含 equipments 列表。
    :return: {
        "fume_hoods": [ {name, position, airflow, area, height, air_changes, formula}, ... ],
        "summary":    { "total_hoods": N, "success": M, "failed": K,
                        "total_airflow": Σ },
        "errors":     [ "设备名: 错误信息", ... ],
    }
    """
    result: dict[str, Any] = {"fume_hoods": [], "summary": {}, "errors": []}

    if not isinstance(parsed_drawing_data, dict):
        result["errors"].append("输入数据非字典，无法处理。")
        return result

    equipments = parsed_drawing_data.get("equipments") or []
    if not isinstance(equipments, list):
        result["errors"].append("equipments 字段非列表。")
        equipments = []

    total = success = failed = 0
    total_airflow = 0.0

    for eq in equipments:
        if not isinstance(eq, dict):
            continue
        name = str(eq.get("name", ""))
        if not _is_fume_hood(name):
            continue  # 非通风柜，跳过

        total += 1
        position = list(eq.get("insert", [0.0, 0.0]))
        # 仅取 x,y
        position = [round(float(position[0]), 3), round(float(position[1]), 3)] \
            if len(position) >= 2 else [0.0, 0.0]

        # 面积估算
        area, area_formula = _estimate_area(eq)

        # 调用暖通风量计算 (单台隔离异常)
        try:
            cr = _air_volume(area=area, height=DEFAULT_HEIGHT, air_changes=DEFAULT_AIR_CHANGES)
            airflow = float(cr["summary"]["air_volume"])
            formula = f"{area_formula}; V*ACH = {area}*{DEFAULT_HEIGHT}*{DEFAULT_AIR_CHANGES}"
            result["fume_hoods"].append({
                "name": name,
                "position": position,
                "airflow": airflow,
                "area": area,
                "height": DEFAULT_HEIGHT,
                "air_changes": DEFAULT_AIR_CHANGES,
                "formula": formula,
            })
            total_airflow += airflow
            success += 1
        except Exception as exc:  # noqa: BLE001  -> 单台失败不中断整批
            msg = f"{name}: 暖通计算失败 - {exc}"
            result["errors"].append(msg)
            logger.exception("通风柜 %s 风量计算失败", name)
            failed += 1

    result["summary"] = {
        "total_hoods": total,
        "success": success,
        "failed": failed,
        "total_airflow": round(total_airflow, 1),  # 与逐台 airflow 精度一致(1位小数)，保证汇总=分项之和
        "keywords": FUME_HOOD_KEYWORDS,
    }
    return result
