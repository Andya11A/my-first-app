// 计算引擎模块字段配置（表单驱动）

export type FieldType = 'number' | 'text' | 'select' | 'boolean' | 'objectList' | 'dict';

export interface FieldConfig {
  key: string;           // JSON字段名
  label: string;         // 显示标签
  type: FieldType;
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;         // 单位（显示在输入框后面）
  options?: { value: string | number; label: string }[];
  description?: string;  // 字段说明
  objectFields?: FieldConfig[];  // objectList类型的子字段
}

export interface CalcModuleConfig {
  id: string;
  name: string;
  icon: string;
  endpoint: string;
  description: string;
  fields: FieldConfig[];
}

// 城市气候参数库（calc_engine/app/services/city_climate_db.py，GB 50736-2012 附录A）
export const CITY_CLIMATE_CITIES = [
  '北京', '上海', '广州', '深圳', '天津', '重庆', '南京', '杭州', '武汉', '成都',
  '西安', '郑州', '济南', '青岛', '沈阳', '大连', '哈尔滨', '长春', '石家庄', '太原',
  '合肥', '南昌', '福州', '厦门', '长沙', '南宁', '海口', '昆明', '贵阳', '拉萨',
  '兰州', '西宁', '银川', '乌鲁木齐', '呼和浩特',
];

