"""弱电智能化模块 - 输入/输出 Pydantic Schema

核心规范：GB 50311-2016 综合布线 / GB 50314-2015 智能建筑标准 /
GB 50395-2007 视频监控 / GB 50396-2007 出入口控制 / GB 50346-2011 BSL /
GB 50333-2013 洁净手术部 / GB 50116-2013 火灾报警 / GB 50343-2012 防雷 /
T/CPPC 1080.1-2024 实验室智慧化指南
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class WeakRoomType(str, Enum):
    """弱电房间类型"""
    LAB = "lab"
    OFFICE = "office"
    SERVER_ROOM = "server_room"
    CLEANROOM = "cleanroom"
    BSL2 = "bsl2"
    BSL3 = "bsl3"
    STORAGE = "storage"


class WeakCurrentInput(BaseModel):
    """弱电计算输入（单房间模型）"""
    area: float = Field(..., gt=0, description="房间面积 (m²)")
    room_type: WeakRoomType = Field(WeakRoomType.LAB, description="房间类型")
    workstation_count: int = Field(0, ge=0, description="工位数量")
    equipment_count: int = Field(0, ge=0, description="设备数量（机房按机柜数计）")
    # ---- 线缆 ----
    avg_distance_m: float = Field(30.0, gt=0, description="房间到弱电间平均距离 (m)")
    floor_count: int = Field(1, ge=1, description="楼层数")
    floor_height: float = Field(3.0, gt=0, description="层高 (m)")
    point_count: int | None = Field(None, ge=0, description="信息点覆盖值，空则自动汇总")
    # ---- 安防 ----
    door_count: int = Field(1, ge=0, description="门数量")
    corridor_length: float = Field(0.0, ge=0, description="走廊总长度 (m)")
    # ---- 环境监测 ----
    hvac_zones: int = Field(1, ge=1, description="空调分区数量")
    # ---- 防雷接地 ----
    device_count: int | None = Field(None, ge=0, description="弱电设备总数，空则自动汇总")
    lightning_class: str = Field("II", description="建筑防雷等级: I / II / III")


class InfoPointDetail(BaseModel):
    """信息点统计（GB 50311-2016）"""
    data_points: int = Field(..., description="数据信息点")
    voice_points: int = Field(..., description="语音信息点（工位×0.5 向上取整）")
    env_points: int = Field(..., description="环境监测信息点")
    video_points: int = Field(0, description="视频监控信息点（存储间 1/间）")
    total: int = Field(..., description="总信息点（含 15% 冗余前）")
    redundancy_pct: float = Field(..., description="预留冗余比例")
    total_with_redundancy: int = Field(..., description="含冗余总点数")
    panels_24: int = Field(..., description="24 口配线架数量")
    panels_48: int = Field(..., description="48 口配线架数量")


class CableUsage(BaseModel):
    """线缆用量（GB 50311-2016）"""
    per_point_m: float = Field(..., description="单点水平线缆长度 (m)")
    horizontal_m: float = Field(..., description="水平线缆总量 (m)")
    horizontal_boxes: int = Field(..., description="水平线缆箱数 (305m/箱)")
    vertical_m: float = Field(..., description="垂直干线用量 (m)")
    total_m: float = Field(..., description="总线缆用量 (m)")
    riser_count: int = Field(..., description="垂直干线根数（每 24 点 1 根）")


class SecurityDevices(BaseModel):
    """安防设备清单（GB 50395 / GB 50396 / GB 50346）"""
    cameras_dome: int = Field(..., description="室内半球摄像机（每 50㎡ 1 个）")
    cameras_bullet: int = Field(..., description="走廊枪机（每 15m 1 个）")
    cameras_door: int = Field(..., description="出入口摄像机（每门 1 个）")
    cameras_bsl_extra: int = Field(0, description="BSL 附加（每门内外各 1 + 缓冲间 1）")
    cameras_total: int = Field(..., description="摄像机总数")
    access_control_sets: int = Field(..., description="门禁套数")
    card_readers: int = Field(..., description="读卡器数量")
    intrusion_detectors: int = Field(0, description="红外入侵探测器数量")
    video_storage_30d_tb: float = Field(..., description="30 天存储容量估算 (TB)")
    video_storage_90d_tb: float = Field(..., description="90 天存储容量估算 (TB)")
    storage_note: str = Field("", description="存储估算说明")


class EnvSensors(BaseModel):
    """环境监测点位（GB 50346 / GB 50333 / T/CPPC 1080.1）"""
    temp_humidity: int = Field(..., description="温湿度传感器（每空调分区 1）")
    differential_pressure: int = Field(0, description="压差传感器（BSL 每间 1/洁净每区域 1）")
    co2: int = Field(0, description="CO₂ 传感器（办公每 100㎡ 1）")
    particle_counter: int = Field(0, description="粒子计数器（洁净室/BSL-3 每间 1）")
    leak_detection: int = Field(0, description="漏水检测（机房每间 1 套）")
    total: int = Field(..., description="传感器总数")
    protocol: str = Field(..., description="推荐通讯协议")


class LightningProtection(BaseModel):
    """防雷与接地校核（GB 50343-2012 / GB 50057-2010）"""
    spd_b: int = Field(..., description="B 级 SPD（总配电箱）")
    spd_c: int = Field(..., description="C 级 SPD（分配电箱）")
    spd_d: int = Field(..., description="D 级 SPD（弱电设备前端）")
    equipotential_points: int = Field(..., description="等电位连接点位")
    lightning_class: str = Field(..., description="建筑防雷等级")
    device_count: int = Field(..., description="弱电设备总数")
    note: str = Field("", description="校核说明")


class WeakCurrentResult(BaseModel):
    """弱电计算总结果"""
    info_points: InfoPointDetail
    cable: CableUsage
    security: SecurityDevices
    env_sensors: EnvSensors
    lightning: LightningProtection
    selection_tips: list[str] = Field(default_factory=list, description="系统选型建议（不含具体品牌型号）")
    references: list[str] = Field(default_factory=list, description="引用规范清单")
    formula_notes: list[str] = Field(default_factory=list, description="计算公式与依据说明")
