"""暖通模块单元测试：手工核对关键公式结果。"""
import pytest

from app.schemas.common import CalculationStatus
from app.schemas.hvac import DeviceType, ExhaustDevice, HvacInput, LabType
from app.services.hvac_service import HvacService


def _input(**overrides) -> HvacInput:
    base = dict(
        length_m=6,
        width_m=5,
        height_m=3,
        lab_type=LabType.CHEMISTRY,
        devices=[ExhaustDevice(type=DeviceType.FUME_HOOD, count=2)],
    )
    base.update(overrides)
    return HvacInput(**base)


def test_exhaust_max_rule():
    """2 台通风柜: 2 × 0.5m/s × 0.6m² × 3600 = 2160 m³/h > 换气 10 × 90 = 900 m³/h"""
    out = HvacService().calculate(_input()).data
    assert out.room_volume_m3 == pytest.approx(90)
    assert out.exhaust.local_exhaust_m3h == pytest.approx(2160)
    assert out.exhaust.air_change_m3h == pytest.approx(900)
    assert out.exhaust.total_m3h == pytest.approx(2160)
    assert out.exhaust.controlling_method == "local_exhaust"


def test_makeup_air_85_percent():
    out = HvacService().calculate(_input()).data
    assert out.makeup_air_m3h == pytest.approx(2160 * 0.85)


def test_cooling_load_components_positive():
    """总冷负荷 = 1.1 × (围护 + 新风 + 设备 + 照明 + 人员)，各分项为正。"""
    out = HvacService().calculate(_input(equipment_power_kw=5, occupants=4)).data
    c = out.cooling
    assert c.envelope_kw > 0
    assert c.fresh_air_kw > 0
    assert c.equipment_kw == pytest.approx(5 * 0.7)
    assert c.lighting_kw == pytest.approx(10.0 * 30 / 1000)
    assert c.occupants_kw == pytest.approx(120.0 * 4 / 1000)
    expected = 1.1 * (c.envelope_kw + c.fresh_air_kw + c.equipment_kw + c.lighting_kw + c.occupants_kw)
    # 服务端用全精度分项求和后保留 2 位小数，此处允许 2 分项舍入误差
    assert c.total_kw == pytest.approx(expected, abs=0.02)


def test_main_duct_sizing():
    """Q=2160 m³/h, v=7 m/s → 需要面积 0.0857 m² → 等效圆管 ≈ 330.5 mm"""
    out = HvacService().calculate(_input()).data
    d = out.main_duct
    assert d.round_diameter_mm == pytest.approx(330.5, abs=1.5)
    assert d.rect_width_mm * d.rect_height_mm / 1e6 >= 2160 / 3600 / 7 - 1e-9
    assert d.actual_velocity_mps >= 6.0
    assert "PP" in d.material or "玻璃钢" in d.material  # 化学实验室 → 防腐


def test_warning_when_no_devices():
    result = HvacService().calculate(_input(devices=[]))
    codes = [w.code for w in result.warnings]
    assert "HVAC_W003" in codes
    assert result.status == CalculationStatus.WARNING


# ==================================================================
#  HVAC V2 单元测试 —— 覆盖 BSL-2 与洁净室场景
#  依据 GB 50346-2011 / GB 50736-2012 / GB 50881-2013 / 22K523
# ==================================================================
import math

from app.schemas.hvac import (
    ExhaustGasType,
    HVACInput,
    HVACLabType,
    HVACRoomFunction,
)
from app.services.hvac_service import (
    HVAC_ACH_TABLE,
    HVAC_ACCESSORY_PRESSURE,
    HVAC_CRACK_AREA_PER_M2,
    HVAC_DUCT_FRICTION,
    HVAC_DUCT_VELOCITY,
    HVAC_FAN_EFFICIENCY,
    HVAC_FAN_FLOW_MARGIN,
    HVAC_FAN_PRESSURE_MARGIN,
    HVAC_HEPA_EFFICIENCY,
    HVAC_LEAK_COEFF,
    HVAC_LOAD_SAFETY_FACTOR,
    HVAC_PERSON_LATENT_W,
    HVAC_PERSON_SENSIBLE_W,
    calculate_cooling_heating_load,
    calculate_exhaust_treatment,
    calculate_hvac,
    calculate_pressure_control,
    calculate_ventilation,
    select_ventilation_system,
)


