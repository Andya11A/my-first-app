"""图纸联动工作流模块单元测试（来源：洁净EPC-AI 朋友项目合并）
================================================================
覆盖范围：
- 关键词识别 _is_fume_hood（大小写不敏感 / 下划线归一 / 中文）
- 面积估算 _estimate_area（xscale/yscale 朋友版 与 scale[sx,sy] calc_engine 版双格式兼容 + 回退）
- 风量公式 V = 面积 × 层高 × 换气次数（手工核对数值）
- 主流程 calculate_fume_hood_airflow（筛选 / 汇总 / 异常隔离）
- Schema 兼容性与 API 端点（直调函数，db=None 落库静默降级）

手工核对基准：
    标准通风柜 1.5m(宽) × 0.8m(深)，层高 2.8m，换气 15 次/h
    xscale=1.5, yscale=1.0 → 面积 (1.5*1.5)*(0.8*1.0) = 1.8 m² → 风量 1.8*2.8*15 = 75.6 m³/h
"""
import pytest

from app.schemas.workflow import WorkflowInput, WorkflowResult
from app.services import workflow_service as ws
from app.services.workflow_service import (
    DEFAULT_AREA,
    calculate_fume_hood_airflow,
)


# ==================== 关键词识别 ====================


@pytest.mark.parametrize(
    "name",
    [
        "FUME_HOOD",        # 下划线归一 → "FUME HOOD"
        "fume hood",        # 大小写不敏感
        "Fume-Hood-01",     # 混合写法
        "通风柜",            # 中文关键词
        "钢制通风柜A",       # 中文子串
        "FH-203",           # FH- 前缀
        "FH_10",            # FH_ 下划线前缀（与连字符同归一为空格）
        "VENTILATION_HOOD", # calc_engine drawing_parser 常见图块名
    ],
)
def test_is_fume_hood_positive(name):
    assert ws._is_fume_hood(name) is True


@pytest.mark.parametrize(
    "name",
    ["BENCH_01", "SINK", "实验台", "GAS_CYLINDER", "", None],
)
def test_is_fume_hood_negative(name):
    assert ws._is_fume_hood(name) is False


# ==================== 面积估算 ====================


def test_estimate_area_friend_format():
    """朋友版格式：xscale=1.5, yscale=1.0 → (1.5*1.5)*(0.8*1.0) = 1.8 m²"""
    area, formula = ws._estimate_area({"xscale": 1.5, "yscale": 1.0})
    assert area == pytest.approx(1.8)
    assert "1.5*1.5" in formula and "0.8*1.0" in formula


def test_estimate_area_scale_array_format():
    """calc_engine 版格式：scale=[1.2, 1.5] → (1.5*1.2)*(0.8*1.5) = 2.16 m²"""
    area, _ = ws._estimate_area({"scale": [1.2, 1.5]})
    assert area == pytest.approx(2.16)


def test_estimate_area_priority_xscale_over_scale():
    """两种格式同时存在时，优先 xscale/yscale（朋友版）"""
    area, _ = ws._estimate_area({"xscale": 2.0, "yscale": 1.0, "scale": [3.0, 3.0]})
    assert area == pytest.approx(1.5 * 2.0 * 0.8 * 1.0)  # 2.4，而非 scale 版的 10.8


@pytest.mark.parametrize(
    "eq",
    [
        {},                                   # 完全缺失
        {"xscale": 1.5},                      # 缺 yscale
        {"xscale": 0, "yscale": 1.0},         # 0 视为非法
        {"xscale": -1.0, "yscale": 1.0},      # 负数非法
        {"xscale": "abc", "yscale": 1.0},     # 非数
        {"xscale": "", "yscale": 1.0},        # 空串
        {"scale": [1.2]},                     # scale 长度不足
        {"scale": "not-a-list"},              # scale 非列表
    ],
)
def test_estimate_area_fallback_default(eq):
    """缺失/为 0/非法缩放一律回退默认面积 1.5 m²"""
    area, formula = ws._estimate_area(eq)
    assert area == pytest.approx(DEFAULT_AREA)
    assert "默认面积" in formula


# ==================== 风量公式 ====================


def test_air_volume_formula():
    """V = 面积 × 层高 × 换气次数：1.8 × 2.8 × 15 = 75.6 m³/h"""
    cr = ws._air_volume(area=1.8, height=2.8, air_changes=15)
    assert cr["air_volume"] == pytest.approx(75.6)
    assert cr["summary"]["air_volume"] == pytest.approx(75.6)


# ==================== 主流程 ====================


