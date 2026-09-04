"""
弱电智能化计算服务模块 (Weak Current Service)
==============================================
依 GB 50311-2016 综合布线 / GB 50314-2015 智能建筑 / GB 50395-2007 视频监控 /
GB 50396-2007 出入口控制 / GB 50346-2011 BSL / GB 50333-2013 洁净手术部 /
GB 50116-2013 火灾报警 / GB 50343-2012 防雷 / GB 50057-2010 接地 /
T/CPPC 1080.1-2024 实验室智慧化指南，实现：

    1. 信息点计算 calculate_info_points      （数据/语音/环境/视频 + 配线架 + 冗余）
    2. 线缆用量 calculate_cable_length        （水平 + 垂直干线 + 箱数）
    3. 安防设备 calculate_security_devices    （摄像/门禁/报警 + 存储估算）
    4. 环境监测 calculate_env_sensors         （温湿度/压差/CO2/粒子/漏水 + 协议）
    5. 防雷接地 check_lightning_protection    （B/C/D 级 SPD + 等电位）
    6. 总入口 calculate_weak_current -> WeakCurrentResult

注：密度/间距为规范量级与工程惯例的简化预设，条款号以现行有效版本原文为准，
    AI 初算值必须持证工程师复核。
"""
from __future__ import annotations

import math
from typing import Final

from app.schemas.weak_current import (
    CableUsage, EnvSensors, InfoPointDetail, LightningProtection,
    SecurityDevices, WeakCurrentInput, WeakCurrentResult,
)

# ============================================================
# 预设常量区（集中维护，工程师可校准）
# ============================================================

# 数据信息点密度（GB 50311-2016 / GB 50314-2015 分级配置量级）
#   per_ws: 每工位数据点; per_device: 每台设备点; cabinet_ports: 每机柜端口(配线架)
#   env_per_room: 环境监测点/间; video_per_room: 视频点/间
DATA_POINT_RULES: Final[dict[str, dict[str, float]]] = {
    "lab":         {"per_ws": 2, "per_device": 1, "env_per_room": 0},
    "office":      {"per_ws": 2, "per_device": 0, "env_per_room": 0},
    "server_room": {"cabinet_ports": 24, "env_per_room": 0},
    "cleanroom":   {"per_ws": 2, "per_device": 0, "env_per_room": 4},   # 温湿度/压差/粒子/门禁联锁
    "bsl2":        {"per_ws": 2, "per_device": 0, "env_per_room": 6},   # +气溶胶/门禁/视频
    "bsl3":        {"per_ws": 2, "per_device": 0, "env_per_room": 6},
    "storage":     {"per_room": 1, "per_device": 0, "env_per_room": 0, "video_per_room": 1},
}
VOICE_PER_WS: Final = 0.5            # 语音点 = 工位 × 0.5 向上取整（GB 50311 语音预留惯例）
REDUNDANCY: Final = 0.15             # 预留冗余 10%~15%，取上限保守（GB 50311-2016 预留量级）
PANEL_PORTS_24: Final = 24
PANEL_PORTS_48: Final = 48

# 线缆参数（GB 50311-2016）
CABLE_SPARE_FACTOR: Final = 1.1      # 两端余量/冗余系数
CABLE_BOX_M: Final = 305.0           # 每箱 305 m（GB 50311 布线长度限值量级）
POINTS_PER_RISER: Final = 24         # 每 24 点 1 根垂直干线（1 根 4 对线/24 口配线架惯例）

# 安防参数（GB 50395-2007 视频监控 / GB 50396-2007 门禁 / GB 50346-2011 BSL）
CAM_AREA_PER_UNIT: Final = 50.0      # 室内半球：每 50㎡ 1 个
CAM_CORRIDOR_M_PER_UNIT: Final = 15.0  # 走廊枪机：每 15m 1 个
VIDEO_BITRATE_MBPS: Final = 4.0      # 单路码率估算 (1080P 主码流量级，可按实际调整)
VIDEO_BIT_S: Final = 86400           # 每天秒数
GB_PER_DAY_PER_CAM: Final = VIDEO_BITRATE_MBPS * VIDEO_BIT_S / 8 / 1000  # 43.2 GB/天/路