# ---------- BSL-2 场景固定入参 ----------
# 生物安全二级实验室：30m² × 3m，4 名人员，2 台通风柜（有毒操作）
# 室内 25℃/冬季 20℃，室外夏 35℃/冬 -5℃，焓差 85→50 kJ/kg
def _bsl2_load_kwargs():
    return dict(
        area=30.0,
        height=3.0,
        window_area=0.0,            # BSL 实验室无外窗
        wall_type="insulated_panel",
        equipment_heat_load_w=3000.0,
        personnel_count=3,
        lighting_power_w=600.0,
        summer_outdoor_temp_c=35.0,
        winter_outdoor_temp_c=-5.0,
        indoor_summer_temp_c=25.0,
        indoor_winter_temp_c=20.0,
        outdoor_enthalpy_kjkg=85.0,
        indoor_enthalpy_kjkg=50.0,
        air_change_rate=HVAC_ACH_TABLE["biological_lab"],  # 10 次/h
        volume=30.0 * 3.0,         # 90 m³
    )


def _bsl2_vent_kwargs():
    return dict(
        room_function=HVACRoomFunction.BIOLOGICAL_LAB,
        area=30.0,
        height=3.0,
        fume_hood_count=2,
        fume_hood_face_area=0.6,
        fume_hood_toxic=True,
        personnel_count=3,
    )


def _bsl2_input() -> HVACInput:
    return HVACInput(
        area=30.0,
        height=3.0,
        window_area=0.0,
        wall_type="insulated_panel",
        equipment_heat_load_w=3000.0,
        personnel_count=3,
        lighting_power_w=600.0,
        lab_type=HVACLabType.BSL2,
        room_function=HVACRoomFunction.BIOLOGICAL_LAB,
        fume_hood_count=2,
        fume_hood_face_area=0.6,
        fume_hood_toxic=True,
        room_sequence=["走廊", "缓冲间", "核心实验区", "工作区"],
        exhaust_gas_type=ExhaustGasType.BIOLOGICAL,
        summer_outdoor_temp_c=35.0,
        winter_outdoor_temp_c=-5.0,
        indoor_summer_temp_c=25.0,
        indoor_winter_temp_c=20.0,
        outdoor_enthalpy_kjkg=85.0,
        indoor_enthalpy_kjkg=50.0,
        duct_length_m=30.0,
    )


# ---------- 洁净室场景固定入参 ----------
# 洁净室：50m² × 3m，2 名人员，无通风柜，设备散热 5kW
def _cleanroom_load_kwargs():
    return dict(
        area=50.0,
        height=3.0,
        window_area=0.0,
        wall_type="insulated_panel",
        equipment_heat_load_w=5000.0,
        personnel_count=2,
        lighting_power_w=1000.0,
        summer_outdoor_temp_c=35.0,
        winter_outdoor_temp_c=-5.0,
        indoor_summer_temp_c=22.0,   # 洁净室温要求更严
        indoor_winter_temp_c=20.0,
        outdoor_enthalpy_kjkg=85.0,
        indoor_enthalpy_kjkg=48.0,
        air_change_rate=HVAC_ACH_TABLE["cleanroom"],  # 25 次/h
        volume=50.0 * 3.0,          # 150 m³
    )


def _cleanroom_vent_kwargs():
    return dict(
        room_function=HVACRoomFunction.CLEANROOM,
        area=50.0,
        height=3.0,
        fume_hood_count=0,
        fume_hood_face_area=0.6,
        fume_hood_toxic=False,
        personnel_count=2,
    )


def _cleanroom_input() -> HVACInput:
    return HVACInput(
        area=50.0,
        height=3.0,
        window_area=0.0,
        wall_type="insulated_panel",
        equipment_heat_load_w=5000.0,
        personnel_count=2,
        lighting_power_w=1000.0,
        lab_type=HVACLabType.CLEANROOM,
        room_function=HVACRoomFunction.CLEANROOM,
        fume_hood_count=0,
        fume_hood_face_area=0.6,
        fume_hood_toxic=False,
        room_sequence=["走廊", "缓冲间", "核心洁净区", "操作间"],
        exhaust_gas_type=ExhaustGasType.ACID,
        summer_outdoor_temp_c=35.0,
        winter_outdoor_temp_c=-5.0,
        indoor_summer_temp_c=22.0,
        indoor_winter_temp_c=20.0,
        outdoor_enthalpy_kjkg=85.0,
        indoor_enthalpy_kjkg=48.0,
        duct_length_m=30.0,
    )