def test_pipeline_friend_format_full():
    """朋友版完整链路：3 台通风柜 + 1 台实验台，逐台手工核对风量"""
    data = {
        "equipments": [
            {"name": "FUME_HOOD_01", "insert": [1.0, 2.0], "xscale": 1.5, "yscale": 1.0},
            {"name": "通风柜B", "insert": [3.0, 4.0], "xscale": 1.0, "yscale": 1.0},
            {"name": "BENCH_01", "insert": [5.0, 6.0], "xscale": 2.0, "yscale": 1.0},  # 应排除
            {"name": "FUME_HOOD_03", "insert": [7.0, 8.0]},  # 无缩放 → 默认 1.5 m²
        ]
    }
    result = calculate_fume_hood_airflow(data)

    assert result["errors"] == []
    hoods = result["fume_hoods"]
    assert len(hoods) == 3
    assert [h["name"] for h in hoods] == ["FUME_HOOD_01", "通风柜B", "FUME_HOOD_03"]

    # 逐台核对：面积 → 风量（1.5×0.8 基准 × 2.8m 层高 × 15 ACH）
    assert hoods[0]["area"] == pytest.approx(1.8)
    assert hoods[0]["airflow"] == pytest.approx(75.6)
    assert hoods[1]["area"] == pytest.approx(1.2)
    assert hoods[1]["airflow"] == pytest.approx(50.4)
    assert hoods[2]["area"] == pytest.approx(1.5)
    assert hoods[2]["airflow"] == pytest.approx(63.0)

    # 公式可追溯串
    assert "(1.5*1.5)*(0.8*1.0) = 1.8" in hoods[0]["formula"]
    assert hoods[2]["formula"].startswith("默认面积")

    # 汇总：75.6 + 50.4 + 63.0 = 189.0
    s = result["summary"]
    assert s["total_hoods"] == 3
    assert s["success"] == 3
    assert s["failed"] == 0
    assert s["total_airflow"] == pytest.approx(189.0)
    assert s["keywords"] == ws.FUME_HOOD_KEYWORDS


def test_pipeline_calc_engine_format():
    """calc_engine 版格式：scale=[1.2,1.5] → 2.16 m² × 2.8 × 15 = 90.72 → 90.7"""
    result = calculate_fume_hood_airflow(
        {"equipments": [{"name": "VENTILATION_HOOD", "insert": [0, 0], "scale": [1.2, 1.5]}]}
    )
    hood = result["fume_hoods"][0]
    assert hood["area"] == pytest.approx(2.16)
    assert hood["airflow"] == pytest.approx(90.7)
    assert result["summary"]["total_airflow"] == pytest.approx(90.7)  # 2.16*2.8*15=90.72 → 与逐台同精度 round(…,1)


def test_pipeline_category_ignored_name_is_authoritative():
    """筛选只看图块名：category 为 hood 但名字不含关键词的不算，反之亦然"""
    result = calculate_fume_hood_airflow(
        {
            "equipments": [
                {"name": "MYSTERY_BOX", "category": "hood"},      # category=hood 但名字不匹配
                {"name": "FH-101", "category": "other"},          # 名字匹配但 category=other
            ]
        }
    )
    names = [h["name"] for h in result["fume_hoods"]]
    assert names == ["FH-101"]


def test_single_failure_isolated():
    """异常隔离：单台风量计算失败只记录 errors 并继续，其余台正常"""
    real_air_volume = ws._air_volume

    def flaky(area, height, air_changes):
        if area == pytest.approx(1.8):  # 仅第一台（xscale=1.5）触发失败
            raise RuntimeError("模拟引擎故障")
        return real_air_volume(area, height, air_changes)

    monkey = pytest.MonkeyPatch()
    monkey.setattr(ws, "_air_volume", flaky)
    try:
        result = calculate_fume_hood_airflow(
            {
                "equipments": [
                    {"name": "FUME_HOOD_A", "xscale": 1.5, "yscale": 1.0},  # 1.8 m² → 失败
                    {"name": "FUME_HOOD_B"},                                # 默认 → 成功
                ]
            }
        )
    finally:
        monkey.undo()

    assert len(result["fume_hoods"]) == 1
    assert result["fume_hoods"][0]["name"] == "FUME_HOOD_B"
    assert len(result["errors"]) == 1
    assert "FUME_HOOD_A" in result["errors"][0]
    s = result["summary"]
    assert s["total_hoods"] == 2 and s["success"] == 1 and s["failed"] == 1


def test_input_not_dict():
    """输入非 dict → 记录错误并返回空结构"""
    result = calculate_fume_hood_airflow(["not", "a", "dict"])
    assert result["fume_hoods"] == []
    assert any("非字典" in e for e in result["errors"])


