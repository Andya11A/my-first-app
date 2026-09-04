import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// Prisma 7 需要 driver adapter 连接 SQLite（dev.db 位于项目根目录）
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

type EqTuple = [string, string, string, number, number, boolean]; // 名称, 规格, 单位, 每100㎡数量, 基准单价, 必配
type CfTuple = [string, string, number, number, string]; // 工程项, 单位, 每㎡系数, 基准单价, 类别

// ============ 设备池 ============
const equipmentPools: Record<string, EqTuple[]> = {
  base: [
    ['实验台', '全钢 3600×750×850mm', '台', 2.0, 8500, true],
    ['试剂柜', '900×450×1800mm', '台', 1.0, 4500, true],
    ['器皿柜', '900×450×1800mm', '台', 0.8, 3800, false],
    ['通风柜', '1500×750×2350mm', '台', 1.2, 18000, true],
    ['电子天平', '0.01g/220g', '台', 0.6, 6500, true],
    ['台式pH计', '0.01精度', '台', 0.4, 2800, false],
    ['纯水机', '10L/h', '台', 0.5, 12000, true],
    ['磁力搅拌器', '标准型', '台', 0.8, 1500, false],
    ['电热鼓风干燥箱', '300℃', '台', 0.5, 6800, false],
    ['洗眼器', '壁挂式', '个', 0.3, 1600, true],
  ],
  cleanEquip: [
    ['风淋室', '单人双吹', '台', 0.15, 28000, true],
    ['传递窗', '标准型', '台', 0.4, 4500, true],
    ['净化空调机组', '5000m³/h', '套', 0.8, 180000, true],
    ['洁净灯具', '1200×600 嵌入式', '个', 15, 380, true],
    ['初效过滤器', 'G4', '个', 2, 260, true],
    ['高效过滤器', 'H13', '个', 2, 1500, true],
  ],
  bioSafety: [
    ['生物安全柜', 'A2 1120mm', '台', 0.9, 45000, true],
    ['高压灭菌器', '75L 立式', '台', 0.4, 32000, true],
    ['超低温冰箱', '-86℃ 500L', '台', 0.5, 65000, true],
    ['医用冷藏冰箱', '2-8℃ 310L', '台', 0.6, 8500, true],
    ['蒸馏水器', '5L/h', '台', 0.3, 3200, false],
    ['紫外线消毒车', '移动式', '台', 0.4, 2600, false],
  ],
  pcrMolecular: [
    ['PCR仪', '96孔', '台', 0.5, 85000, true],
    ['实时荧光定量PCR仪', '96孔', '台', 0.4, 260000, true],
    ['核酸提取仪', '96通道', '台', 0.3, 180000, true],
    ['超净工作台', '双人单面', '台', 0.8, 8500, true],
    ['涡旋振荡器', '标准型', '台', 0.5, 1800, false],
    ['微量分光光度计', 'NanoDrop型', '台', 0.3, 65000, false],
  ],
  microbio: [
    ['恒温培养箱', '150L', '台', 0.7, 9800, true],
    ['生化培养箱', '250L 4-60℃', '台', 0.5, 15000, true],
    ['生物显微镜', '双目 1000X', '台', 0.6, 8800, true],
    ['菌落计数器', '标准型', '台', 0.3, 4200, false],
    ['恒温摇床', '250L', '台', 0.4, 12000, false],
    ['均质器', '拍击式', '台', 0.3, 9800, false],
  ],
  cellCulture: [
    ['CO2培养箱', '190L', '台', 0.5, 58000, true],
    ['台式离心机', '4000rpm', '台', 0.6, 8800, true],
    ['高速冷冻离心机', '20000rpm', '台', 0.4, 68000, false],
    ['液氮罐', '30L', '个', 0.5, 9800, true],
    ['倒置显微镜', '标准型', '台', 0.4, 45000, false],
    ['移液器套装', '单道+8道', '组', 0.8, 6800, true],
  ],
  instrument: [
    ['气相色谱仪', 'GC 标准配置', '台', 0.35, 180000, true],
    ['液相色谱仪', 'HPLC 标准配置', '台', 0.35, 220000, true],
    ['紫外可见分光光度计', '双光束', '台', 0.5, 28000, true],
    ['原子吸收光谱仪', '火焰+石墨炉', '台', 0.2, 280000, false],
    ['气质联用仪', 'GC-MS', '台', 0.15, 450000, false],
    ['马弗炉', '1200℃', '台', 0.4, 8500, false],
  ],
  environment: [
    ['大气综合采样器', '标准型', '台', 0.8, 18000, true],
    ['声级计', '1级', '台', 0.4, 9800, true],
    ['烟尘烟气测试仪', '自动型', '台', 0.4, 35000, false],
    ['红外测油仪', '标准型', '台', 0.3, 58000, false],
    ['便携式水质多参数仪', '五参数', '台', 0.5, 15000, true],
    ['离子色谱仪', '标准配置', '台', 0.2, 280000, false],
  ],
  foodAgri: [
    ['凯氏定氮仪', '标准型', '台', 0.35, 68000, true],
    ['水分测定仪', '卤素加热', '台', 0.5, 8500, true],
    ['粗脂肪测定仪', '索氏提取', '台', 0.3, 12000, false],
    ['酶标仪', '96孔', '台', 0.4, 68000, false],
    ['食品安全快速检测仪', '多通道', '台', 0.5, 28000, true],
    ['灰分测定仪', '标准型', '台', 0.3, 6800, false],
  ],
  electron: [
    ['防静电工作台', '1.5m', '台', 2.0, 4500, true],
    ['数字示波器', '100MHz', '台', 0.6, 15000, true],
    ['直流稳压电源', '30V/5A', '台', 0.8, 3200, true],
    ['离子风机', '单头', '台', 0.5, 4800, false],
    ['表面电阻测试仪', '标准型', '台', 0.3, 5800, false],
    ['恒温烙铁焊接台', '60W', '台', 1.0, 1200, false],
  ],
  teach: [
    ['学生实验桌', '4人位', '组', 6.0, 3800, true],
    ['教师演示台', '3m', '张', 0.5, 9800, true],
    ['学生凳', '升降式', '个', 24, 180, true],
    ['教学通风柜', '1200mm', '台', 0.8, 12000, false],
    ['学生显微镜', '单目 640X', '台', 8, 1800, false],
    ['电源控制箱', '嵌入式', '个', 2, 2600, true],
  ],
  animal: [
    ['独立通风笼具IVC', '40笼位', '套', 0.3, 180000, true],
    ['动物隔离器', '软包式', '套', 0.15, 120000, false],
    ['笼位清洗机', '隧道式', '台', 0.1, 85000, false],
    ['超净工作台', '动物用', '台', 0.4, 12000, true],
    ['灭菌器', '动物房专用', '台', 0.3, 45000, true],
    ['电子秤', '动物称重 15kg', '台', 0.3, 2600, false],
  ],
  foren: [
    ['比对显微镜', '双目比对', '台', 0.25, 150000, true],
    ['生物安全柜', 'B2 1120mm', '台', 0.6, 68000, true],
    ['DNA提取工作站', '自动化', '台', 0.2, 260000, false],
    ['超低温冰箱', '-86℃ 500L', '台', 0.5, 65000, true],
    ['多波段光源', '便携式', '台', 0.4, 45000, false],
    ['高压灭菌器', '50L 立式', '台', 0.3, 32000, true],
  ],
  cosmetic: [
    ['乳化机', '实验型', '台', 0.3, 18000, true],
    ['粘度计', '旋转式', '台', 0.4, 12000, true],
    ['恒温恒湿箱', '225L', '台', 0.3, 38000, true],
    ['pH计', '台式 0.01精度', '台', 0.5, 2800, true],
    ['紫外分光光度计', 'UV-1800', '台', 0.4, 22000, false],
  ],
  medicalDevice: [
    ['恒温恒湿试验箱', '408L', '台', 0.3, 68000, true],
    ['万能材料试验机', '50kN', '台', 0.2, 120000, true],
    ['生物安全柜', 'B2 1500mm', '台', 0.5, 68000, true],
    ['高压蒸汽灭菌器', '100L', '台', 0.4, 42000, true],
    ['尘埃粒子计数器', '28.3L/min', '台', 0.3, 45000, false],
  ],
  material: [
    ['万能试验机', '100kN', '台', 0.2, 150000, true],
    ['硬度计', '多用途', '台', 0.35, 18000, true],
    ['马弗炉', '1200℃ 程控', '台', 0.4, 8500, true],
    ['热分析仪', 'DSC', '台', 0.15, 260000, false],
    ['激光粒度仪', '0.01-3000μm', '台', 0.15, 180000, false],
  ],
  radNuclear: [
    ['辐射剂量仪', '便携式', '台', 0.4, 35000, true],
    ['表面污染仪', 'α/β', '台', 0.3, 45000, true],
    ['铅屏风', '2mmPb', '个', 0.5, 12000, true],
    ['放射性活度计', '标准型', '台', 0.2, 85000, false],
  ],
  specialMisc: [
    ['精密空调机组', '恒温恒湿 15kW', '套', 0.8, 120000, true],
    ['除湿机', '90L/d', '台', 0.5, 8800, true],
    ['工业级3D打印机', '500×500×500mm', '台', 0.2, 180000, false],
    ['光学平台', '1500×900mm 气浮', '台', 0.3, 45000, false],
    ['温湿度巡检仪', '多通道记录', '台', 0.4, 6500, true],
  ],
};