# 环境传感器（GB 50346-2011 / GB 50333-2013 / T/CPPC 1080.1-2024）
CO2_AREA_PER_UNIT: Final = 100.0     # 办公 CO2：每 100㎡ 1 个（GB/T 18883 室内空气联动）

# 防雷接地（GB 50343-2012 / GB 50057-2010）
SPD_PER_FRONTEND_PORTS: Final = 24   # 每 24 口配线架/机柜级前端 1 个 D 级 SPD


def _ceil(x: float) -> int:
    return int(math.ceil(x))


# ============================================================
# 1. 信息点计算
# ============================================================
def calculate_info_points(inp: WeakCurrentInput) -> tuple[InfoPointDetail, int, list[str]]:
    """
    信息点计算（GB 50311-2016 信息点配置 / GB 50314-2015 分级）：
        data  = 工位×per_ws + 设备×per_device（机房=机柜×24口；存储间=1/间）
        voice = ⌈工位 × 0.5⌉
        env   = 按类型预设（洁净 4/间、BSL 6/间）
        video = 存储间 1/间
        total_with_redundancy = ⌈(data+voice+env+video) × 1.15⌉
        配线架 = ⌈冗余后点数 / 24口 或 48口⌉

    返回 (明细, 水平布线点数(数据+语音+视频), notes)。环境传感器走 RS485 总线不计水平布线。
    """
    notes: list[str] = []
    rt = inp.room_type.value
    rule = DATA_POINT_RULES[rt]

    if rt == "server_room":
        cabinets = inp.equipment_count if inp.equipment_count > 0 else 1
        data = cabinets * int(rule["cabinet_ports"])
        notes.append(f"机房数据点 = 机柜数({cabinets}) × 24口/柜配线架 = {data}（GB 50311-2016 机房布线量级）")
    elif rt == "storage":
        data = int(rule["per_room"])
        notes.append("存储间数据点 = 1/间")
    else:
        data = inp.workstation_count * int(rule["per_ws"]) + inp.equipment_count * int(rule["per_device"])
        notes.append(f"数据点 = 工位{inp.workstation_count}×{rule['per_ws']} + 设备{inp.equipment_count}×{rule['per_device']} = {data}"
                     f"（GB 50311-2016 / GB 50314-2015 量级）")

    voice = _ceil(inp.workstation_count * VOICE_PER_WS)
    env = int(rule["env_per_room"])
    video = int(rule.get("video_per_room", 0))
    if env:
        notes.append(f"环境监测点 = {env}/间（GB 50346-2011 / GB 50333-2013 环境联动要求）")

    total = data + voice + env + video
    redundant = _ceil(total * (1 + REDUNDANCY))
    notes.append(f"总点 {total} × (1+{REDUNDANCY:.0%}) → {redundant}（GB 50311-2016 预留 10%~15% 取上限）")

    detail = InfoPointDetail(
        data_points=data, voice_points=voice, env_points=env, video_points=video,
        total=total, redundancy_pct=REDUNDANCY, total_with_redundancy=redundant,
        panels_24=_ceil(redundant / PANEL_PORTS_24), panels_48=_ceil(redundant / PANEL_PORTS_48),
    )
    horizontal_points = data + voice + video   # 环境传感器走 RS485 总线，不计综合布线
    return detail, horizontal_points, notes


