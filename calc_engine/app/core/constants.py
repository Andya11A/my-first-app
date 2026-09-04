"""工程常量与规范推荐值（集中管理，便于按规范版本统一升级）。

规范依据:
- GB 50019-2015《工业建筑供暖通风与空气调节设计规范》
- GB 50243-2016《通风与空调工程施工质量验收规范》
- GB 19489-2008《实验室 生物安全通用要求》
- GB 50016《建筑设计防火规范》(可燃气体)
- GB/T 50934《石油化工可燃性气体检测报警设计规范》
"""
from __future__ import annotations

# ==================== 暖通 HVAC ====================

# 通风柜操作面风速 (m/s)，规范推荐 0.4~0.6
FACE_VELOCITY_DEFAULT = 0.5

# 各类实验室推荐换气次数 (次/h): (规范下限, 推荐设计值)
AIR_CHANGE_RECOMMEND: dict[str, tuple[float, float]] = {
    "chemistry": (8.0, 10.0),   # 化学实验室
    "biology": (10.0, 12.0),    # 生物安全实验室 (BSL-2 通常 10~15)
    "physics": (6.0, 8.0),      # 物理/精密仪器
    "general": (5.0, 6.0),      # 通用辅助房间
}

# 无面风速参数设备的单台默认排风量 (m³/h)
DEVICE_DEFAULT_FLOW: dict[str, float] = {
    "snorkel": 250.0,            # 万向排风罩
    "biosafety_cabinet": 900.0,  # II 级生物安全柜 (30% 外排约 700~1000)
    "general_exhaust": 0.0,      # 仅参与全面排风，不计局部排风
}

# 补风比例经验区间 (缺 10%~20% 维持房间负压)
SUPPLY_RATIO_RANGE = (0.8, 0.9)
SUPPLY_RATIO_DEFAULT = 0.85

# 负荷估算参数
ENCLOSURE_U_VALUE = 0.8        # 彩钢夹芯板围护传热系数 W/(m²·K)
AIR_DENSITY = 1.2              # 空气密度 kg/m³
AIR_CP = 1.005                 # 空气定压比热 kJ/(kg·K)
LIGHTING_W_PER_M2 = 10.0       # 照明安装功率 W/m² (LED)
HEAT_PER_PERSON_W = 120.0      # 人员全热 W/人
EQUIPMENT_DIVERSITY = 0.7      # 设备同时使用系数
COOLING_SAFETY_FACTOR = 1.1    # 冷负荷安全系数
HEATING_SAFETY_FACTOR = 1.1

# 风管设计风速 (m/s): (常用下限, 上限)
DUCT_VELOCITY_MAIN = (6.0, 8.0)
DUCT_VELOCITY_BRANCH = (4.0, 6.0)

# 标准矩形风管边长系列 (mm)，GB 50243 常用系列节选
DUCT_SIZE_SERIES = [120, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600, 2000]

# 风机压力估算
DUCT_SPECIFIC_FRICTION = 1.0   # 比摩阻 Pa/m (7 m/s 主风管典型值 0.8~1.2)
ACCESSORY_PRESSURE: dict[str, float] = {
    "none": 0.0,
    "activated_carbon": 300.0,  # 活性炭吸附箱
    "scrubber": 500.0,          # 酸雾/水洗喷淋塔
}
SUPPLY_FILTER_PRESSURE = 150.0  # 补风中效过滤段阻力 Pa
FAN_PRESSURE_MARGIN = 1.1
FAN_FLOW_MARGIN = 1.1

# ==================== 集中供气 GAS ====================

# 同时使用系数 (按用气点数量分档): [(点数上限, 系数), ...]，超出取默认
GAS_SIMULTANEITY_TIERS = [(5, 0.8), (10, 0.6)]
GAS_SIMULTANEITY_DEFAULT = 0.5

# 未提供日均流量时的经验负载率 (日均流量 ≈ 峰值 × 该系数)
GAS_AVG_LOAD_FACTOR = 0.25

# 不锈钢无缝管标准外径系列 (mm) (1/4"~1 1/2" 常用仪表管)
TUBE_OD_SERIES = [6.35, 9.52, 12.7, 19.05, 25.4, 31.8, 38.1]
TUBE_WALL_DEFAULT = 1.0        # 壁厚 mm

LINE_VELOCITY_DEFAULT = 8.0    # 气体管内流速上限 m/s (常用 5~10)
FRICTION_FACTOR = 0.025        # 不锈钢管沿程阻力系数 (湍流近似)

STANDARD_ATM_BAR = 1.013       # 标准大气压 bar
CYLINDER_WATER_VOLUME_L = 40.0   # 标准钢瓶水容积
CYLINDER_PRESSURE_BAR = 150.0    # 额定工作压力
# 单瓶可供气量 ≈ 40L × 150bar ÷ 1atm ≈ 5.9 Nm³ (理想气体估算)
CYLINDER_USABLE_NM3 = 5.9

# 供气方案判据
MANIFOLD_AUTONOMY_MIN_DAYS = 2.0   # 单瓶可用 < 2 天 → 必须汇流排
DEWAR_DAILY_THRESHOLD_NM3 = 30.0   # 日用气 > 30 Nm³ → 建议杜瓦罐/液态储供
DEWAR_VOLUME_L_DEFAULT = 175.0     # 常用杜瓦罐容积
DEWAR_UTILIZATION = 0.85           # 杜瓦有效利用系数