def test_equipments_not_list():
    """equipments 字段非列表 → 记录错误，不抛异常"""
    result = calculate_fume_hood_airflow({"equipments": "oops"})
    assert result["fume_hoods"] == []
    assert any("非列表" in e for e in result["errors"])


def test_empty_input():
    result = calculate_fume_hood_airflow({})
    assert result["fume_hoods"] == []
    assert result["summary"]["total_hoods"] == 0
    assert result["summary"]["total_airflow"] == 0


def test_non_dict_equipment_skipped():
    """equipments 混入非 dict 元素直接跳过，不影响其他设备"""
    result = calculate_fume_hood_airflow(
        {"equipments": [None, 42, "FUME_HOOD", {"name": "FH-1"}]}
    )
    assert [h["name"] for h in result["fume_hoods"]] == ["FH-1"]


def test_position_defaults_and_truncation():
    """insert 缺失取 [0,0]；3D 坐标截断为前两位 x,y"""
    result = calculate_fume_hood_airflow(
        {
            "equipments": [
                {"name": "FH-1", "insert": [10.5, 20.4, 99.0]},
                {"name": "FH-2"},
            ]
        }
    )
    assert result["fume_hoods"][0]["position"] == [10.5, 20.4]
    assert result["fume_hoods"][1]["position"] == [0.0, 0.0]


# ==================== Schema 兼容性 ====================


def test_schema_accepts_both_scaling_formats():
    """WorkflowInput 同时接受朋友版 xscale/yscale 与 calc_engine 版 scale 数组"""
    inp = WorkflowInput(
        equipments=[
            {"name": "FUME_HOOD", "xscale": 1.5, "yscale": 1.0},
            {"name": "VENTILATION_HOOD", "scale": [1.2, 1.5]},
        ]
    )
    assert inp.equipments[0].xscale == 1.5
    assert inp.equipments[1].scale == [1.2, 1.5]


def test_schema_ignores_extra_drawing_fields():
    """drawing /parse 完整响应可直接作为请求体：walls 等多余字段被忽略"""
    inp = WorkflowInput(
        **{
            "walls": [{"start": [0, 0], "end": [1, 1]}],
            "doors": [],
            "windows": [],
            "equipments": [{"name": "FH-1", "layer": "EQ", "rotation": 90.0}],
        }
    )
    assert len(inp.equipments) == 1
    assert inp.equipments[0].rotation == 90.0


def test_result_schema_roundtrip():
    """service 输出可无损装入 WorkflowResult（API 契约保证）"""
    result = calculate_fume_hood_airflow(
        {"equipments": [{"name": "FUME_HOOD", "xscale": 1.5, "yscale": 1.0}]}
    )
    model = WorkflowResult(**result)
    assert model.fume_hoods[0].airflow == pytest.approx(75.6)
    assert model.summary["success"] == 1


# ==================== API 端点（直调，db=None 落库静默降级） ====================


def test_api_endpoint_success_contract():
    """端点返回统一契约：module=workflow、status=success、references 含 GB 50019-2015"""
    from app.api.v1.workflow import calculate_hvac_from_drawing

    drawing = WorkflowInput(
        equipments=[{"name": "FUME_HOOD", "xscale": 1.5, "yscale": 1.0}]
    )
    result = calculate_hvac_from_drawing(drawing, db=None)

    assert result.module == "workflow"
    assert result.status.value == "success"
    assert result.data.fume_hoods[0].airflow == pytest.approx(75.6)
    assert result.meta.module_version == "1.0.0"
    assert any("GB 50019-2015" in r for r in result.meta.references)
    assert result.warnings == []


def test_api_endpoint_warning_on_partial_failure(monkeypatch):
    """存在失败台位时端点降级为 warning 状态 + WF_W001 告警"""
    from app.api.v1.workflow import calculate_hvac_from_drawing

    def broken(_raw):
        return {
            "fume_hoods": [],
            "summary": {"total_hoods": 1, "success": 0, "failed": 1, "total_airflow": 0},
            "errors": ["FUME_HOOD: 暖通计算失败 - 模拟故障"],
        }

    monkeypatch.setattr("app.api.v1.workflow.calculate_fume_hood_airflow", broken)
    result = calculate_hvac_from_drawing(
        WorkflowInput(equipments=[{"name": "FUME_HOOD"}]), db=None
    )

    assert result.status.value == "warning"
    assert len(result.warnings) == 1
    assert result.warnings[0].code == "WF_W001"
    assert "FUME_HOOD" in result.warnings[0].message