# ============================================================
#  BSL-2 冷热负荷计算
# ============================================================
def test_bsl2_cooling_load_components():
    """BSL-2 冷负荷分项与总和校核。

    关键公式（GB 50736-2012 第 5.2.3 条 / GB 50881-2013 第 7.4.5 条）：
      side = √30 ≈ 5.4772 → wall_area = 4×side×3 − 0 ≈ 65.727 m²
      wall_load = 0.5 × 65.727 × (35−25) = 328.6 W
      fresh_air_volume = 10 × 90 = 900 m³/h
      fresh_air_load = 1.2 × 900 × (85−50) / 3.6 = 10500 W
      total = (328.6+150+90+324+210+3000+600+10500) × 1.15 ≈ 17483.0 W
    """
    load = calculate_cooling_heating_load(**_bsl2_load_kwargs())

    assert load.wall_load_w == pytest.approx(328.6, abs=0.2)
    assert load.window_load_w == pytest.approx(0.0, abs=1e-6)
    assert load.roof_load_w == pytest.approx(150.0, abs=1e-6)
    assert load.floor_load_w == pytest.approx(90.0, abs=1e-6)
    assert load.personnel_sensible_w == pytest.approx(3 * HVAC_PERSON_SENSIBLE_W)
    assert load.personnel_latent_w == pytest.approx(3 * HVAC_PERSON_LATENT_W)
    assert load.equipment_load_w == pytest.approx(3000.0)
    assert load.lighting_load_w == pytest.approx(600.0)
    assert load.fresh_air_load_w == pytest.approx(10500.0, abs=0.2)
    assert load.safety_factor == HVAC_LOAD_SAFETY_FACTOR
    assert load.total_cooling_load_w == pytest.approx(17483.0, abs=0.5)


def test_bsl2_heating_load():
    """BSL-2 冬季热负荷（保守：不计设备/人员/照明得热）。

      dt_winter = 20 − (−5) = 25 ℃
      fresh_air_heat = 1.2 × 900 × 1.005 × 25 / 3.6 = 7537.5 W
      total = (821.6+375+225+7537.5) × 1.15 ≈ 10302.9 W
    """
    load = calculate_cooling_heating_load(**_bsl2_load_kwargs())
    assert load.total_heating_load_w == pytest.approx(10302.9, abs=0.5)
    # 热负荷应小于冷负荷（冬季不计设备/人员/照明得热，且夏季焓差大）
    assert load.total_heating_load_w < load.total_cooling_load_w


def test_bsl2_cooling_total_matches_sum_times_safety():
    """总冷负荷 = (各分项之和) × 1.15，验证安全系数一致性。"""
    load = calculate_cooling_heating_load(**_bsl2_load_kwargs())
    raw_sum = (
        load.wall_load_w
        + load.window_load_w
        + load.roof_load_w
        + load.floor_load_w
        + load.personnel_sensible_w
        + load.personnel_latent_w
        + load.equipment_load_w
        + load.lighting_load_w
        + load.fresh_air_load_w
    )
    assert load.total_cooling_load_w == pytest.approx(raw_sum * HVAC_LOAD_SAFETY_FACTOR, abs=0.5)


# ============================================================
#  BSL-2 通风量计算
# ============================================================
def test_bsl2_ventilation_face_velocity_method():
    """BSL-2 通风量：2 台通风柜有毒操作，面风速 0.5 m/s。

      volume = 30 × 3 = 90 m³
      general = 10 × 90 = 900 m³/h（GB 50881 表7.4.1）
      local_per_hood = 0.5 × 0.6 × 3600 = 1080 m³/h
      local = 1080 × 2 = 2160 m³/h
      makeup = 2160 × 0.85 = 1836 m³/h
      total = max(900, 2160+1836) = 3996 m³/h
      fresh = max(3×30, 1836) = 1836 m³/h
    """
    v = calculate_ventilation(**_bsl2_vent_kwargs())
    assert v.air_change_rate_used == HVAC_ACH_TABLE["biological_lab"]
    assert v.face_velocity_used_mps == 0.5  # 有毒操作
    assert v.general_ventilation_m3h == pytest.approx(900.0, abs=1e-6)
    assert v.local_exhaust_m3h == pytest.approx(2160.0, abs=1e-6)
    assert v.total_exhaust_m3h == pytest.approx(3996.0, abs=0.2)
    assert v.fresh_air_m3h == pytest.approx(1836.0, abs=0.2)