// ============ 工程量系数集 ============
const constructionSets: Record<string, CfTuple[]> = {
  setBasic: [
    ['轻钢龙骨石膏板隔断', '㎡', 1.2, 180, '装修'],
    ['矿棉板吊顶', '㎡', 1.0, 90, '装修'],
    ['PVC地板', '㎡', 1.0, 120, '装修'],
    ['乳胶漆墙面', '㎡', 1.6, 45, '装修'],
    ['普通空调系统', '㎡', 1.0, 180, '暖通'],
    ['配电系统', '㎡', 1.0, 120, '电气'],
    ['照明系统', '㎡', 1.0, 65, '电气'],
    ['给排水点位', '点', 0.05, 2500, '给排水'],
  ],
  setClean: [
    ['彩钢板隔断', '㎡', 1.5, 260, '装修'],
    ['洁净吊顶', '㎡', 1.0, 220, '装修'],
    ['环氧自流平地面', '㎡', 1.0, 180, '装修'],
    ['气密门', '㎡', 0.06, 1500, '装修'],
    ['净化空调机组', '套', 0.01, 220000, '暖通'],
    ['排风系统', '套', 0.012, 60000, '暖通'],
    ['风管保温', '㎡', 0.8, 60, '暖通'],
    ['配电系统', '㎡', 1.0, 160, '电气'],
    ['洁净照明系统', '㎡', 1.0, 85, '电气'],
    ['给排水点位', '点', 0.05, 2800, '给排水'],
  ],
  setBioSafety: [
    ['彩钢板隔断 密封型', '㎡', 1.8, 300, '装修'],
    ['洁净吊顶 密封', '㎡', 1.0, 240, '装修'],
    ['环氧自流平地面 卷边', '㎡', 1.0, 220, '装修'],
    ['气密门', '㎡', 0.08, 1800, '装修'],
    ['净化空调机组 全新风', '套', 0.015, 250000, '暖通'],
    ['高效过滤排风系统', '套', 0.015, 80000, '暖通'],
    ['配电系统 双回路', '㎡', 1.0, 200, '电气'],
    ['洁净照明系统', '㎡', 1.0, 90, '电气'],
    ['给排水点位 含消毒', '点', 0.06, 3500, '给排水'],
  ],
  setElec: [
    ['彩钢板隔断', '㎡', 1.5, 260, '装修'],
    ['洁净吊顶 FFU配套', '㎡', 1.0, 240, '装修'],
    ['防静电架空地板', '㎡', 1.0, 320, '装修'],
    ['净化空调机组+FFU', '套', 0.018, 240000, '暖通'],
    ['排风系统', '套', 0.01, 70000, '暖通'],
    ['防静电接地系统', '㎡', 1.0, 60, '电气'],
    ['配电系统', '㎡', 1.0, 180, '电气'],
    ['洁净照明', '㎡', 1.0, 85, '电气'],
    ['纯水/特气管道', 'm', 0.6, 480, '给排水'],
  ],
  setAnimal: [
    ['彩钢板隔断 圆弧处理', '㎡', 1.6, 280, '装修'],
    ['洁净吊顶', '㎡', 1.0, 230, '装修'],
    ['环氧地面 防滑', '㎡', 1.0, 200, '装修'],
    ['净化空调机组', '套', 0.015, 230000, '暖通'],
    ['排风除臭系统', '套', 0.015, 75000, '暖通'],
    ['配电系统', '㎡', 1.0, 170, '电气'],
    ['防腐照明', '㎡', 1.0, 80, '电气'],
    ['给排水点位 自动饮水', '点', 0.06, 3200, '给排水'],
  ],
  setChem: [
    ['防爆隔断 防腐墙面', '㎡', 1.4, 260, '装修'],
    ['防腐吊顶', '㎡', 1.0, 150, '装修'],
    ['环氧防腐地坪', '㎡', 1.0, 260, '装修'],
    ['通风柜排风系统 防腐', '套', 0.015, 78000, '暖通'],
    ['全室通风换气系统', '㎡', 1.0, 120, '暖通'],
    ['防爆配电系统', '㎡', 1.0, 220, '电气'],
    ['防爆照明系统', '㎡', 1.0, 110, '电气'],
    ['紧急冲淋洗眼给排水', '点', 0.04, 3500, '给排水'],
  ],
  setRad: [
    ['铅防护隔断 2mmPb', '㎡', 1.2, 480, '装修'],
    ['吊顶 防护涂层', '㎡', 1.0, 130, '装修'],
    ['防护地面', '㎡', 1.0, 160, '装修'],
    ['排风系统', '套', 0.01, 65000, '暖通'],
    ['空调系统', '㎡', 1.0, 200, '暖通'],
    ['配电系统', '㎡', 1.0, 160, '电气'],
    ['照明系统', '㎡', 1.0, 70, '电气'],
    ['给排水点位', '点', 0.04, 3000, '给排水'],
  ],
  setTeach: [
    ['轻质隔断', '㎡', 1.0, 150, '装修'],
    ['吊顶', '㎡', 1.0, 80, '装修'],
    ['地砖地面', '㎡', 1.0, 110, '装修'],
    ['普通空调', '㎡', 1.0, 160, '暖通'],
    ['通风柜排风', '套', 0.008, 45000, '暖通'],
    ['配电+照明', '㎡', 1.0, 140, '电气'],
    ['给排水点位', '点', 0.08, 2200, '给排水'],
  ],
};

