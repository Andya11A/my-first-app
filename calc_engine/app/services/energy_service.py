"""年运行能耗计算服务"""

def calculate_annual_energy(
    cooling_load_kw: float,
    heating_load_kw: float,
    fan_power_kw: float,
    pump_power_kw: float,
    lighting_power_kw: float,
    equipment_power_kw: float,
    operating_hours_per_day: float = 10,
    operating_days_per_year: int = 260,
    electricity_price: float = 0.8,
) -> dict:
    """计算年运行能耗和电费"""
    hours_per_year = operating_hours_per_day * operating_days_per_year

    # 各系统年耗电量（kWh）
    cooling_energy = cooling_load_kw * 0.7 * hours_per_year  # 冷机70%负荷率
    heating_energy = heating_load_kw * 0.5 * hours_per_year  # 热泵50%负荷率
    fan_energy = fan_power_kw * hours_per_year
    pump_energy = pump_power_kw * 0.8 * hours_per_year
    lighting_energy = lighting_power_kw * hours_per_year
    equipment_energy = equipment_power_kw * 0.6 * hours_per_year  # 设备60%运行率

    total_energy = cooling_energy + heating_energy + fan_energy + pump_energy + lighting_energy + equipment_energy
    annual_cost = total_energy * electricity_price

    return {
        "hours_per_year": hours_per_year,
        "cooling_energy_kwh": round(cooling_energy, 0),
        "heating_energy_kwh": round(heating_energy, 0),
        "fan_energy_kwh": round(fan_energy, 0),
        "pump_energy_kwh": round(pump_energy, 0),
        "lighting_energy_kwh": round(lighting_energy, 0),
        "equipment_energy_kwh": round(equipment_energy, 0),
        "total_energy_kwh": round(total_energy, 0),
        "annual_electricity_cost_yuan": round(annual_cost, 0),
        "electricity_price_yuan_kwh": electricity_price,
        "formula": "年耗电=功率×负荷率×年运行小时数",
    }