def test_bsl2_ventilation_system_type_cav():
    """2 台通风柜 ≤ 2 → 推荐定风量系统 CAV（22K523 系统类型1）。"""
    v = calculate_ventilation(**_bsl2_vent_kwargs())
    assert "CAV" in v.recommended_system_type or "定风量" in v.recommended_system_type


def test_bsl2_ventilation_makeup_less_than_exhaust():
    """补风量 = 局部排风 × 0.85 < 排风，维持 BSL-2 负压。"""
    v = calculate_ventilation(**_bsl2_vent_kwargs())
    assert v.fresh_air_m3h < v.total_exhaust_m3h


# ============================================================
#  BSL-2 压差控制
# ============================================================
def test_bsl2_pressure_gradient():
    """BSL-2 压差梯度（GB 50346-2011 第 5.2 条）：
       走廊 0 / 缓冲间 -10 / 核心 -20 / 工作区 -20 Pa。
    """
    pc = calculate_pressure_control(
        lab_type=HVACLabType.BSL2,
        room_sequence=["走廊", "缓冲间", "核心实验区", "工作区"],
        area=30.0,
    )
    by_name = {r.room_name: r for r in pc.rooms}
    assert by_name["走廊"].target_pressure_pa == pytest.approx(0.0)
    assert by_name["缓冲间"].target_pressure_pa == pytest.approx(-10.0)
    assert by_name["核心实验区"].target_pressure_pa == pytest.approx(-20.0)
    assert by_name["工作区"].target_pressure_pa == pytest.approx(-20.0)


def test_bsl2_pressure_negative_values():
    """BSL-2 各房间均为负压或零压（不得出现正压）。"""
    pc = calculate_pressure_control(
        lab_type=HVACLabType.BSL2,
        room_sequence=["走廊", "缓冲间", "核心实验区", "工作区"],
        area=30.0,
    )
    for r in pc.rooms:
        assert r.target_pressure_pa <= 0.0


def test_bsl2_pressure_leak_formula():
    """缝隙渗漏量公式校核：L = 0.827 × A_eff × |ΔP|^0.5 × 3600。

      A_eff = 30 × 0.003 = 0.09 m²
      缓冲间 ΔP=10：L = 0.827 × 0.09 × √10 × 3600 ≈ 847.3 m³/h
      核心 ΔP=20：L = 0.827 × 0.09 × √20 × 3600 ≈ 1198.3 m³/h
    """
    pc = calculate_pressure_control(
        lab_type=HVACLabType.BSL2,
        room_sequence=["缓冲间", "核心实验区"],
        area=30.0,
    )
    a_eff = 30.0 * HVAC_CRACK_AREA_PER_M2
    by_name = {r.room_name: r for r in pc.rooms}
    # 缓冲间 -10Pa
    expected_buf = HVAC_LEAK_COEFF * a_eff * math.sqrt(10.0) * 3600.0
    assert by_name["缓冲间"].supply_exhaust_diff_m3h == pytest.approx(expected_buf, abs=0.5)
    # 核心 -20Pa
    expected_core = HVAC_LEAK_COEFF * a_eff * math.sqrt(20.0) * 3600.0
    assert by_name["核心实验区"].supply_exhaust_diff_m3h == pytest.approx(expected_core, abs=0.5)


def test_bsl2_pressure_control_mode_vav():
    """BSL-2 推荐变风量 VAV 精确控压。"""
    pc = calculate_pressure_control(
        lab_type=HVACLabType.BSL2,
        room_sequence=["走廊", "缓冲间", "核心实验区"],
        area=30.0,
    )
    assert "VAV" in pc.recommended_control_mode or "变风量" in pc.recommended_control_mode


# ============================================================
#  BSL-2 废气处理
# ============================================================
def test_bsl2_exhaust_treatment_hepa():
    """BSL-2 生物废气 → HEPA 高效过滤（GB 50346-2011）。"""
    et = calculate_exhaust_treatment(
        lab_type=HVACLabType.BSL2,
        exhaust_gas_type=ExhaustGasType.BIOLOGICAL,
        exhaust_volume=3996.0,
    )
    assert "HEPA" in et.process_scheme
    assert et.filtration_efficiency == HVAC_HEPA_EFFICIENCY
    assert "GB 50346" in et.regulation_reference