export const CALC_MODULES: CalcModuleConfig[] = [
  {
    id: 'hvac',
    name: '暖通',
    icon: '🌬️',
    endpoint: '/api/v1/hvac/calculate',
    description: '冷热负荷/通风量/压差/选型',
    fields: [
      { key: 'lab_type', label: '实验室类型', type: 'select', default: 'chemical', options: [
        { value: 'chemical', label: '化学' }, { value: 'biological', label: '生物' },
        { value: 'physical', label: '物理' }, { value: 'cleanroom', label: '洁净室' },
      ]},
      { key: 'area', label: '面积', type: 'number', default: 100, min: 1, unit: '㎡' },
      { key: 'height', label: '层高', type: 'number', default: 3, min: 1, unit: 'm' },
      { key: 'fume_hood_count', label: '通风柜数量', type: 'number', default: 2, min: 0, unit: '台' },
    ],
  },
  {
    id: 'electrical',
    name: '电气',
    icon: '⚡',
    endpoint: '/api/v1/electrical/calculate',
    description: '负荷/电缆/断路器/短路',
    fields: [
      { key: 'equipment_power_kw', label: '设备总功率', type: 'number', default: 20, min: 1, unit: 'kW' },
      { key: 'voltage', label: '电压', type: 'select', default: 380, options: [
        { value: 380, label: '380V（三相）' }, { value: 220, label: '220V（单相）' },
      ]},
    ],
  },
  {
    id: 'psychrometrics',
    name: '焓湿计算',
    icon: '💧',
    endpoint: '/api/v1/psychrometrics/state',
    description: '空气状态点/焓值/露点',
    fields: [
      { key: 'mode', label: '计算模式', type: 'select', default: 'db_rh', options: [
        { value: 'db_rh', label: '干球+相对湿度' }, { value: 'db_wb', label: '干球+湿球' },
      ]},
      { key: 'city', label: '城市', type: 'select', default: '广州', description: '大气压按城市+季节自动取',
        options: CITY_CLIMATE_CITIES.map((c) => ({ value: c, label: c })) },
      { key: 'season', label: '季节', type: 'select', default: 'summer', options: [
        { value: 'summer', label: '夏季' }, { value: 'winter', label: '冬季' },
      ]},
      { key: 'dry_bulb', label: '干球温度', type: 'number', default: 26, min: -50, max: 100, unit: '℃' },
      { key: 'relative_humidity', label: '相对湿度', type: 'number', default: 60, min: 0, max: 100, unit: '%' },
      { key: 'pressure', label: '大气压', type: 'number', default: '', min: 50, max: 120, step: 0.01, unit: 'kPa',
        description: '自动（按城市季节），可手动覆盖' },
    ],
  },
  {
    id: 'lighting',
    name: '照度',
    icon: '💡',
    endpoint: '/api/v1/lighting/calculate',
    description: '利用系数法灯具数量',
    fields: [
      { key: 'room_length', label: '房间长度', type: 'number', default: 10, min: 1, unit: 'm' },
      { key: 'room_width', label: '房间宽度', type: 'number', default: 6, min: 1, unit: 'm' },
      { key: 'target_illuminance', label: '目标照度', type: 'number', default: 500, min: 50, unit: 'lx' },
      { key: 'lamp_luminous_flux', label: '单灯光通量', type: 'number', default: 3200, min: 100, unit: 'lm' },
    ],
  },
  {
    id: 'ups',
    name: 'UPS',
    icon: '🔋',
    endpoint: '/api/v1/ups/calculate',
    description: 'UPS容量+电池配置',
    fields: [
      { key: 'total_load_kw', label: '总负载', type: 'number', default: 20, min: 1, unit: 'kW' },
      { key: 'backup_time_min', label: '备电时间', type: 'number', default: 30, min: 5, unit: '分钟' },
      { key: 'battery_voltage', label: '电池组电压', type: 'select', default: 384, options: [
        { value: 192, label: '192V' }, { value: 384, label: '384V' }, { value: 480, label: '480V' },
      ]},
    ],
  },
  {
    id: 'fire-extinguisher',
    name: '灭火器',
    icon: '🧯',
    endpoint: '/api/v1/fire-extinguisher/calculate',
    description: '灭火器配置数量',
    fields: [
      { key: 'room_area', label: '房间面积', type: 'number', default: 150, min: 1, unit: '㎡' },
      { key: 'fire_risk_level', label: '危险等级', type: 'select', default: 'medium', options: [
        { value: 'low', label: '轻危险级' }, { value: 'medium', label: '中危险级' }, { value: 'high', label: '严重危险级' },
      ]},
    ],
  },
  {
    id: 'pure-water',
    name: '纯水',
    icon: '💧',
    endpoint: '/api/v1/pure-water/calculate',
    description: '纯水系统+储罐选型',
    fields: [
      { key: 'daily_usage_l', label: '日用水量', type: 'number', default: 500, min: 10, unit: 'L' },
      { key: 'water_quality', label: '水质', type: 'select', default: 'ultrapure', options: [
        { value: 'ultrapure', label: '超纯水' }, { value: 'pure', label: '纯水' },
      ]},
    ],
  },
  {
    id: 'cooling-water',
    name: '冷却水',
    icon: '❄️',
    endpoint: '/api/v1/cooling-water/calculate',
    description: '冷却塔选型+补水',
    fields: [
      { key: 'cooling_load_kw', label: '冷却负荷', type: 'number', default: 100, min: 1, unit: 'kW' },
      { key: 'inlet_temp_c', label: '进水温度', type: 'number', default: 37, min: 0, unit: '℃' },
      { key: 'outlet_temp_c', label: '出水温度', type: 'number', default: 32, min: 0, unit: '℃' },
    ],
  },
  {
    id: 'duct',
    name: '风管',
    icon: '📐',
    endpoint: '/api/v1/duct/calculate',
    description: '风管尺寸+风速校核',
    fields: [
      { key: 'airflow_m3_h', label: '风量', type: 'number', default: 4500, min: 100, unit: 'm³/h' },
      { key: 'max_velocity_m_s', label: '最大风速', type: 'number', default: 8, min: 1, unit: 'm/s' },
    ],
  },
  {
    id: 'energy',
    name: '能耗',
    icon: '💰',
    endpoint: '/api/v1/energy/calculate',
    description: '年运行能耗+电费',
    fields: [
      { key: 'cooling_load_kw', label: '冷负荷', type: 'number', default: 150, min: 0, unit: 'kW' },
      { key: 'heating_load_kw', label: '热负荷', type: 'number', default: 50, min: 0, unit: 'kW' },
      { key: 'lighting_power_kw', label: '照明功率', type: 'number', default: 8, min: 0, unit: 'kW' },
      { key: 'equipment_power_kw', label: '设备功率', type: 'number', default: 30, min: 0, unit: 'kW' },
      { key: 'electricity_price', label: '电价', type: 'number', default: 0.8, min: 0.1, step: 0.1, unit: '元/kWh' },
    ],
  },
  {
    id: 'quote',
    name: '一键报价',
    icon: '💰',
    endpoint: '/api/v1/quote/integrated',
    description: '设备+施工+暖通+管理费+利润',
    fields: [
      { key: 'lab_type', label: '实验室类型', type: 'select', default: 'PCR实验室', options: [
        { value: 'PCR实验室', label: 'PCR实验室' }, { value: '理化实验室', label: '理化实验室' },
        { value: '微生物实验室', label: '微生物实验室' }, { value: '通用实验室', label: '通用实验室' },
        { value: '生物安全P2实验室', label: 'P2实验室' },
      ]},
      { key: 'area', label: '面积', type: 'number', default: 100, min: 1, unit: '㎡' },
      { key: 'clean_level', label: '洁净等级', type: 'select', default: '十万级', options: [
        { value: '普通', label: '普通' }, { value: '十万级', label: '十万级' },
        { value: '万级', label: '万级' }, { value: '千级', label: '千级' },
      ]},
    ],
  },
  {
    id: 'exhaust-system',
    name: '废气系统',
    icon: '♻️',
    endpoint: '/api/v1/exhaust-system/calculate',
    description: '完整废气系统（收集→风机→处理→排放）',
    fields: [
      { key: 'hood_count', label: '通风柜数量', type: 'number', default: 2, min: 1, unit: '台' },
      { key: 'pollutant_type', label: '污染物', type: 'select', default: 'VOCs', options: [
        { value: 'VOCs', label: 'VOCs' }, { value: 'HCl', label: '氯化氢' },
        { value: 'NH3', label: '氨' }, { value: 'H2S', label: '硫化氢' },
      ]},
      { key: 'inlet_concentration_mg_m3', label: '进口浓度', type: 'number', default: 200, min: 1, unit: 'mg/m³' },
      { key: 'treatment_technology', label: '处理技术', type: 'select', default: 'activated_carbon', options: [
        { value: 'activated_carbon', label: '活性炭' }, { value: 'wet_scrubber', label: '喷淋塔' },
        { value: 'uv_photolysis', label: 'UV光解' }, { value: 'plasma', label: '等离子' },
        { value: 'combined', label: '组合工艺' },
      ]},
    ],
  },
  {
    id: 'ffu',
    name: 'FFU计算',
    icon: '🌀',
    endpoint: '/api/v1/ffu/calculate',
    description: 'FFU循环风系统（工程级）',
    fields: [
      { key: 'room_length_m', label: '房间长度', type: 'number', default: 10, min: 1, unit: 'm' },
      { key: 'room_width_m', label: '房间宽度', type: 'number', default: 5, min: 1, unit: 'm' },
      { key: 'room_height_m', label: '层高', type: 'number', default: 2.8, min: 1, unit: 'm' },
      { key: 'clean_class', label: '洁净等级', type: 'select', default: 'ISO5', options: [
        { value: 'ISO5', label: 'ISO 5（百级）' },
        { value: 'ISO6', label: 'ISO 6（千级）' },
        { value: 'ISO7', label: 'ISO 7（万级）' },
        { value: 'ISO8', label: 'ISO 8（十万级）' },
      ]},
      { key: 'ffu_spec', label: 'FFU规格', type: 'select', default: '1175x575', options: [
        { value: '575x575', label: '575×575' },
        { value: '1175x575', label: '1175×575' },
        { value: '1175x1175', label: '1175×1175' },
      ]},
      { key: 'hepa_grade', label: '高效过滤器', type: 'select', default: 'H14', options: [
        { value: 'H13', label: 'H13（99.99%）' },
        { value: 'H14', label: 'H14（99.995%）' },
      ]},
      { key: 'filter_condition', label: '过滤器状态', type: 'select', default: 'design', options: [
        { value: 'initial', label: '初阻力' },
        { value: 'design', label: '设计阻力' },
        { value: 'final', label: '终阻力' },
      ]},
      { key: 'single_ffu_airflow_m3_h', label: '单台风量(可选)', type: 'number', default: 900, min: 100, unit: 'm³/h' },
    ],
  },
];