// ============ 117 种实验室类型 ============
interface LabTypeDef {
  typeName: string;
  cleanLevelDefault: string;
  pressureRequirement: string;
  tempHumidity: string;
  airChangesPerHour: number;
  illuminationLux: number;
  notes: string;
  pools: string[];
  set: string;
}

const labTypes: LabTypeDef[] = [
  // ===== 医疗临床类 =====
  { typeName: 'PCR实验室', cleanLevelDefault: '十万级', pressureRequirement: '核心区对邻室-10Pa~-15Pa，缓冲区梯度递减', tempHumidity: '20~24℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 300, notes: '严格分区：试剂制备区、标本制备区、扩增区、产物分析区，气流单向不回流。三区两缓冲，人流物流分开，双走廊设计避免交叉污染。', pools: ['bioSafety', 'pcrMolecular'], set: 'setClean' },
  { typeName: '医院检验科', cleanLevelDefault: '十万级', pressureRequirement: '临检区微正压，微生物室负压-5Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 18, illuminationLux: 350, notes: '按临检、生化、免疫、微生物分区布置，洁污分流。采血窗口与候检区相邻，污物通道独立设置。', pools: ['bioSafety', 'microbio'], set: 'setClean' },
  { typeName: '病理实验室', cleanLevelDefault: '万级', pressureRequirement: '取材室负压-10Pa，其他区域微正压', tempHumidity: '18~24℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 400, notes: '取材、脱水、包埋、切片、染色流程化布局，标本处理区独立排风。含甲醛固定间的废气需经活性炭处理后排放。', pools: ['bioSafety', 'microbio'], set: 'setClean' },
  { typeName: '分子诊断实验室', cleanLevelDefault: '万级', pressureRequirement: '扩增区负压-10Pa梯度压差', tempHumidity: '20~24℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 350, notes: '四区严格物理隔断，各区间设置传递窗和缓冲间。试剂与标本流向单向，防止扩增产物污染。', pools: ['pcrMolecular', 'bioSafety'], set: 'setClean' },
  { typeName: '生殖中心实验室', cleanLevelDefault: '百级', pressureRequirement: '核心培养室正压+10Pa', tempHumidity: '22~24℃ / 40%~50%', airChangesPerHour: 25, illuminationLux: 400, notes: '胚胎培养室需千级背景百级局部层流，VOC浓度严控。配受精、培养、冷冻各功能间，恒温恒湿高可靠性。', pools: ['cellCulture', 'bioSafety'], set: 'setClean' },
  { typeName: '干细胞实验室', cleanLevelDefault: '百级', pressureRequirement: '核心区正压+10Pa以上', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 25, illuminationLux: 400, notes: 'GMP级细胞制备环境，洁净梯度由低到高单向布局。人与物分设缓冲，全程无菌可追溯。', pools: ['cellCulture', 'bioSafety'], set: 'setClean' },
  { typeName: '基因检测实验室', cleanLevelDefault: '万级', pressureRequirement: '测序区负压-5Pa，样本区负压-10Pa', tempHumidity: '20~24℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 350, notes: '样本制备、文库构建、上机测序、数据分析分区。高通量测序仪散热负荷大，空调需独立核算。', pools: ['pcrMolecular', 'cellCulture'], set: 'setClean' },
  { typeName: '产前诊断实验室', cleanLevelDefault: '万级', pressureRequirement: '培养区正压，PCR区负压', tempHumidity: '21~25℃ / 45%~60%', airChangesPerHour: 20, illuminationLux: 350, notes: '细胞遗传学与分子遗传学两平台分设。羊水培养室需稳定CO2环境，建筑防震动设计。', pools: ['cellCulture', 'pcrMolecular'], set: 'setClean' },
  { typeName: '肿瘤精准医疗实验室', cleanLevelDefault: '万级', pressureRequirement: '扩增区负压-10Pa，测序区微负压', tempHumidity: '20~24℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 350, notes: 'NGS检测流程分区管理，防气溶胶污染。大功率测序设备需独立电路与散热设计。', pools: ['pcrMolecular', 'cellCulture'], set: 'setClean' },
  { typeName: '临床免疫实验室', cleanLevelDefault: '十万级', pressureRequirement: '微负压-5Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 18, illuminationLux: 350, notes: '酶免疫、化学发光平台分设，标本前处理区独立。洗板机废液需收集中和处理。', pools: ['bioSafety', 'microbio'], set: 'setClean' },
  { typeName: '临床微生物实验室', cleanLevelDefault: '十万级', pressureRequirement: '无菌室正压，鉴定区负压-5Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 18, illuminationLux: 350, notes: '接种、培养、鉴定、药敏流程布局，无菌室配百级层流台。结核等特殊标本需独立负压处理间。', pools: ['microbio', 'bioSafety'], set: 'setClean' },
  { typeName: '输血科实验室', cleanLevelDefault: '十万级', pressureRequirement: '微负压-5Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: '血型鉴定、交叉配血、传染病筛查分区。血液储存区恒温可靠，双路供电保障冷链。', pools: ['bioSafety', 'microbio'], set: 'setClean' },
  { typeName: '核医学实验室', cleanLevelDefault: '特殊', pressureRequirement: '负压-10Pa，放射性区域独立排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 300, notes: '分装、显像、放免分析分区，墙体含铅防护。放射源库与衰变池按规范专设，人流物流单向。', pools: ['radNuclear', 'bioSafety'], set: 'setRad' },
  { typeName: '放疗物理实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，机房独立通风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 8, illuminationLux: 400, notes: '加速器机房混凝土屏蔽加铅防护，迷路设计减少辐射泄漏。剂量刻度室恒温恒湿要求高。', pools: ['radNuclear', 'base'], set: 'setRad' },
  { typeName: '康复医学实验室', cleanLevelDefault: '普通', pressureRequirement: '常压', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 8, illuminationLux: 300, notes: '功能评定与康复训练大开间布局，地面防滑。预留康复设备用电容量与辅助扶手。', pools: ['base', 'bioSafety'], set: 'setBasic' },

  // ===== 制药生物类 =====
  { typeName: '药企QC实验室', cleanLevelDefault: '十万级', pressureRequirement: '检验区微正压，样品间独立', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 400, notes: '理化分析、仪器分析、微生物检验三区分设。仪器室防震防磁，标准溶液间恒温。', pools: ['base', 'instrument'], set: 'setClean' },
  { typeName: '生物制药实验室', cleanLevelDefault: '万级', pressureRequirement: '核心区正压+10Pa，梯度递减', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 25, illuminationLux: 400, notes: '按GMP级别设计，细胞培养、纯化、灌装分区。人净物净分开，全程环境监测记录。', pools: ['cellCulture', 'bioSafety'], set: 'setClean' },
  { typeName: '疫苗生产实验室', cleanLevelDefault: '百级', pressureRequirement: '核心灌装区正压+15Pa', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 28, illuminationLux: 450, notes: '生物安全与GMP双重要求，毒种区负压、灌装区正压。分设病毒培养、灭活、配伍、灌装工序。', pools: ['bioSafety', 'cellCulture'], set: 'setBioSafety' },
  { typeName: '抗体药物实验室', cleanLevelDefault: '万级', pressureRequirement: '培养区正压+10Pa', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 25, illuminationLux: 400, notes: '细胞株构建、表达、纯化、分析模块化布局。生物反应器区层流保护，防止交叉污染。', pools: ['cellCulture', 'pcrMolecular'], set: 'setClean' },
  { typeName: '细胞治疗实验室', cleanLevelDefault: '百级', pressureRequirement: '核心区正压+10Pa以上', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 25, illuminationLux: 400, notes: 'GMP级CAR-T等细胞制备，单独分设质粒、病毒、细胞工序区。全程冷链与身份追溯。', pools: ['cellCulture', 'bioSafety'], set: 'setClean' },
  { typeName: '基因治疗实验室', cleanLevelDefault: '百级', pressureRequirement: '病毒载体区负压-10Pa，制剂区正压', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 26, illuminationLux: 400, notes: '病毒载体生产区生物安全与洁净并重，独立物流通路。质粒生产、包装、纯化严格分区。', pools: ['pcrMolecular', 'cellCulture'], set: 'setClean' },
  { typeName: '血液制品实验室', cleanLevelDefault: '万级', pressureRequirement: '血浆处理区负压-5Pa', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 22, illuminationLux: 400, notes: '血浆分离、病毒灭活、除菌过滤工序隔离。低温操作间15℃左右独立控温，冷链全程监控。', pools: ['bioSafety', 'cellCulture'], set: 'setBioSafety' },
  { typeName: '原料药研发实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，合成间独立排风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 300, notes: '化学合成与结晶工艺开发，通风柜密集布置。反应釜区防静电防爆，废气回收处理合规。', pools: ['base', 'instrument'], set: 'setClean' },
  { typeName: '制剂研发实验室', cleanLevelDefault: '十万级', pressureRequirement: '制剂区微正压', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 18, illuminationLux: 350, notes: '片剂、胶囊、液体制剂小试中试线分设。压片间粉尘控制，留样观察室恒温恒湿。', pools: ['base', 'cosmetic'], set: 'setClean' },
  { typeName: '药理毒理实验室', cleanLevelDefault: '十万级', pressureRequirement: '动物实验区负压-10Pa', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 18, illuminationLux: 350, notes: '给药、解剖、病理检查区单向布局。含笼具清洗与尸体暂存间，废液废气处理合规。', pools: ['bioSafety', 'base'], set: 'setClean' },
  { typeName: '药代动力学实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，仪器室恒温', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 10, illuminationLux: 350, notes: 'LC-MS/MS为核心的分析平台，独立仪器室防震。生物样本-80℃冷库储存分区管理。', pools: ['instrument', 'base'], set: 'setClean' },
  { typeName: '中药研发实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，提取间独立排风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 300, notes: '提取浓缩、分离纯化、制剂成型工段布置。挥发性药材独立排风防串味，防潮储存。', pools: ['base', 'foodAgri'], set: 'setClean' },
  { typeName: '生物制品检定实验室', cleanLevelDefault: '万级', pressureRequirement: '检定区负压-5Pa', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 20, illuminationLux: 400, notes: '效价、安全性、稳定性检定分区。动物检定与细胞检定分开，参照GLP规范管理。', pools: ['bioSafety', 'microbio'], set: 'setBioSafety' },
  { typeName: '无菌检查实验室', cleanLevelDefault: '百级', pressureRequirement: '无菌室正压+10Pa，阳性对照负压-10Pa', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 25, illuminationLux: 450, notes: '无菌检查与阳性对照必须物理隔离，B级背景A级操作。培养基制备间独立设置。', pools: ['bioSafety', 'microbio'], set: 'setBioSafety' },
  { typeName: '微生物限度实验室', cleanLevelDefault: '万级', pressureRequirement: '检验室正压，菌种室负压', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 20, illuminationLux: 400, notes: '供试液制备、薄膜过滤、培养计数分区。阳性菌操作间独立负压排风。', pools: ['microbio', 'bioSafety'], set: 'setBioSafety' },

  // ===== 疾控公共卫生类 =====
  { typeName: '疾控中心实验室', cleanLevelDefault: '十万级', pressureRequirement: '理化区微正压，微生物区负压-5Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 18, illuminationLux: 350, notes: '理化、微生物、病毒、毒理多中心布局，区域独立。应急检测区专用，便于突发公共卫生事件快速响应。', pools: ['bioSafety', 'microbio'], set: 'setClean' },
  { typeName: '生物安全P2实验室', cleanLevelDefault: '十万级', pressureRequirement: '负压-5Pa~-10Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 20, illuminationLux: 350, notes: 'BSL-2标准，配II级生物安全柜与高压灭菌。洗手装置非手触式，污物高压灭菌后出室。', pools: ['bioSafety', 'microbio'], set: 'setBioSafety' },
  { typeName: '生物安全P3实验室', cleanLevelDefault: '万级', pressureRequirement: '核心区负压-20Pa~-30Pa梯度', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 25, illuminationLux: 400, notes: 'BSL-3全新风直流系统，排风两级高效过滤。气密门连锁，双路供电，独立污水处理。', pools: ['bioSafety', 'microbio', 'pcrMolecular'], set: 'setBioSafety' },
  { typeName: '生物安全P4实验室', cleanLevelDefault: '百级', pressureRequirement: '核心区负压-30Pa~-40Pa', tempHumidity: '20~24℃ / 45%~60%', airChangesPerHour: 28, illuminationLux: 450, notes: 'BSL-4最高防护级别，正压防护服型或隔离器型。多层气密围护，独立生命支持系统，废液全部高温消毒。', pools: ['bioSafety', 'microbio', 'pcrMolecular'], set: 'setBioSafety' },
  { typeName: '传染病监测实验室', cleanLevelDefault: '万级', pressureRequirement: '样本区负压-10Pa', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 380, notes: '病原学检测与分子分型分区。高致病样本在P2+强化条件下操作，溯源留样规范。', pools: ['pcrMolecular', 'bioSafety'], set: 'setBioSafety' },
  { typeName: '艾滋病确证实验室', cleanLevelDefault: '万级', pressureRequirement: '检测区负压-10Pa', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 380, notes: '筛查与确证实验流程分区，样本库独立。免疫印迹与核酸检测平台分设，生物安全BSL-2+。', pools: ['pcrMolecular', 'bioSafety'], set: 'setBioSafety' },
  { typeName: '结核病实验室', cleanLevelDefault: '万级', pressureRequirement: '涂片间负压-15Pa，培养间-20Pa', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 25, illuminationLux: 400, notes: '痰涂片、培养、药敏分区，全排风高效过滤。感染性气溶胶操作全部在生物安全柜内进行。', pools: ['bioSafety', 'microbio'], set: 'setBioSafety' },
  { typeName: '流感监测实验室', cleanLevelDefault: '万级', pressureRequirement: '病毒分离区负压-15Pa', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 380, notes: '核酸检测与病毒分离培养分区，鸡胚与MDCK细胞双平台。样本-80℃冻存库独立。', pools: ['pcrMolecular', 'bioSafety'], set: 'setBioSafety' },
  { typeName: '食品安全风险监测实验室', cleanLevelDefault: '十万级', pressureRequirement: '常压，前处理独立排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 350, notes: '理化、微生物、毒理检测多平台。样品前处理区通风柜密集，防交叉污染设计。', pools: ['foodAgri', 'microbio'], set: 'setClean' },
  { typeName: '职业卫生检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，样品间独立排风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 300, notes: '现场采样与实验室分析衔接，粉尘、毒物、物理因素检测分设。仪器校准室恒温。', pools: ['environment', 'base'], set: 'setBasic' },

  // ===== 食品安全农业类 =====
  { typeName: '食品安全检测实验室', cleanLevelDefault: '十万级', pressureRequirement: '常压，微生物区负压', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: '理化、微生物、添加剂检测分区。感官评定室独立采光控制，留样室恒温恒湿。', pools: ['foodAgri', 'microbio'], set: 'setClean' },
  { typeName: '农产品检测实验室', cleanLevelDefault: '十万级', pressureRequirement: '常压，前处理独立排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: '农药残留、重金属、品质指标检测分平台。样品制备间通风除尘，色谱质谱机房独立。', pools: ['foodAgri', 'microbio'], set: 'setClean' },
  { typeName: '畜产品检测实验室', cleanLevelDefault: '十万级', pressureRequirement: '常压，微生物区负压-5Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: '兽残、瘦肉精、微生物检测分设。样品绞制均质间易清洗消毒，地面耐油污。', pools: ['foodAgri', 'microbio'], set: 'setClean' },
  { typeName: '水产品检测实验室', cleanLevelDefault: '十万级', pressureRequirement: '常压，微生物区负压', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: '鲜度、药残、重金属及寄生虫检测分区。样品解剖台防腐蚀，排水含渣预处理。', pools: ['foodAgri', 'microbio'], set: 'setClean' },
  { typeName: '饲料检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，制样间除尘', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 300, notes: '营养成分、霉菌毒素、违禁添加检测分设。粉碎制样间通风除尘，防交叉污染。', pools: ['foodAgri', 'microbio'], set: 'setBasic' },
  { typeName: '农药残留检测实验室', cleanLevelDefault: '十万级', pressureRequirement: '前处理间独立排风', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: 'QuEChERS前处理与色谱质谱分析衔接。标准品冷藏柜双人双锁管理。', pools: ['foodAgri', 'instrument'], set: 'setClean' },
  { typeName: '兽药残留检测实验室', cleanLevelDefault: '十万级', pressureRequirement: '前处理间独立排风', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: 'LC-MS/MS平台为核心，同位素内标管理。样品前处理与仪器室分开控温。', pools: ['foodAgri', 'instrument'], set: 'setClean' },
  { typeName: '转基因检测实验室', cleanLevelDefault: '万级', pressureRequirement: 'PCR区负压梯度', tempHumidity: '20~24℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 350, notes: '核酸提取、扩增、产物分析三分区防污染。阳性样本独立冷存与台账管理。', pools: ['pcrMolecular', 'foodAgri'], set: 'setClean' },
  { typeName: '种子质量检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，发芽室恒温恒湿', tempHumidity: '20~25℃ / 50%~60%', airChangesPerHour: 10, illuminationLux: 350, notes: '净度、发芽率、纯度、水分检测分室。人工气候室光照温湿度可编程控制。', pools: ['foodAgri', 'microbio'], set: 'setBasic' },
  { typeName: '土壤检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，制样间除尘排风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 300, notes: '风干制样间通风除尘，理化分析与重金属检测分设。酸柜独立排风防腐蚀。', pools: ['environment', 'foodAgri'], set: 'setBasic' },

  // ===== 环境水质类 =====
  { typeName: '环境监测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，前处理独立排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 10, illuminationLux: 350, notes: '水、气、土、噪声多要素检测分设。标准样品室恒温，大型仪器室分列防相互干扰。', pools: ['environment', 'base'], set: 'setBasic' },
  { typeName: '水质检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，消解间独立排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 350, notes: '常规理化与痕量金属分析分区分仪。消解通风柜防腐，纯水系统高配置。', pools: ['environment', 'base'], set: 'setBasic' },
  { typeName: '大气监测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，标气间恒温', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 10, illuminationLux: 350, notes: '气体采样器校准与分析衔接，标准气体专室存放。PM2.5称重室恒温恒湿±1℃。', pools: ['environment', 'base'], set: 'setBasic' },
  { typeName: '噪声监测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，本底噪声<30dB', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 8, illuminationLux: 300, notes: '声级计校准室低本底设计，隔声防振。仪器存放与检定分开管理。', pools: ['environment', 'base'], set: 'setBasic' },
  { typeName: '固废检测实验室', cleanLevelDefault: '普通', pressureRequirement: '制样间负压除尘', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 12, illuminationLux: 300, notes: '浸出毒性、腐蚀性检测分设。破碎制样除尘回收，马弗炉区独立散热。', pools: ['environment', 'instrument'], set: 'setBasic' },
  { typeName: '辐射防护实验室', cleanLevelDefault: '特殊', pressureRequirement: '常压，独立排风过滤', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 300, notes: '放射性样品分装间铅防护，监测仪器定期检定。放射源库双门双锁，废液衰变池专用。', pools: ['radNuclear', 'environment'], set: 'setRad' },
  { typeName: '室内空气质量检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，标准仓恒温', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 10, illuminationLux: 300, notes: '甲醛、TVOC、氡检测分设。环境测试舱恒定气候条件，可模拟材料释放实验。', pools: ['environment', 'base'], set: 'setBasic' },
  { typeName: '海洋环境监测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，样品冷藏充足', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 10, illuminationLux: 320, notes: '海水理化与海洋生物检测分设。盐度计恒温槽稳定，样品冷藏周转量大。', pools: ['environment', 'microbio'], set: 'setBasic' },

  // ===== 化工材料类 =====
  { typeName: '化学合成实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，合成间防爆排风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 12, illuminationLux: 300, notes: '通风柜按工艺流程布置，反应装置防静电接地。溶剂库防爆柜存储，应急冲淋完备。', pools: ['base', 'material'], set: 'setChem' },
  { typeName: '材料分析实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，仪器室恒温22±1℃', tempHumidity: '21~25℃ / 45%~55%', airChangesPerHour: 10, illuminationLux: 400, notes: '金相、XRD、电镜等分析手段分室。大型仪器独立基础防振，恒温恒湿保障。', pools: ['material', 'instrument'], set: 'setClean' },
  { typeName: '高分子材料实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，加工间排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 320, notes: '加工、力学测试、热分析衔接。挤出注塑设备用电容量大，排风耐腐蚀。', pools: ['material', 'instrument'], set: 'setClean' },
  { typeName: '金属材料实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，试样间独立排风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 320, notes: '制样、力学性能、金相、腐蚀试验分室。拉力机基础防振，酸洗间防腐。', pools: ['material', 'instrument'], set: 'setClean' },
  { typeName: '纳米材料实验室', cleanLevelDefault: '万级', pressureRequirement: '制备间微正压', tempHumidity: '21~25℃ / 40%~55%', airChangesPerHour: 18, illuminationLux: 400, notes: '粉体合成与分散在洁净环境进行，防吸入个体防护。超纯水与惰性气体供应到位。', pools: ['material', 'instrument'], set: 'setClean' },
  { typeName: '电池研发实验室', cleanLevelDefault: '十万级', pressureRequirement: '干燥间独立排风', tempHumidity: '20~25℃ / ≤40%', airChangesPerHour: 15, illuminationLux: 350, notes: '极片制备在低湿干燥间，扣电组装手套箱惰气保护。充放电测试区散热与消防专设。', pools: ['material', 'base'], set: 'setClean' },
  { typeName: '涂料研发实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，分散间排风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 12, illuminationLux: 300, notes: '研磨分散、调漆、检测分区。溶剂型与水性分开管理，VOC检测间加强通风。', pools: ['base', 'material'], set: 'setChem' },
  { typeName: '橡塑检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，加工间排热', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 320, notes: '混炼、硫化、物性检测分设。老化房高温通风，蒸汽管路防烫标识。', pools: ['material', 'base'], set: 'setClean' },
  { typeName: '油品检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，蒸馏间防爆', tempHumidity: '20~25℃ / ≤60%', airChangesPerHour: 12, illuminationLux: 320, notes: '馏程、闪点、粘度等油品指标检测分区。油样库通风阴凉，废油集中回收。', pools: ['instrument', 'base'], set: 'setChem' },
  { typeName: '危化品检测实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，样品间防爆负压', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 15, illuminationLux: 320, notes: '危化品分装在通风柜内进行，禁配物质隔离存储。防爆电器全覆盖，应急冲淋就近设置。', pools: ['base', 'instrument'], set: 'setChem' },
  { typeName: '同位素实验室', cleanLevelDefault: '特殊', pressureRequirement: '负压-10Pa，独立排风过滤', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 300, notes: '放射性同位素操作按活度分级分区。铅屏蔽全程覆盖，人员出入口设污染监测。', pools: ['radNuclear', 'bioSafety'], set: 'setRad' },
  { typeName: '爆炸品实验室', cleanLevelDefault: '特殊', pressureRequirement: '常压，独立建筑单设', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 300, notes: '试样量最小化，操作间防爆墙隔离。远程观测操作，静电接地全覆盖。', pools: ['base', 'material'], set: 'setChem' },

  // ===== 电子半导体类 =====
  { typeName: '半导体洁净室', cleanLevelDefault: '千级', pressureRequirement: '核心区正压+15Pa梯度', tempHumidity: '21~25℃ / 40%~55%', airChangesPerHour: 30, illuminationLux: 450, notes: 'FFU满布率按工艺等级核算，AMC分子污染控制。振动与微污染双管控，纯水特气系统到位。', pools: ['electron', 'cleanEquip'], set: 'setElec' },
  { typeName: '电子实验室', cleanLevelDefault: '十万级', pressureRequirement: '常压，焊接区独立排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 350, notes: '电路设计、装调、测试工位化布局。焊接烟气排风，防静电手环与接地规范。', pools: ['electron', 'base'], set: 'setBasic' },
  { typeName: '芯片测试实验室', cleanLevelDefault: '千级', pressureRequirement: '测试区正压+10Pa', tempHumidity: '21~25℃ / 40%~55%', airChangesPerHour: 25, illuminationLux: 450, notes: '探针台与测试机温控精度高，设备基础防振。ESD防护全区域覆盖。', pools: ['electron', 'cleanEquip'], set: 'setElec' },
  { typeName: '光电子实验室', cleanLevelDefault: '万级', pressureRequirement: '常压，暗室遮光', tempHumidity: '21~25℃ / 40%~55%', airChangesPerHour: 15, illuminationLux: 300, notes: '光学平台防振，暗室积分球测试。激光区联锁防护与警示标识齐全。', pools: ['electron', 'specialMisc'], set: 'setClean' },
  { typeName: '电磁兼容实验室', cleanLevelDefault: '特殊', pressureRequirement: '常压，屏蔽室独立', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 10, illuminationLux: 350, notes: '屏蔽室与电波暗室结构专业设计，波导窗通风。接地电阻严控，电源滤波隔离。', pools: ['electron', 'specialMisc'], set: 'setBasic' },
  { typeName: '可靠性实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，环境仓排热', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 320, notes: '高低温、湿热、振动、盐雾试验设备集中。循环水与排热系统匹配，设备基础防振。', pools: ['specialMisc', 'electron'], set: 'setClean' },
  { typeName: '防静电实验室', cleanLevelDefault: '万级', pressureRequirement: '常压，湿度严控45%±5%', tempHumidity: '22~25℃ / 40%~50%', airChangesPerHour: 15, illuminationLux: 350, notes: '全区域ESD防护体系，地板墙面接地电阻达标。静电放电模拟与测试仪表检定规范。', pools: ['electron', 'specialMisc'], set: 'setElec' },
  { typeName: '微电子实验室', cleanLevelDefault: '千级', pressureRequirement: '光刻区正压+10Pa', tempHumidity: '21~25℃ / 40%~50%', airChangesPerHour: 25, illuminationLux: 450, notes: '光刻、刻蚀、薄膜工艺洁净分级。化学品供应与废液收集管路化封闭管理。', pools: ['electron', 'cleanEquip'], set: 'setElec' },

  // ===== 司法鉴定类 =====
  { typeName: '法医鉴定实验室', cleanLevelDefault: '十万级', pressureRequirement: '解剖区负压-15Pa，检材区-5Pa', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 18, illuminationLux: 350, notes: '法医病理与法医物证分设，解剖台负压排风。检材流转全程双人复核留痕。', pools: ['foren', 'microbio'], set: 'setClean' },
  { typeName: '刑侦实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，微量物证间恒温', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 400, notes: '痕迹、理化、影像检验分区，防交叉污染。现场勘验设备充电与存放管理规范。', pools: ['foren', 'base'], set: 'setBasic' },
  { typeName: 'DNA鉴定实验室', cleanLevelDefault: '万级', pressureRequirement: '扩增区负压-10Pa', tempHumidity: '20~24℃ / 45%~60%', airChangesPerHour: 22, illuminationLux: 380, notes: '检材提取、PCR扩增、测序分析严格分区。防污染通道与紫外消杀设备完备。', pools: ['foren', 'pcrMolecular'], set: 'setClean' },
  { typeName: '毒物分析实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，前处理独立排风', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 350, notes: '毒化检材提取与色谱质谱分析衔接。标准品毒品库双人双锁，全程视频监控。', pools: ['foren', 'instrument'], set: 'setBasic' },
  { typeName: '文书鉴定实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，恒温恒湿防紫外', tempHumidity: '20~24℃ / 50%~60%', airChangesPerHour: 8, illuminationLux: 450, notes: '比对显微镜与文检仪集中布置，光源色温可控。纸张墨迹样本库恒温恒湿保存。', pools: ['foren', 'base'], set: 'setBasic' },
  { typeName: '痕迹鉴定实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，恒温防振', tempHumidity: '20~25℃ / 45%~60%', airChangesPerHour: 8, illuminationLux: 400, notes: '手印、工具痕迹、足迹检验分设。三维扫描与比对设备设防振基础。', pools: ['foren', 'base'], set: 'setBasic' },

  // ===== 化妆品日化类 =====
  { typeName: '化妆品检测实验室', cleanLevelDefault: '十万级', pressureRequirement: '微生物区负压-5Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: '理化、微生物、毒理学检测分区。致病菌检测独立间，防止误用混用。', pools: ['cosmetic', 'microbio'], set: 'setClean' },
  { typeName: '日化产品实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，调配间排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 320, notes: '洗涤用品与个人护理配方开发。稳定性考察房多温区设置。', pools: ['cosmetic', 'base'], set: 'setBasic' },
  { typeName: '香精香料实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，闻香间独立新风', tempHumidity: '21~25℃ / 50%~60%', airChangesPerHour: 10, illuminationLux: 320, notes: '调香间无异味干扰，独立新风系统。GC-MS香气成分分析与感官评价衔接。', pools: ['cosmetic', 'base'], set: 'setBasic' },
  { typeName: '洗涤用品实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，去污测试间恒温', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 320, notes: '去污力、泡沫、稳定性测试标准化。硬水配制与恒温槽配套。', pools: ['cosmetic', 'base'], set: 'setBasic' },
  { typeName: '化妆品功效评价实验室', cleanLevelDefault: '万级', pressureRequirement: '评价区恒温恒湿', tempHumidity: '21~24℃ / 45%~55%', airChangesPerHour: 15, illuminationLux: 400, notes: '人体功效评价室与体外测试分开。皮肤图像采集环境光标准化，温湿度恒定。', pools: ['cosmetic', 'cellCulture'], set: 'setClean' },

  // ===== 医疗器械类 =====
  { typeName: '医疗器械检测实验室', cleanLevelDefault: '十万级', pressureRequirement: '常压，环境仓排热', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 400, notes: '有源与无源器械检测分设。环境试验设备容量预留，EMC暗室独立建设。', pools: ['medicalDevice', 'material'], set: 'setClean' },
  { typeName: '无菌医疗器械实验室', cleanLevelDefault: '百级', pressureRequirement: '无菌室正压+10Pa', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 25, illuminationLux: 450, notes: '包装、灭菌、无菌检测全流程模拟。洁净取样板与沉降菌监测规范。', pools: ['medicalDevice', 'cleanEquip'], set: 'setBioSafety' },
  { typeName: '植入器械实验室', cleanLevelDefault: '万级', pressureRequirement: '洁净区正压梯度', tempHumidity: '21~25℃ / 40%~55%', airChangesPerHour: 22, illuminationLux: 400, notes: '植入物疲劳、腐蚀、磨损测试。生物相容性样品制备无菌管控。', pools: ['medicalDevice', 'cellCulture'], set: 'setClean' },
  { typeName: '体外诊断试剂实验室', cleanLevelDefault: '万级', pressureRequirement: '洁净区正压，阳性区负压', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 22, illuminationLux: 400, notes: '试剂配制、分装、冻干洁净分级。精密性与稳定性考察恒温恒湿保障。', pools: ['medicalDevice', 'pcrMolecular'], set: 'setClean' },
  { typeName: '医疗器械生物学评价实验室', cleanLevelDefault: '万级', pressureRequirement: '细胞间正压+10Pa', tempHumidity: '21~25℃ / 45%~55%', airChangesPerHour: 22, illuminationLux: 400, notes: '细胞毒、致敏、刺激试验分设。ISO 10993标准样品制备规范。', pools: ['medicalDevice', 'cellCulture'], set: 'setClean' },

  // ===== 教学科研类 =====
  { typeName: '高校教学实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，自然通风+机械排风', tempHumidity: '18~28℃ / ≤65%', airChangesPerHour: 8, illuminationLux: 300, notes: '满足30~50人同时操作，工位供电独立控电。教师演示台居中布置，安全疏散通道宽敞。', pools: ['teach', 'base'], set: 'setTeach' },
  { typeName: '高校科研实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，课题组分区排风', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 350, notes: '按课题组划分单元，通风柜共享池设计。仪器分析平台集中管理提高利用率。', pools: ['base', 'instrument'], set: 'setBasic' },
  { typeName: '中学生物实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，自然采光充足', tempHumidity: '18~28℃ / ≤65%', airChangesPerHour: 8, illuminationLux: 350, notes: '显微镜工位供电成组，标本展示柜沿墙布置。洗涤池防堵防溅，通风良好。', pools: ['teach', 'microbio'], set: 'setTeach' },
  { typeName: '中学化学实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，演示通风柜必备', tempHumidity: '18~28℃ / ≤65%', airChangesPerHour: 10, illuminationLux: 350, notes: '通风柜与急救设施齐全，试剂柜锁控管理。酸碱分类存放，废液统一收集。', pools: ['teach', 'base'], set: 'setTeach' },
  { typeName: '中学物理实验室', cleanLevelDefault: '普通', pressureRequirement: '常压', tempHumidity: '18~28℃ / ≤65%', airChangesPerHour: 8, illuminationLux: 350, notes: '力学、电学、光学实验分桌布置。接地保护完善，光学期配遮光窗帘。', pools: ['teach', 'electron'], set: 'setTeach' },
  { typeName: '大学化学实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，通风柜密集', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 12, illuminationLux: 350, notes: '无机、有机、分析化学实验分单元。通风柜率≥1/2工位，安全设施全覆盖。', pools: ['teach', 'base'], set: 'setTeach' },
  { typeName: '大学物理实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，防振暗室预留', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 8, illuminationLux: 350, notes: '力学热学电磁光学实验分室。精密测量室防振，遮光与接地规范。', pools: ['teach', 'electron'], set: 'setTeach' },
  { typeName: '大学动物实验室', cleanLevelDefault: 'SPF级', pressureRequirement: '屏障环境正压+20Pa', tempHumidity: '20~24℃ / 50%~60%', airChangesPerHour: 20, illuminationLux: 300, notes: '屏障系统人净物净流程严格，笼具清洗区独立。饲料垫料消毒后进入，死淘动物无害化处理。', pools: ['animal', 'base'], set: 'setAnimal' },
  { typeName: '科研院所通用实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，多学科分区', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 350, notes: '通用化学与仪器平台共享，特殊工艺间预留。通风柜池化排风变频节能。', pools: ['base', 'microbio'], set: 'setBasic' },
  { typeName: '企业研发实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，中试区独立', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 12, illuminationLux: 350, notes: '小试、中试、检测衔接布局。知识产权保护分区管理，访客参观可视设计。', pools: ['base', 'instrument'], set: 'setBasic' },

  // ===== 特殊其他类 =====
  { typeName: '动物实验室SPF级', cleanLevelDefault: 'SPF级', pressureRequirement: '屏障正压+20Pa梯度', tempHumidity: '20~24℃ / 50%~60%', airChangesPerHour: 22, illuminationLux: 300, notes: 'SPF屏障环境三级过滤全新风，双走廊物流单向。垫料笼具高压灭菌，环境参数在线监控。', pools: ['animal', 'cleanEquip'], set: 'setAnimal' },
  { typeName: '动物实验室普通级', cleanLevelDefault: '普通', pressureRequirement: '清洁区正压，污物区负压', tempHumidity: '20~26℃ / 50%~60%', airChangesPerHour: 15, illuminationLux: 300, notes: '普通级环境温湿度可控，清洗消毒间完备。防逃逸与防虫害设计到位。', pools: ['animal', 'base'], set: 'setAnimal' },
  { typeName: '细胞培养室', cleanLevelDefault: '万级', pressureRequirement: '培养区正压+10Pa', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 22, illuminationLux: 400, notes: '缓冲间、更衣、培养、观察单向布局。CO2培养箱集中供气，液氮罐区加强通风。', pools: ['cellCulture', 'bioSafety'], set: 'setClean' },
  { typeName: '组织工程实验室', cleanLevelDefault: '百级', pressureRequirement: '核心区正压+15Pa', tempHumidity: '20~24℃ / 45%~55%', airChangesPerHour: 25, illuminationLux: 400, notes: '支架材料与细胞复合在洁净环境完成。生物反应器区独立，理化检测区衔接。', pools: ['cellCulture', 'bioSafety'], set: 'setClean' },
  { typeName: '3D打印实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，打印区排风', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 320, notes: '金属与树脂打印分区，粉尘与VOC处理。后处理间独立，粉末回收防爆。', pools: ['material', 'specialMisc'], set: 'setBasic' },
  { typeName: '机器人实验室', cleanLevelDefault: '普通', pressureRequirement: '常压', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 10, illuminationLux: 400, notes: '机器人运行区安全围栏与急停全覆盖。地面平整耐磨，供电容量充足。', pools: ['electron', 'specialMisc'], set: 'setBasic' },
  { typeName: '无人机实验室', cleanLevelDefault: '普通', pressureRequirement: '常压，飞行区净空', tempHumidity: '20~26℃ / ≤60%', airChangesPerHour: 8, illuminationLux: 400, notes: '室内飞行区防护网与定位系统，维修工位防静电。电池充电间防爆独立设置。', pools: ['electron', 'specialMisc'], set: 'setBasic' },
  { typeName: '声学实验室', cleanLevelDefault: '特殊', pressureRequirement: '常压，本底噪声<20dB', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 8, illuminationLux: 300, notes: '消声室六面尖劈，隔声房浮筑结构。空调低速消声风道，防固体传声。', pools: ['specialMisc', 'electron'], set: 'setBasic' },
  { typeName: '光学实验室', cleanLevelDefault: '万级', pressureRequirement: '常压，恒温±0.5℃', tempHumidity: '21~24℃ / 40%~50%', airChangesPerHour: 12, illuminationLux: 300, notes: '光学平台隔振基础，暗室遮光分级。超净区与装调区分设，防尘管理严格。', pools: ['specialMisc', 'electron'], set: 'setClean' },
  { typeName: '恒温恒湿实验室', cleanLevelDefault: '万级', pressureRequirement: '常压，温度±0.5℃湿度±3%', tempHumidity: '23±0.5℃ / 50%±3%', airChangesPerHour: 15, illuminationLux: 400, notes: '精密空调N+1冗余配置，围护结构保温隔湿。气流组织均匀，在线监控记录。', pools: ['specialMisc', 'base'], set: 'setClean' },

  // ===== 理化通用类 =====
  { typeName: '理化实验室', cleanLevelDefault: '十万级', pressureRequirement: '常压，通风柜区微负压', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 15, illuminationLux: 350, notes: '通用理化检测平台，通风柜与台柜标准化配置。酸碱分区存放，废液分类收集。', pools: ['base', 'instrument'], set: 'setClean' },
  { typeName: '微生物实验室', cleanLevelDefault: '十万级', pressureRequirement: '无菌室正压，操作区负压-5Pa', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 18, illuminationLux: 350, notes: '无菌室与培养室分设，流通蒸汽灭菌配套。菌种管理双人双锁。', pools: ['microbio', 'base'], set: 'setClean' },
  { typeName: '通用实验室', cleanLevelDefault: '普通', pressureRequirement: '常压', tempHumidity: '20~26℃ / 45%~60%', airChangesPerHour: 8, illuminationLux: 300, notes: '满足常规实验需求的基础配置。台柜与通风柜按需扩展，水电点位预留充足。', pools: ['base'], set: 'setBasic' },
];

// 类型名唯一性守卫
const names = labTypes.map((t) => t.typeName);
if (new Set(names).size !== names.length) {
  throw new Error('实验室类型名称存在重复，请检查数据');
}

// 从设备池组装设备清单（按池顺序去重，最多15项）
function buildEquipment(poolNames: string[]): EqTuple[] {
  const seen = new Set<string>();
  const list: EqTuple[] = [];
  for (const pool of poolNames) {
    const items = equipmentPools[pool];
    if (!items) throw new Error(`未知设备池: ${pool}`);
    for (const item of items) {
      if (!seen.has(item[0])) {
        seen.add(item[0]);
        list.push(item);
      }
    }
  }
  if (list.length < 8) {
    throw new Error(`设备不足8项: ${list.length}`);
  }
  return list.slice(0, 15);
}

// ============ 主流程 ============
async function main() {
  console.log(`开始写入 ${labTypes.length} 种实验室类型...`);

  // 报价档位（保留3档，幂等写入）
  const levels = [
    { levelName: '经济型', equipmentMultiplier: 0.75, constructionMultiplier: 0.8, managementFeeRate: 0.08, profitRate: 0.08, isDefault: false },
    { levelName: '标准型', equipmentMultiplier: 1.0, constructionMultiplier: 1.0, managementFeeRate: 0.12, profitRate: 0.10, isDefault: true },
    { levelName: '高端型', equipmentMultiplier: 1.35, constructionMultiplier: 1.3, managementFeeRate: 0.15, profitRate: 0.12, isDefault: false },
  ];
  for (const lv of levels) {
    await prisma.priceLevel.upsert({
      where: { levelName: lv.levelName },
      update: lv,
      create: lv,
    });
  }
  console.log('报价档位：3档已就绪');

  let eqTotal = 0;
  let cfTotal = 0;

  for (const def of labTypes) {
    const lt = await prisma.labType.create({
      data: {
        typeName: def.typeName,
        cleanLevelDefault: def.cleanLevelDefault,
        pressureRequirement: def.pressureRequirement,
        tempHumidity: def.tempHumidity,
        airChangesPerHour: def.airChangesPerHour,
        illuminationLux: def.illuminationLux,
        notes: def.notes,
      },
    });

    const equipment = buildEquipment(def.pools);
    await prisma.equipmentTemplate.createMany({
      data: equipment.map((e, i) => ({
        labTypeId: lt.id,
        equipmentName: e[0],
        specification: e[1],
        unit: e[2],
        qtyPer100Area: e[3],
        baseUnitPrice: e[4],
        isRequired: e[5],
        sortOrder: i + 1,
      })),
    });
    eqTotal += equipment.length;

    const factors = constructionSets[def.set];
    if (factors.length < 6 || factors.length > 12) {
      throw new Error(`${def.typeName} 工程系数数量不在6-12范围: ${factors.length}`);
    }
    await prisma.constructionFactor.createMany({
      data: factors.map((f, i) => ({
        labTypeId: lt.id,
        itemName: f[0],
        unit: f[1],
        factorPerArea: f[2],
        baseUnitPrice: f[3],
        category: f[4],
        sortOrder: i + 1,
      })),
    });
    cfTotal += factors.length;
  }

  console.log('种子数据创建完成：');
  console.log(`  实验室类型：${labTypes.length} 种`);
  console.log(`  设备模板：${eqTotal} 条`);
  console.log(`  工程量系数：${cfTotal} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