def test_bsl2_exhaust_emission_requirements():
    """排放口位置要求：距楼顶 ≥3m，远离新风取风口 ≥10m，设防火阀。"""
    et = calculate_exhaust_treatment(
        lab_type=HVACLabType.BSL2,
        exhaust_gas_type=ExhaustGasType.BIOLOGICAL,
        exhaust_volume=3996.0,
    )
    assert "≥3m" in et.emission_requirements
    assert "防火阀" in et.emission_requirements


# ============================================================
#  BSL-2 通风系统选型
# ============================================================
def test_bsl2_system_independent_exhaust():
    """BSL-2 → 系统类型3 独立排风系统（GB 50881-2013 第 7.4.4 条）。"""
    vs = select_ventilation_system(
        lab_type=HVACLabType.BSL2,
        fume_hood_count=2,
        total_exhaust_volume=3996.0,
        fresh_air_volume=1836.0,
        exhaust_gas_type=ExhaustGasType.BIOLOGICAL,
        duct_length_m=30.0,
    )
    assert "独立排风" in vs.recommended_system_type
    assert "GB 50881" in vs.regulation_reference


def test_bsl2_system_fan_params():
    """风机参数校核：
      fan_flow = 3996 × 1.1 = 4395.6 m³/h
      fan_pressure = (1.0×30 + 250[HEPA]) × 1.1 = 308.0 Pa
      fan_power = 4395.6 × 308 / (3600×0.6) / 1000 ≈ 0.627 kW
      duct_diameter = √(4×3996/(3600×π×7))×1000 ≈ 449.3 mm
    """
    vs = select_ventilation_system(
        lab_type=HVACLabType.BSL2,
        fume_hood_count=2,
        total_exhaust_volume=3996.0,
        fresh_air_volume=1836.0,
        exhaust_gas_type=ExhaustGasType.BIOLOGICAL,
        duct_length_m=30.0,
    )
    assert vs.fan_flow_m3h == pytest.approx(3996.0 * HVAC_FAN_FLOW_MARGIN, abs=0.5)
    accessory_dp = HVAC_ACCESSORY_PRESSURE["biological"]
    expected_pressure = (HVAC_DUCT_FRICTION * 30.0 + accessory_dp) * HVAC_FAN_PRESSURE_MARGIN
    assert vs.fan_pressure_pa == pytest.approx(expected_pressure, abs=0.5)
    expected_power = (
        vs.fan_flow_m3h * vs.fan_pressure_pa / (3600.0 * HVAC_FAN_EFFICIENCY) / 1000.0
    )
    assert vs.fan_power_kw == pytest.approx(expected_power, abs=0.005)
    expected_d = math.sqrt(4.0 * 3996.0 / (3600.0 * math.pi * HVAC_DUCT_VELOCITY)) * 1000.0
    assert vs.duct_diameter_mm == pytest.approx(expected_d, abs=0.5)


# ============================================================
#  BSL-2 全链路集成（calculate_hvac）
# ============================================================
def test_bsl2_calculate_hvac_integration():
    """BSL-2 五大功能集成：负荷→通风→压差→废气→系统选型。"""
    result = calculate_hvac(_bsl2_input())

    # 负荷
    assert result.load.total_cooling_load_w == pytest.approx(17483.0, abs=0.5)
    assert result.load.total_heating_load_w == pytest.approx(10302.9, abs=0.5)
    # 通风
    assert result.ventilation.total_exhaust_m3h == pytest.approx(3996.0, abs=0.2)
    assert result.ventilation.face_velocity_used_mps == 0.5
    # 压差
    pc_by_name = {r.room_name: r for r in result.pressure_control.rooms}
    assert pc_by_name["核心实验区"].target_pressure_pa == pytest.approx(-20.0)
    # 废气处理
    assert "HEPA" in result.exhaust_treatment.process_scheme
    # 系统选型
    assert "独立排风" in result.ventilation_system.recommended_system_type
    # 规范引用与公式说明
    assert len(result.regulation_references) >= 5
    assert len(result.formula_explanations) >= 10


