"""UPS容量计算服务"""

BATTERY_VOLTAGES = [12, 24, 36, 48, 96, 192, 240, 384, 480]

def calculate_ups_capacity(
    total_load_kw: float,
    power_factor: float = 0.9,
    backup_time_min: int = 30,
    system_efficiency: float = 0.95,
    battery_voltage: float = 384,
) -> dict:
    """计算UPS容量和电池配置"""
    # 1. UPS容量（kVA）= 负载kW / PF
    ups_kva = total_load_kw / power_factor
    # 取标准容量（10/20/30/40/60/80/100/120/160/200 kVA）
    standard_kva = [10, 20, 30, 40, 60, 80, 100, 120, 160, 200, 250, 300]
    recommended_kva = min([s for s in standard_kva if s >= ups_kva * 1.2], default=standard_kva[-1])

    # 2. 电池容量计算
    # 电池总功率需求 = 负载kW × 备电时间 / 效率
    battery_power_kwh = total_load_kw * backup_time_min / 60.0 / system_efficiency
    # 电池容量Ah = 电池能量Wh / 电池电压
    battery_capacity_ah = battery_power_kwh * 1000.0 / battery_voltage

    # 3. 电池数量（12V电池串联达到电池电压）
    battery_count = int(battery_voltage / 12)

    return {
        "ups_capacity_kva_calculated": round(ups_kva, 2),
        "ups_capacity_kva_recommended": recommended_kva,
        "backup_time_min": backup_time_min,
        "battery_energy_kwh": round(battery_power_kwh, 2),
        "battery_voltage_v": battery_voltage,
        "battery_capacity_ah": round(battery_capacity_ah, 1),
        "battery_count": battery_count,
        "battery_spec": f"{battery_count}×12V {round(battery_capacity_ah / battery_count, 1)}Ah 串联",
        "formula": "UPS容量 = 负载kW / PF；电池能量 = 负载 × 备电时间 / 效率",
    }