# ============================================================
# 2. 线缆用量计算
# ============================================================
def calculate_cable_length(
    point_count: int, avg_distance_m: float, floor_count: int, floor_height: float,
) -> tuple[CableUsage, list[str]]:
    """
    线缆用量（GB 50311-2016）：
        单点水平 = avg_distance × 1.1（两端余量/冗余系数）
        水平总量 = point_count × 单点长度 → 箱数 = ⌈水平 / 305⌉
        垂直干线 = 层高 × 楼层数 × ⌈point_count/24⌉（每 24 点 1 根）
    """
    notes: list[str] = []
    per_point = avg_distance_m * CABLE_SPARE_FACTOR
    horizontal = point_count * per_point
    boxes = _ceil(horizontal / CABLE_BOX_M) if horizontal > 0 else 0
    risers = _ceil(point_count / POINTS_PER_RISER) if point_count > 0 else 0
    vertical = floor_height * floor_count * risers
    total = horizontal + vertical

    notes.append(f"线缆(GB 50311-2016): 单点={avg_distance_m}×{CABLE_SPARE_FACTOR}={per_point:.1f}m; "
                 f"水平={point_count}点×{per_point:.1f}={horizontal:.0f}m → {boxes} 箱(305m/箱)")
    notes.append(f"垂直干线: {risers} 根(每{POINTS_PER_RISER}点1根) × {floor_height}m×{floor_count}层 = {vertical:.0f}m; 总量 {total:.0f}m")

    usage = CableUsage(
        per_point_m=round(per_point, 1), horizontal_m=round(horizontal), horizontal_boxes=boxes,
        vertical_m=round(vertical), total_m=round(total), riser_count=risers,
    )
    return usage, notes


# ============================================================
# 3. 安防设备计算
# ============================================================
def calculate_security_devices(
    inp: WeakCurrentInput,
) -> tuple[SecurityDevices, int, list[str]]:
    """
    安防设备（GB 50395-2007 视频监控 / GB 50396-2007 门禁 / GB 50346-2011 BSL）：
        摄像: 室内半球 ⌈area/50⌉ + 走廊枪机 ⌈L/15⌉ + 每门 1 + BSL 附加(每门内外各1+缓冲间1)
        门禁: 每门 1 套（BSL 含互锁逻辑，机房含读卡器）
        入侵: 存储间/危化品间 1 红外/间
        存储: 单路 4Mbps × 86400s ≈ 43.2 GB/天 → 30/90 天 × 摄像机数
    返回 (清单, 弱电设备计数贡献, notes)
    """
    notes: list[str] = []
    rt = inp.room_type.value
    dome = _ceil(inp.area / CAM_AREA_PER_UNIT)
    bullet = _ceil(inp.corridor_length / CAM_CORRIDOR_M_PER_UNIT) if inp.corridor_length > 0 else 0
    door_cam = inp.door_count
    bsl_extra = (inp.door_count * 2 + 1) if rt in ("bsl2", "bsl3") else 0
    cams = dome + bullet + door_cam + bsl_extra
    notes.append(f"摄像(GB 50395-2007): 半球⌈{inp.area}/50⌉={dome}; 枪机⌈{inp.corridor_length}/15⌉={bullet}; "
                 f"出入口={door_cam}; BSL附加={bsl_extra} → 共 {cams} 路")

    access = inp.door_count
    readers = inp.door_count
    if rt in ("bsl2", "bsl3"):
        notes.append(f"门禁 {access} 套（GB 50346-2011 BSL 门互锁/联锁要求，缓冲间双门互锁）")
    elif rt == "server_room":
        notes.append(f"门禁 {access} 套 + 读卡器（GB 50396-2007 出入口控制）")
    else:
        notes.append(f"门禁 {access} 套（按主要出入口配置，实际按建筑平面由工程师删减，GB 50396-2007）")

    intrusion = 1 if rt == "storage" else 0
    if intrusion:
        notes.append("入侵报警: 存储间/危化品间 1 红外探测器/间（GB 50396-2007 / 安防惯例）")

    g30 = cams * GB_PER_DAY_PER_CAM * 30
    g90 = cams * GB_PER_DAY_PER_CAM * 90
    notes.append(f"存储: {cams}路 × {VIDEO_BITRATE_MBPS}Mbps × 86400s ≈ {GB_PER_DAY_PER_CAM:.1f}GB/天/路 → "
                 f"30天 {g30 / 1000:.1f}TB / 90天 {g90 / 1000:.1f}TB（GB 50395-2007 记录保存要求量级）")

    devices = SecurityDevices(
        cameras_dome=dome, cameras_bullet=bullet, cameras_door=door_cam,
        cameras_bsl_extra=bsl_extra, cameras_total=cams,
        access_control_sets=access, card_readers=readers, intrusion_detectors=intrusion,
        video_storage_30d_tb=round(g30 / 1000, 1), video_storage_90d_tb=round(g90 / 1000, 1),
        storage_note=f"按 {VIDEO_BITRATE_MBPS}Mbps/路 码率估算，实际按摄像机分辨率与帧率调整",
    )
    return devices, cams + access, notes