# ============================================================
#  洁净室冷热负荷计算
# ============================================================
def test_cleanroom_cooling_load_components():
    """洁净室冷负荷分项校核。

      side = √50 ≈ 7.071 → wall_area = 4×7.071×3 ≈ 84.853 m²
      dt_summer = 35 − 22 = 13 ℃
      fresh_air_volume = 25 × 150 = 3750 m³/h
      fresh_air_load = 1.2 × 3750 × (85−48) / 3.6 = 46250 W
      total = (551.5+325+195+216+140+5000+1000+46250) × 1.15 ≈ 61729.2 W
    """
    load = calculate_cooling_heating_load(**_cleanroom_load_kwargs())
    assert load.wall_load_w == pytest.approx(551.5, abs=0.3)
    assert load.window_load_w == pytest.approx(0.0, abs=1e-6)
    assert load.roof_load_w == pytest.approx(325.0, abs=1e-6)
    assert load.floor_load_w == pytest.approx(195.0, abs=1e-6)
    assert load.personnel_sensible_w == pytest.approx(2 * HVAC_PERSON_SENSIBLE_W)
    assert load.personnel_latent_w == pytest.approx(2 * HVAC_PERSON_LATENT_W)
    assert load.equipment_load_w == pytest.approx(5000.0)
    assert load.lighting_load_w == pytest.approx(1000.0)
    assert load.fresh_air_load_w == pytest.approx(46250.0, abs=0.3)
    assert load.total_cooling_load_w == pytest.approx(61729.2, abs=0.5)


def test_cleanroom_heating_load():
    """洁净室冬季热负荷校核。

      dt_winter = 20 − (−5) = 25 ℃
      fresh_air_heat = 1.2 × 3750 × 1.005 × 25 / 3.6 = 31406.25 W
      total ≈ (1060.66+625+375+31406.25) × 1.15 ≈ 38486.9 W
    """
    load = calculate_cooling_heating_load(**_cleanroom_load_kwargs())
    assert load.total_heating_load_w == pytest.approx(38486.9, abs=0.5)


def test_cleanroom_higher_ach_higher_fresh_air_load():
    """洁净室 ACH=25 > BSL-2 ACH=10，新风负荷应显著更大。"""
    cr_load = calculate_cooling_heating_load(**_cleanroom_load_kwargs())
    bsl_load = calculate_cooling_heating_load(**_bsl2_load_kwargs())
    assert cr_load.fresh_air_load_w > bsl_load.fresh_air_load_w
    # 46250 vs 10500
    assert cr_load.fresh_air_load_w == pytest.approx(46250.0, abs=1.0)
    assert bsl_load.fresh_air_load_w == pytest.approx(10500.0, abs=1.0)


# ============================================================
#  洁净室通风量计算
# ============================================================
def test_cleanroom_ventilation_no_fume_hood():
    """洁净室无通风柜，全面通风控制。

      volume = 50 × 3 = 150 m³
      general = 25 × 150 = 3750 m³/h
      local = 0（无通风柜）
      total = max(3750, 0) = 3750 m³/h
      fresh = max(2×30, 0) = 60 m³/h
    """
    v = calculate_ventilation(**_cleanroom_vent_kwargs())
    assert v.air_change_rate_used == HVAC_ACH_TABLE["cleanroom"]
    assert v.face_velocity_used_mps == 0.3  # 无毒操作默认
    assert v.general_ventilation_m3h == pytest.approx(3750.0, abs=1e-6)
    assert v.local_exhaust_m3h == pytest.approx(0.0, abs=1e-6)
    assert v.total_exhaust_m3h == pytest.approx(3750.0, abs=1e-6)
    assert v.fresh_air_m3h == pytest.approx(60.0, abs=1e-6)


def test_cleanroom_ventilation_makeup_system_type():
    """无通风柜 → 推荐补风系统（22K523 系统类型4）。"""
    v = calculate_ventilation(**_cleanroom_vent_kwargs())
    assert "补风" in v.recommended_system_type


# ============================================================
#  洁净室压差控制
# ============================================================
def test_cleanroom_pressure_positive_gradient():
    """洁净室正压梯度（GB 50333-2013）：
       走廊 0 / 缓冲间 +10 / 核心 +15 / 操作间 +15 Pa。
    """
    pc = calculate_pressure_control(
        lab_type=HVACLabType.CLEANROOM,
        room_sequence=["走廊", "缓冲间", "核心洁净区", "操作间"],
        area=50.0,
    )
    by_name = {r.room_name: r for r in pc.rooms}
    assert by_name["走廊"].target_pressure_pa == pytest.approx(0.0)
    assert by_name["缓冲间"].target_pressure_pa == pytest.approx(10.0)
    assert by_name["核心洁净区"].target_pressure_pa == pytest.approx(15.0)
    assert by_name["操作间"].target_pressure_pa == pytest.approx(15.0)


