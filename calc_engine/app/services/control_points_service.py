"""自控点位表计算服务"""

def calculate_control_points(
    room_count: int,
    ahu_count: int = 1,
    has_chiller: bool = True,
    has_boiler: bool = False,
    has_humidifier: bool = True,
) -> dict:
    """计算自控系统点位数量"""
    # 每类点位计算
    temperature_sensors = room_count + ahu_count
    humidity_sensors = room_count if has_humidifier else 0
    pressure_sensors = room_count
    airflow_sensors = ahu_count * 2  # 每个AHU送风+排风
    valve_actuators = ahu_count * 3 + (2 if has_chiller else 0) + (2 if has_boiler else 0)
    damper_actuators = ahu_count * 2
    vfd_drives = ahu_count + (1 if has_chiller else 0)

    total_points = temperature_sensors + humidity_sensors + pressure_sensors + airflow_sensors + valve_actuators + damper_actuators + vfd_drives

    # DDC控制器数量（每台带50点）
    ddc_count = max(1, (total_points + 49) // 50)

    return {
        "temperature_sensors": temperature_sensors,
        "humidity_sensors": humidity_sensors,
        "pressure_sensors": pressure_sensors,
        "airflow_sensors": airflow_sensors,
        "valve_actuators": valve_actuators,
        "damper_actuators": damper_actuators,
        "vfd_drives": vfd_drives,
        "total_points": total_points,
        "ddc_controller_count": ddc_count,
        "formula": "点位=各类传感器+执行器+变频器；DDC=ceil(总点数/50)",
    }