# ============================================================
# 4. 环境监测点位计算
# ============================================================
def calculate_env_sensors(
    inp: WeakCurrentInput,
) -> tuple[EnvSensors, int, list[str]]:
    """
    环境传感器（GB 50346-2011 / GB 50333-2013 / T/CPPC 1080.1-2024）：
        温湿度: 每空调分区 1
        压差:   BSL-2/3 每间 1（负压联锁），洁净室每洁净等级区域 1
        CO2:    办公 ⌈area/100⌉
        粒子:   洁净室/BSL-3 每间 1
        漏水:   机房每间 1 套
    """
    notes: list[str] = []
    rt = inp.room_type.value
    th = inp.hvac_zones
    dp = 1 if rt in ("bsl2", "bsl3", "cleanroom") else 0
    co2 = _ceil(inp.area / CO2_AREA_PER_UNIT) if rt == "office" else 0
    particle = 1 if rt in ("cleanroom", "bsl3") else 0
    leak = 1 if rt == "server_room" else 0
    total = th + dp + co2 + particle + leak

    protocol = {
        "server_room": "BACnet/IP（BA 集成）+ Modbus 网关",
        "bsl2": "RS485/Modbus-RTU（压差信号硬接线参与联锁，GB 50346-2011）",
        "bsl3": "RS485/Modbus-RTU（压差信号硬接线参与联锁，GB 50346-2011）",
        "cleanroom": "RS485/Modbus-RTU（接入洁净环境监控平台，GB 50333-2013）",
        "office": "BACnet/KNX（BA 系统照明与空调联动，GB 50189-2015）",
        "lab": "RS485/Modbus-RTU（接入实验室环境监控平台）",
        "storage": "RS485/Modbus-RTU",
    }[rt]
    notes.append(f"环境传感器(GB 50346/GB 50333/T-CPPC 1080.1): 温湿度{th}(每分区1) + 压差{dp} + CO2={co2}"
                 f"(⌈{inp.area}/100⌉) + 粒子{particle} + 漏水{leak} → 共 {total}")
    notes.append(f"通讯协议: {protocol}")

    sensors = EnvSensors(
        temp_humidity=th, differential_pressure=dp, co2=co2, particle_counter=particle,
        leak_detection=leak, total=total, protocol=protocol,
    )
    return sensors, total, notes


# ============================================================
# 5. 防雷与接地校核
# ============================================================
def check_lightning_protection(
    device_count: int, lightning_class: str,
) -> tuple[LightningProtection, list[str]]:
    """
    防雷与接地（GB 50343-2012 / GB 50057-2010）：
        总配电箱 1 × B 级 SPD；分配电箱 1 × C 级 SPD（按楼层配电箱数增减）；
        弱电设备前端 ⌈device/24⌉ × D 级 SPD（每 24 口配线架/机柜级）；
        等电位连接: 每设备金属外壳 + LEB 汇流排（桥架/线槽端部接地）。
    """
    notes: list[str] = []
    spd_b, spd_c = 1, 1
    spd_d = _ceil(device_count / SPD_PER_FRONTEND_PORTS) if device_count > 0 else 1
    equipotential = device_count + 1
    cls = lightning_class if lightning_class in ("I", "II", "III") else "II"
    notes.append(f"SPD(GB 50343-2012): B级{spd_b}(总配电箱) + C级{spd_c}(分配电箱) + "
                 f"D级{spd_d}(⌈{device_count}/24⌉ 前端); 等电位 {equipotential} 点(设备外壳+LEB)")
    notes.append(f"防雷等级 {cls} 类：SPD 参数（In/Imax/Uc）按 GB 50343-2012 分级表选取，"
                 "所有弱电桥架/线槽端部做等电位连接并接地（GB 50057-2010）")

    check = LightningProtection(
        spd_b=spd_b, spd_c=spd_c, spd_d=spd_d, equipotential_points=equipotential,
        lightning_class=cls, device_count=device_count,
        note="B/C/D 三级 SPD 配置为最低要求，等电位连接点含设备金属外壳与桥架端部",
    )
    return check, notes