def test_cleanroom_pressure_all_positive():
    """洁净室各房间均为正压或零压（与 BSL-2 相反）。"""
    pc = calculate_pressure_control(
        lab_type=HVACLabType.CLEANROOM,
        room_sequence=["走廊", "缓冲间", "核心洁净区", "操作间"],
        area=50.0,
    )
    for r in pc.rooms:
        assert r.target_pressure_pa >= 0.0


def test_cleanroom_pressure_leak_formula():
    """洁净室缝隙渗漏量校核：
      A_eff = 50 × 0.003 = 0.15 m²
      缓冲间 +10Pa：L = 0.827 × 0.15 × √10 × 3600 ≈ 1412.3 m³/h
      核心 +15Pa：L = 0.827 × 0.15 × √15 × 3600 ≈ 1729.6 m³/h
    """
    pc = calculate_pressure_control(
        lab_type=HVACLabType.CLEANROOM,
        room_sequence=["缓冲间", "核心洁净区"],
        area=50.0,
    )
    a_eff = 50.0 * HVAC_CRACK_AREA_PER_M2
    by_name = {r.room_name: r for r in pc.rooms}
    expected_buf = HVAC_LEAK_COEFF * a_eff * math.sqrt(10.0) * 3600.0
    assert by_name["缓冲间"].supply_exhaust_diff_m3h == pytest.approx(expected_buf, abs=0.5)
    expected_core = HVAC_LEAK_COEFF * a_eff * math.sqrt(15.0) * 3600.0
    assert by_name["核心洁净区"].supply_exhaust_diff_m3h == pytest.approx(expected_core, abs=0.5)


def test_cleanroom_pressure_control_mode_cav():
    """洁净室推荐定风量 CAV 控压。"""
    pc = calculate_pressure_control(
        lab_type=HVACLabType.CLEANROOM,
        room_sequence=["走廊", "缓冲间", "核心洁净区"],
        area=50.0,
    )
    assert "CAV" in pc.recommended_control_mode or "定风量" in pc.recommended_control_mode


def test_cleanroom_unmatched_room_step_pressure():
    """洁净室未匹配关键词房间按 5Pa 梯度递增（GB 50333-2013）。"""
    pc = calculate_pressure_control(
        lab_type=HVACLabType.CLEANROOM,
        room_sequence=["未知房间A", "未知房间B", "未知房间C"],
        area=50.0,
    )
    # 第1间 1×5=5，第2间 2×5=10，第3间 3×5=15
    pressures = [r.target_pressure_pa for r in pc.rooms]
    assert pressures == pytest.approx([5.0, 10.0, 15.0])


# ============================================================
#  洁净室废气处理
# ============================================================
def test_cleanroom_exhaust_acid_scrubber():
    """洁净室酸性废气 → 喷淋塔中和处理（22K523）。"""
    et = calculate_exhaust_treatment(
        lab_type=HVACLabType.CLEANROOM,
        exhaust_gas_type=ExhaustGasType.ACID,
        exhaust_volume=3750.0,
    )
    assert "喷淋塔" in et.process_scheme
    assert et.filtration_efficiency is None  # 酸性废气无 HEPA


def test_cleanroom_exhaust_fire_damper_requirement():
    """排风主管设防火阀（70℃关闭，GB 50016-2014）。"""
    et = calculate_exhaust_treatment(
        lab_type=HVACLabType.CLEANROOM,
        exhaust_gas_type=ExhaustGasType.ACID,
        exhaust_volume=3750.0,
    )
    assert "防火阀" in et.emission_requirements
    assert "70℃" in et.emission_requirements


# ============================================================
#  洁净室通风系统选型
# ============================================================
def test_cleanroom_system_independent_exhaust():
    """洁净室 → 系统类型3 独立排风系统。"""
    vs = select_ventilation_system(
        lab_type=HVACLabType.CLEANROOM,
        fume_hood_count=0,
        total_exhaust_volume=3750.0,
        fresh_air_volume=60.0,
        exhaust_gas_type=ExhaustGasType.ACID,
        duct_length_m=30.0,
    )
    assert "独立排风" in vs.recommended_system_type


