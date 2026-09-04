"""材料库 fan_match 模块单元测试（来源：洁净EPC-AI 朋友项目合并）
================================================================
覆盖范围：
- FAN_MATERIAL_BY_ACID 常量完整性（high/medium/low 三档）
- MaterialLibrary.fan_match 匹配逻辑（大小写不敏感 / 未知等级返回 None）
- GET /materials/fan-match 端点（直调函数：正常返回 / 未知等级 404）

选型基准（防腐联动约定）：
    high   强腐蚀排风（如 HCl、H2S 系统）→ 玻璃钢 FRP / PP
    medium 中等腐蚀 → 不锈钢 304 / 内涂环氧
    low    一般排风 → 镀锌钢板
"""
import pytest
from fastapi import HTTPException

from app.api.v1.router import fan_match as fan_match_endpoint
from app.core.constants import FAN_MATERIAL_BY_ACID
from app.services.material_db import get_material_library


# ==================== 常量完整性 ====================


def test_fan_material_constant_levels():
    """常量必须恰好覆盖 high/medium/low 三档，键为小写"""
    assert set(FAN_MATERIAL_BY_ACID.keys()) == {"high", "medium", "low"}


@pytest.mark.parametrize("level", ["high", "medium", "low"])
def test_fan_material_constant_fields(level):
    """每档必须给出材质、叶轮、备注三个字段且非空"""
    entry = FAN_MATERIAL_BY_ACID[level]
    assert set(entry.keys()) >= {"material", "impeller", "remark"}
    assert all(str(v).strip() for v in entry.values())


def test_fan_material_corrosion_ordering():
    """防腐档位递减：high 用 FRP/PP（非金属），medium 用 304，low 用镀锌碳钢"""
    assert "FRP" in FAN_MATERIAL_BY_ACID["high"]["material"] or "PP" in FAN_MATERIAL_BY_ACID["high"]["material"]
    assert "304" in FAN_MATERIAL_BY_ACID["medium"]["material"]
    assert "镀锌" in FAN_MATERIAL_BY_ACID["low"]["material"]


# ==================== Service 层 ====================


@pytest.mark.parametrize(
    "level, expected_fragment",
    [
        ("high", "FRP"),
        ("medium", "304"),
        ("low", "镀锌"),
    ],
)
def test_fan_match_three_levels(level, expected_fragment):
    lib = get_material_library()
    result = lib.fan_match(level)
    assert result is not None
    assert expected_fragment in result["material"]
    assert result["impeller"]
    assert result["remark"]


@pytest.mark.parametrize("raw, expected_key", [("HIGH", "high"), ("Medium", "medium"), ("LOW", "low")])
def test_fan_match_case_insensitive(raw, expected_key):
    """等级参数大小写不敏感，归一后与常量表一致"""
    lib = get_material_library()
    assert lib.fan_match(raw) == FAN_MATERIAL_BY_ACID[expected_key]


@pytest.mark.parametrize("bad", ["platinum", "超防腐", "", "  ", "high-level"])
def test_fan_match_unknown_returns_none(bad):
    """未知等级返回 None（由 API 层转换为 404），不抛异常"""
    lib = get_material_library()
    assert lib.fan_match(bad) is None


def test_fan_match_returns_copy_safe_data():
    """返回值为常量表本体，字段结构与布尔版 fan_material 不冲突（三档精细化）"""
    lib = get_material_library()
    medium = lib.fan_match("medium")
    assert isinstance(medium, dict)
    assert set(medium.keys()) == {"material", "impeller", "remark"}


# ==================== API 端点（直调函数） ====================


@pytest.mark.parametrize("level", ["high", "medium", "low"])
def test_fan_match_endpoint_ok(level):
    """端点正常返回：echo 等级 + 材质字段展开到顶层"""
    result = fan_match_endpoint(acid_resistance=level)
    assert result["acid_resistance"] == level
    assert result["material"] == FAN_MATERIAL_BY_ACID[level]["material"]
    assert result["impeller"] == FAN_MATERIAL_BY_ACID[level]["impeller"]


def test_fan_match_endpoint_404_on_unknown():
    """未知等级 → HTTPException 404，detail 提示可选值"""
    with pytest.raises(HTTPException) as exc_info:
        fan_match_endpoint(acid_resistance="platinum")
    assert exc_info.value.status_code == 404
    assert "platinum" in exc_info.value.detail
    assert "high/medium/low" in exc_info.value.detail