# ============================================================
# 6. 总入口
# ============================================================
def calculate_weak_current(inp: WeakCurrentInput) -> WeakCurrentResult:
    """信息点 → 线缆 → 安防 → 环境监测 → 防雷接地 → WeakCurrentResult。"""
    notes: list[str] = []

    points, horizontal_points, p_notes = calculate_info_points(inp)
    notes.extend(p_notes)

    pc = inp.point_count if inp.point_count is not None else horizontal_points
    cable, c_notes = calculate_cable_length(pc, inp.avg_distance_m, inp.floor_count, inp.floor_height)
    notes.extend(c_notes)

    security, sec_devices, s_notes = calculate_security_devices(inp)
    notes.extend(s_notes)

    sensors, env_total, e_notes = calculate_env_sensors(inp)
    notes.extend(e_notes)

    device_count = (inp.device_count if inp.device_count is not None
                    else points.total_with_redundancy + security.cameras_total
                    + security.access_control_sets + sensors.total)
    lightning, l_notes = check_lightning_protection(device_count, inp.lightning_class)
    notes.extend(l_notes)
    notes.append("本结果为方案阶段 AI 初算值，必须持证工程师复算校验；规范条款号以现行有效版本原文为准")

    tips = [
        f"水平布线建议 Cat6/6A 非屏蔽（电磁环境复杂区域可用屏蔽或光纤），链路长度限值 90m 永久链路（GB 50311-2016）",
        f"配线架按 {points.panels_24}×24口 或 {points.panels_48}×48口 配置，机柜 U 数按设备清单由工程师核算",
    ]
    if inp.room_type.value in ("bsl2", "bsl3"):
        tips.append("BSL 门禁必须与压差/电力联锁：断电或负压失效时应急解锁并报警（GB 50396-2007 应急解锁 + GB 50346-2011）")
    if inp.room_type.value == "cleanroom":
        tips.append("洁净区域传感器穿线管密封处理，避免破坏气密性（GB 50333-2013）")
    if inp.room_type.value == "server_room":
        tips.append("机房建议 UPTIME 分级复核空调/UPS 配套，漏水和温感探测接入 BA 报警（GB 50174 相关量级）")
    tips.append("火灾自动报警（烟感/温感/消防广播）依 GB 50116-2013 专项设计，本模块未计算")
    tips.append("能耗监测表计与照明自动控制依 GB 50189-2015 配置，接入 BA/能耗平台")

    references = [
        "GB 50311-2016 综合布线系统工程设计规范（信息点/线缆/预留在量级）",
        "GB 50314-2015 智能建筑设计标准（系统分级框架）",
        "GB 50395-2007 视频安防监控系统工程设计规范（点位/存储）",
        "GB 50396-2007 出入口控制系统工程设计规范（门禁/应急解锁）",
        "GB 50346-2011 生物安全实验室建筑技术规范（BSL 门禁互锁/负压监控）",
        "GB 50333-2013 医院洁净手术部建筑技术规范（洁净环境传感联动）",
        "GB 50116-2013 火灾自动报警系统设计规范（专项设计，未计算）",
        "GB 50343-2012 建筑物电子信息系统防雷技术规范；GB 50057-2010 建筑物防雷设计规范",
        "T/CPPC 1080.1-2024 实验室智慧化建设和评价指南（数字化架构参考）",
        "GB 50339-2013 智能建筑工程质量验收规范（调试验收）；GB 50189-2015 公共建筑节能设计标准（能耗监测）",
    ]

    return WeakCurrentResult(
        info_points=points, cable=cable, security=security, env_sensors=sensors,
        lightning=lightning, selection_tips=tips, references=references, formula_notes=notes,
    )