def test_cleanroom_system_fan_params():
    """风机参数校核：
      fan_flow = 3750 × 1.1 = 4125 m³/h
      fan_pressure = (1.0×30 + 500[酸喷淋]) × 1.1 = 583.0 Pa
      fan_power = 4125 × 583 / (3600×0.6) / 1000 ≈ 1.113 kW
      duct_diameter = √(4×3750/(3600×π×7))×1000 ≈ 435.3 mm
    """
    vs = select_ventilation_system(
        lab_type=HVACLabType.CLEANROOM,
        fume_hood_count=0,
        total_exhaust_volume=3750.0,
        fresh_air_volume=60.0,
        exhaust_gas_type=ExhaustGasType.ACID,
        duct_length_m=30.0,
    )
    assert vs.fan_flow_m3h == pytest.approx(3750.0 * HVAC_FAN_FLOW_MARGIN, abs=0.5)
    accessory_dp = HVAC_ACCESSORY_PRESSURE["acid"]
    expected_pressure = (HVAC_DUCT_FRICTION * 30.0 + accessory_dp) * HVAC_FAN_PRESSURE_MARGIN
    assert vs.fan_pressure_pa == pytest.approx(expected_pressure, abs=0.5)
    expected_d = math.sqrt(4.0 * 3750.0 / (3600.0 * math.pi * HVAC_DUCT_VELOCITY)) * 1000.0
    assert vs.duct_diameter_mm == pytest.approx(expected_d, abs=0.5)


# ============================================================
#  洁净室全链路集成（calculate_hvac）
# ============================================================
def test_cleanroom_calculate_hvac_integration():
    """洁净室五大功能集成：负荷→通风→压差→废气→系统选型。"""
    result = calculate_hvac(_cleanroom_input())

    # 负荷
    assert result.load.total_cooling_load_w == pytest.approx(61729.2, abs=0.5)
    assert result.load.total_heating_load_w == pytest.approx(38486.9, abs=0.5)
    # 通风
    assert result.ventilation.general_ventilation_m3h == pytest.approx(3750.0, abs=1e-6)
    assert result.ventilation.total_exhaust_m3h == pytest.approx(3750.0, abs=1e-6)
    # 压差（正压）
    pc_by_name = {r.room_name: r for r in result.pressure_control.rooms}
    assert pc_by_name["缓冲间"].target_pressure_pa == pytest.approx(10.0)
    assert pc_by_name["核心洁净区"].target_pressure_pa == pytest.approx(15.0)
    # 废气处理（酸性 → 喷淋塔）
    assert "喷淋塔" in result.exhaust_treatment.process_scheme
    assert result.exhaust_treatment.filtration_efficiency is None
    # 系统选型（独立排风）
    assert "独立排风" in result.ventilation_system.recommended_system_type
    # 规范引用
    assert any("GB 50346" in ref for ref in result.regulation_references)
    assert any("22K523" in ref for ref in result.regulation_references)


# ============================================================
#  BSL-2 与洁净室对比测试
# ============================================================
def test_bsl2_vs_cleanroom_pressure_sign_opposite():
    """BSL-2 负压 vs 洁净室正压，符号相反。"""
    bsl2_pc = calculate_pressure_control(
        lab_type=HVACLabType.BSL2,
        room_sequence=["缓冲间"],
        area=30.0,
    )
    cr_pc = calculate_pressure_control(
        lab_type=HVACLabType.CLEANROOM,
        room_sequence=["缓冲间"],
        area=50.0,
    )
    assert bsl2_pc.rooms[0].target_pressure_pa < 0  # BSL-2 缓冲间 -10
    assert cr_pc.rooms[0].target_pressure_pa > 0   # 洁净室 缓冲间 +10


def test_bsl2_vs_cleanroom_control_mode_differs():
    """BSL-2 用 VAV，洁净室用 CAV，控制方式不同。"""
    bsl2_pc = calculate_pressure_control(
        lab_type=HVACLabType.BSL2,
        room_sequence=["走廊", "核心实验区"],
        area=30.0,
    )
    cr_pc = calculate_pressure_control(
        lab_type=HVACLabType.CLEANROOM,
        room_sequence=["走廊", "核心洁净区"],
        area=50.0,
    )
    assert "VAV" in bsl2_pc.recommended_control_mode
    assert "CAV" in cr_pc.recommended_control_mode


def test_cleanroom_higher_ach_than_bsl2():
    """洁净室换气次数 25 > BSL-2 生物学实验室 10。"""
    assert HVAC_ACH_TABLE["cleanroom"] > HVAC_ACH_TABLE["biological_lab"]
