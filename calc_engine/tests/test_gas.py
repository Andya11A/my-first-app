"""集中供气模块单元测试：手工核对关键公式结果。"""
import pytest

from app.schemas.common import CalculationStatus
from app.schemas.gas import GasPoint, GasSupplyInput
from app.services.gas_supply_service import GasSupplyService


def _input(points, **overrides) -> GasSupplyInput:
    base = dict(points=points)
    base.update(overrides)
    return GasSupplyInput(**base)


def test_n2_line_and_manifold():
    """3 点 N2 各 50 L/min 峰值:
    总峰 150 lpm × K0.8 = 120 lpm = 7.2 Nm³/h
    工作态 (0.8 bar g): 7.2 × 1.013/1.813 ≈ 4.02 m³/h
    v=8 → 需内径 ≈13.3mm → 选 OD19.05 (id 17.05)
    日均 18 Nm³ → 汇流排 2×4
    """
    result = GasSupplyService().calculate(_input([GasPoint(gas="N2", count=3, peak_flow_lpm=50)]))
    out = result.data
    line = out.lines[0]
    assert line.total_peak_lpm == pytest.approx(150)
    assert line.simultaneity_factor == 0.8
    assert line.design_flow_nm3h == pytest.approx(7.2)
    assert line.line_flow_nm3h == pytest.approx(7.2 * 1.013 / 1.813, rel=1e-3)
    assert line.tube_od_mm == 19.05
    assert line.actual_velocity_mps <= 8.0
    assert "316L" in line.pipe_material
    plan = out.cylinder_plans[0]
    assert plan.daily_usage_nm3 == pytest.approx(18.0)
    assert plan.scheme == "manifold"
    assert plan.cylinders_per_side == 4


def test_corrosive_gas_gets_ba_pipe_and_purge():
    result = GasSupplyService().calculate(_input([GasPoint(gas="HCl", count=2, peak_flow_lpm=5)]))
    line = result.data.lines[0]
    assert "BA" in line.pipe_material
    assert any("吹扫" in r for r in line.special_requirements)
    assert line.hazard_category == "corrosive"


def test_oxygen_degreasing():
    result = GasSupplyService().calculate(_input([GasPoint(gas="O2", count=1, peak_flow_lpm=10)]))
    line = result.data.lines[0]
    assert any("脱脂" in r or "禁油" in r for r in line.special_requirements)
    assert any("脱脂" in n for n in line.regulator.notes)


def test_flammable_gas_alarm():
    result = GasSupplyService().calculate(_input([GasPoint(gas="H2", count=1, peak_flow_lpm=20)]))
    line = result.data.lines[0]
    assert any("切断" in r for r in line.special_requirements)


def test_single_cylinder_scheme():
    """1 点 2 L/min×0.25=0.5 lpm 日均 → 0.24 Nm³/天 < 5.9/2 → 单瓶方案"""
    result = GasSupplyService().calculate(
        _input([GasPoint(gas="He", count=1, peak_flow_lpm=2)], operating_hours_per_day=8)
    )
    plan = result.data.cylinder_plans[0]
    assert plan.scheme == "single"
    assert plan.autonomy_days_per_cylinder == pytest.approx(5.9 / 0.24, rel=1e-2)


def test_unknown_gas_fallback_with_warning():
    result = GasSupplyService().calculate(_input([GasPoint(gas="XXY", count=1, peak_flow_lpm=5)]))
    codes = [w.code for w in result.warnings]
    assert "GAS_W001" in codes
    assert result.data.lines[0].hazard_category == "inert"
    assert result.status == CalculationStatus.WARNING


def test_avg_flow_estimation_warning():
    result = GasSupplyService().calculate(_input([GasPoint(gas="N2", count=1, peak_flow_lpm=10)]))
    codes = [w.code for w in result.warnings]
    assert "GAS_W002" in codes