# 减压方案
STAGE1_OUTLET_BAR = (0.8, 1.0)       # 一级减压出口 (管线中压)
MAX_SINGLE_STAGE_DELIVERY_BAR = 1.0  # 终端压力 > 1.0 bar 时一级直供并校核管路

# ============================================================
# 给排水 (Plumbing) 查表 —— 来源：洁净EPC-AI 朋友项目合并
# ============================================================

# 流量-管径对照表（模拟数据，便于后续替换为数据库/材料库查询）
FLOW_DN_TABLE = [
    {"max_l_s": 0.5,  "dn": 32,  "label": "DN32"},
    {"max_l_s": 1.0,  "dn": 40,  "label": "DN40"},
    {"max_l_s": 2.0,  "dn": 50,  "label": "DN50"},
    {"max_l_s": 4.0,  "dn": 75,  "label": "DN75"},
    {"max_l_s": 9999, "dn": 100, "label": "DN100"},
]

# 排水类型-最小坡度表 (m/m)
#   waste    生活废水: 塑料管横支管标准坡度 0.026 (DN50 及以下),
#            DN75 及以上可取最小坡度 0.015 —— GB 50015-2019 表 4.5.5
#   acid/organic 酸性/有机废水: 统一取 0.020 防沉积 (实验室分质排水经验值，
#            参考实验室设计规范及行业惯例，不得随管径增大而减小)
TYPE_MIN_SLOPE = {
    "waste":    {"small_dn": 0.026, "large_dn": 0.015, "small_dn_max": 50, "note": "GB 50015-2019 塑料管标准坡度"},
    "acid":     {"fixed": 0.020, "note": "酸碱废水防沉积最小坡度 (实验室经验值)"},
    "organic":  {"fixed": 0.020, "note": "有机废水防沉积最小坡度 (实验室经验值)"},
}

# 排水类型-推荐管材
#   UPVC: 生活废水常规; PP/PVDF: 耐酸; SS304/PP: 耐有机溶剂
PIPE_MATERIAL_BY_TYPE = {
    "waste":   {"code": "UPVC", "name": "UPVC (硬聚氯乙烯)", "alternatives": ["PP"], "note": "生活废水，常规耐腐即可"},
    "acid":    {"code": "PP", "name": "PP (聚丙烯)", "alternatives": ["PVDF (聚偏氟乙烯)"], "note": "酸性废水，耐酸优先，强氧化性酸选 PVDF"},
    "organic": {"code": "SS304", "name": "SS304 (不锈钢)", "alternatives": ["PP"], "note": "有机废水，耐有机溶剂，含氯溶剂慎用不锈钢"},
}

# 流速校核参数
PLUMBING_FULLNESS = 0.5          # 假设充满度 h/D
PLUMBING_V_MIN = 0.6             # 自清流速下限 (m/s)
PLUMBING_V_MAX = 2.5             # 流速上限 (m/s，防噪声与冲刷)
PLUMBING_MANNING_N = 0.01        # 塑料管曼宁粗糙系数 (自清坡度反算用)

# ============================================================
# 智能化 (Intelligence) 查表 —— 来源：洁净EPC-AI 朋友项目合并
# ============================================================

# 信息点位密度 (点/间，按房间功能)
ROOM_POINT_DENSITY = {
    "lab":      {"network": 4, "phone": 1, "camera": 1, "access": 1},
    "office":   {"network": 2, "phone": 1, "camera": 0, "access": 1},
    "corridor": {"network": 0, "phone": 0, "camera": 1, "access": 0},
    "warehouse":{"network": 1, "phone": 0, "camera": 2, "access": 1},
    "meeting":  {"network": 2, "phone": 1, "camera": 0, "access": 1},
}

# 环境监控传感器布置密度 (个/m²)
ENV_SENSOR_DENSITY = {
    "chemical":  {"temp_humidity": 0.0020, "pressure_diff": 0, "voc": 0.0020},
    "biological":{"temp_humidity": 0.0030, "pressure_diff": 0, "voc": 0.0010},
    "physical":  {"temp_humidity": 0.0010, "pressure_diff": 0, "voc": 0},
}
# 压差传感器：按房间配对(洁净/负压相对邻室)每间 1 个，不计密度
PRESSURE_DIFF_PER_ROOM = {"chemical": 1, "biological": 1, "physical": 0}

# 能耗监测：按配电箱配智能电表、按进水管配水表
METER_PER_DISTRIBUTION_BOX = 1
WATER_METER_PER_INLET = 1

# ============================================================
# 风机防腐材质联动 (fan_match) —— 来源：洁净EPC-AI 朋友项目合并
# 按排风耐酸碱等级匹配风机/叶轮材质
# ============================================================
FAN_MATERIAL_BY_ACID = {
    "high":   {"material": "玻璃钢 (FRP) / PP",   "impeller": "PP / FRP",  "remark": "强腐蚀性排风"},
    "medium": {"material": "不锈钢 304 / 内涂环氧", "impeller": "304 不锈钢", "remark": "中等腐蚀性"},
    "low":    {"material": "镀锌钢板",            "impeller": "镀锌",      "remark": "一般排风"},
}
