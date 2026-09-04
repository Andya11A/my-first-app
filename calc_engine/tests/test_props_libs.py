"""CoolProp / PsychroLib 专业物性库验证测试
=============================================
验证两大暖通湿空气物性库在本机可用且结果交叉一致：
- CoolProp (HAPropsSI/PropsSI)：空气焓值、密度、含湿量、露点/湿球温度
- PsychroLib (ASHRAE Fundamentals 手算模型)：相对湿度、含湿量、焓值互转

工况基准（GB 50736-2012 夏季典型室内设计工况）：干球 26℃ / 相对湿度 60% / 标准大气压 101325 Pa
理论参考值（ASHRAE 手算模型）：含湿量 ≈ 12.7 g/kg干空气，比焓 ≈ 58.5 kJ/kg干空气

注意 PsychroLib 2.5.0 的 SI 制函数签名带 Pressure 参数，且模块内无版本属性（用 importlib.metadata 查）。
"""
import CoolProp
import CoolProp.CoolProp as CP
import psychrolib
import pytest
from importlib.metadata import version as pkg_version

P_ATM = 101325.0     # 标准大气压 Pa
T_DB = 26.0 + 273.15  # 干球温度 K
RH = 0.60             # 相对湿度

psychrolib.SetUnitSystem(psychrolib.SI)


# ==================== 版本与可用性 ====================


def test_coolprop_version_available():
    v = CoolProp.__version__
    assert isinstance(v, str) and v
    print(f"\nCoolProp version = {v}")


def test_psychrolib_version_available():
    v = pkg_version("psychrolib")  # 2.5.0 模块内无 GetVersion/__version__
    assert isinstance(v, str) and v
    print(f"\nPsychroLib version = {v}")


# ==================== CoolProp 能力 ====================


def test_coolprop_dry_air_density():
    """干空气密度 @25℃/101325Pa ≈ 1.184 kg/m³"""
    rho = CP.PropsSI("D", "T", 298.15, "P", P_ATM, "Air")
    assert 1.16 < rho < 1.20
    print(f"\n干空气密度(25℃) = {rho:.4f} kg/m3")


def test_coolprop_humid_air_enthalpy():
    """湿空气比焓（26℃/60%）≈ 55 kJ/kg干空气"""
    h = CP.HAPropsSI("H", "T", T_DB, "P", P_ATM, "R", RH)  # J/kg干空气
    assert 50_000 < h < 60_000
    print(f"\n湿空气比焓(26℃/60%) = {h / 1000:.2f} kJ/kg干空气")


def test_coolprop_humidity_ratio():
    """含湿量（26℃/60%）≈ 12.8 g/kg干空气"""
    w = CP.HAPropsSI("W", "T", T_DB, "P", P_ATM, "R", RH)
    assert 0.012 < w < 0.014
    print(f"含湿量 = {w * 1000:.2f} g/kg干空气")


def test_coolprop_dew_point():
    """露点温度（26℃/60%）≈ 17.6℃"""
    td = CP.HAPropsSI("DewPoint", "T", T_DB, "P", P_ATM, "R", RH)
    assert 16.5 < td - 273.15 < 18.5
    print(f"露点温度 = {td - 273.15:.2f} ℃")


def test_coolprop_wet_bulb():
    """湿球温度（26℃/60%）≈ 20.6℃（ASHRAE 模型）"""
    twb = CP.HAPropsSI("Twb", "T", T_DB, "P", P_ATM, "R", RH)
    assert 19.5 < twb - 273.15 < 21.5
    print(f"湿球温度 = {twb - 273.15:.2f} ℃")


# ==================== PsychroLib 能力 ====================


def test_psychrolib_hum_ratio_from_rh():
    """相对湿度 → 含湿量 互转（26℃/60% → ≈12.7 g/kg）"""
    w = psychrolib.GetHumRatioFromRelHum(T_DB - 273.15, RH, P_ATM)
    assert 0.012 < w < 0.014
    print(f"\nPsychroLib 含湿量 = {w * 1000:.2f} g/kg干空气")


def test_psychrolib_moist_air_enthalpy():
    """含湿量 → 湿空气焓（≈58.5 kJ/kg干空气，注意 PsychroLib 返回 J/kg）"""
    w = psychrolib.GetHumRatioFromRelHum(T_DB - 273.15, RH, P_ATM)
    h = psychrolib.GetMoistAirEnthalpy(T_DB - 273.15, w)
    assert 50_000 < h < 60_000
    print(f"PsychroLib 比焓 = {h / 1000:.2f} kJ/kg干空气")


def test_psychrolib_rel_hum_roundtrip():
    """焓值互转闭环：RH → W → RH 反算一致（<0.1%）"""
    w = psychrolib.GetHumRatioFromRelHum(T_DB - 273.15, RH, P_ATM)
    rh_back = psychrolib.GetRelHumFromHumRatio(T_DB - 273.15, w, P_ATM)
    assert abs(rh_back - RH) < 0.001
    print(f"RH→W→RH 闭环反算: {rh_back:.4f} (期望 {RH})")


def test_psychrolib_dew_point():
    """PsychroLib 露点 ≈ CoolProp 露点（两库交叉校验 <0.5℃）"""
    td = psychrolib.GetTDewPointFromRelHum(T_DB - 273.15, RH)
    assert 16.5 < td < 18.5
    td_cp = CP.HAPropsSI("DewPoint", "T", T_DB, "P", P_ATM, "R", RH) - 273.15
    assert abs(td - td_cp) < 0.5
    print(f"\n露点交叉校验: PsychroLib={td:.2f}℃ vs CoolProp={td_cp:.2f}℃")


# ==================== 两库交叉一致性 ====================


def test_cross_library_enthalpy_consistency():
    """CoolProp 与 PsychroLib 湿空气比焓交叉校验（差异 <1%，同为 ASHRAE 模型）"""
    h_cp = CP.HAPropsSI("H", "T", T_DB, "P", P_ATM, "R", RH)
    w_pl = psychrolib.GetHumRatioFromRelHum(T_DB - 273.15, RH, P_ATM)
    h_pl = psychrolib.GetMoistAirEnthalpy(T_DB - 273.15, w_pl)
    # 注：CoolProp HAPropsSI 的 H 以 0℃ 干空气+液态水 为基准，PsychroLib 以 0℃ 干空气+液态水 同基准
    assert abs(h_cp - h_pl) / h_pl < 0.01
    print(f"\n焓值交叉校验: CoolProp={h_cp / 1000:.2f} vs PsychroLib={h_pl / 1000:.2f} kJ/kg干空气")


def test_cross_library_humidity_ratio_consistency():
    """CoolProp 与 PsychroLib 含湿量交叉校验（差异 <1%）"""
    w_cp = CP.HAPropsSI("W", "T", T_DB, "P", P_ATM, "R", RH)
    w_pl = psychrolib.GetHumRatioFromRelHum(T_DB - 273.15, RH, P_ATM)
    assert abs(w_cp - w_pl) / w_pl < 0.01
    print(f"含湿量交叉校验: CoolProp={w_cp * 1000:.2f} vs PsychroLib={w_pl * 1000:.2f} g/kg")