// 其他模块（暂未表单化，保留JSON输入）
export const ADVANCED_MODULES = [
  { id: 'gas', name: '供气', icon: '🧪', endpoint: '/api/v1/calc/gas-supply' },
  { id: 'decoration', name: '装修', icon: '🏗️', endpoint: '/api/v1/decoration/calculate' },
  { id: 'plumbing', name: '给排水', icon: '🚰', endpoint: '/api/v1/plumbing/calculate' },
  { id: 'weak-current', name: '弱电', icon: '📡', endpoint: '/api/v1/weak-current/calculate' },
  { id: 'intelligence', name: '智能化', icon: '🧠', endpoint: '/api/v1/intelligence/calculate' },
  { id: 'workflow', name: '图纸联动', icon: '🔗', endpoint: '/api/v1/workflow/calculate-hvac' },
  { id: 'chiller', name: '冷热源', icon: '❄️', endpoint: '/api/v1/chiller/calculate' },
  { id: 'cable-tray', name: '桥架', icon: '🔌', endpoint: '/api/v1/cable-tray/calculate' },
  { id: 'smoke-exhaust', name: '排烟', icon: '💨', endpoint: '/api/v1/smoke-exhaust/calculate' },
  { id: 'lightning', name: '防雷', icon: '⚡', endpoint: '/api/v1/lightning/calculate' },
  { id: 'fire-hydrant', name: '消火栓', icon: '🚒', endpoint: '/api/v1/fire-hydrant/calculate' },
  { id: 'control-points', name: '自控', icon: '🎛️', endpoint: '/api/v1/control-points/calculate' },
  { id: 'noise', name: '噪声', icon: '🔊', endpoint: '/api/v1/noise/calculate' },
  { id: 'wastewater', name: '废水', icon: '💧', endpoint: '/api/v1/wastewater/calculate' },
  { id: 'exhaust-gas', name: '废气(简)', icon: '♻️', endpoint: '/api/v1/exhaust-gas/treatment' },
  { id: 'carbon-lifetime', name: '活性炭', icon: '⏱️', endpoint: '/api/v1/exhaust-gas/carbon-lifetime' },
];
