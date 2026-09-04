// 十二大行业完整种子：行业标准映射 + 选型参数 + 9大专业领域节点 + 行业工艺
// 运行：npx tsx prisma/seed-engineering-full.ts（幂等：可重复运行，不产生重复数据）
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

// ---- 十二大行业选型参数 [系统分类, 参数名, 推荐值, 单位, 参考来源] ----
const INDUSTRY_PARAMS: Record<string, Array<[string, string, string, string, string]>> = {
  '数据中心/IDC': [
    ['暖通空调', 'PUE优化目标', '≤1.3', '', 'GB 50174'],
    ['暖通空调', '冷热通道密封', '≥99%', '%', 'ANSI/TIA-942'],
    ['电气系统', 'UPS冗余等级', '2N', '', 'TIA-942'],
    ['环境控制', '温度设定', '18~27', '℃', 'ASHRAE'],
    ['环境控制', '相对湿度', '40~60', '%RH', 'ASHRAE'],
    ['消防系统', '气体灭火类型', 'IG-541', '', 'NFPA 2001'],
  ],
  '动物实验室（SPF级）': [
    ['屏障环境', '压差梯度', '≥50', 'Pa', 'GB 14925'],
    ['屏障环境', '换气次数', '≥20', '次/h', 'GB 14925'],
    ['关键设备', 'IVC笼具换气', '≥60', '次/h', 'GB 14925'],
    ['生物安全', 'BSC类型', 'Ⅱ级A2', '', 'NSF/ANSI 49'],
    ['环境控制', '温度', '20~26', '℃', 'GB 14925'],
    ['环境控制', '相对湿度', '40~70', '%RH', 'GB 14925'],
    ['消毒灭菌', '双扉灭菌器温度', '≥134', '℃', 'EN 285'],
  ],
  '精密机械/钟表制造': [
    ['环境控制', '温度波动', '±0.1', '℃', 'VDI 2083'],
    ['防微振', '振动等级', 'VC-C', '', 'ISO 14644-4'],
    ['洁净度', '颗粒度（≥0.5μm）', '≤3520', '粒/m³', 'ISO 14644-1'],
    ['暖通空调', '换气次数', '≥30', '次/h', 'GB 50073'],
    ['静电防护', '接地电阻', '≤1', 'Ω', 'SJ/T 10694'],
    ['材料构造', '地面材料', '防静电环氧', '', 'GB 50591'],
  ],
  '纳米材料/新材料': [
    ['洁净度', 'ISO等级', 'ISO 3', '', 'ISO 14644-1'],
    ['环境控制', 'AMC浓度', '≤0.1', 'μg/m³', 'SEMI F21'],
    ['环境控制', '颗粒度（≥0.1μm）', '≤100', '粒/m³', 'ISO 14644-1'],
    ['材料构造', '低释气材料', '总质量损失≤1%', '', 'ASTM E595'],
    ['暖通空调', '全新风系统', '≥100', '%', 'GB 50073'],
    ['静电防护', '离子风机安装间距', '≤1', 'm', 'IEC 61340'],
  ],
  'PCB/半导体制造': [
    ['洁净度', '光刻区ISO等级', 'ISO 2', '', 'SEMI F21'],
    ['环境控制', '温湿度精度', '±0.5℃ / ±2%', '', 'SEMI F21'],
    ['环境控制', 'AMC控制', '酸/碱各≤0.5', 'ppb', 'ITRS'],
    ['防微振', '曝光机振动等级', 'VC-E', '', 'ISO 14644-4'],
    ['静电防护', '接地系统阻抗', '≤0.5', 'Ω', 'ANSI ESD S20.20'],
    ['纯水/废水', 'UPW电阻率', '≥18.2', 'MΩ·cm', 'SEMI F63'],
  ],
  '医药/生物制药（GMP）': [
    ['洁净度', 'A级区颗粒度（≥0.5μm）', '≤3520', '粒/m³', 'EU GMP Annex 1'],
    ['环境控制', 'A级区浮游菌', '≤1', 'CFU/m³', 'EU GMP Annex 1'],
    ['环境控制', '压差梯度', '≥10', 'Pa', 'GB 50457'],
    ['暖通空调', '换气次数（B级）', '≥40', '次/h', 'GB 50457'],
    ['验证管理', 'PQ验证周期', '每6个月', '', 'FDA 21 CFR Part 11'],
    ['材料构造', '墙面材料', '彩钢板（抗菌涂层）', '', 'GB 50591'],
  ],
  '食品/饮料制造': [
    ['洁净度', '灌装区ISO等级', 'ISO 7', '', 'GB 14881'],
    ['环境控制', '温湿度', '≤25℃ / ≤60%', '', 'GB 14881'],
    ['给排水', '排水系统坡度', '≥2', '%', 'GB 50268'],
    ['材料构造', '地坪材料', '聚氨酯砂浆', '', 'GB 50037'],
    ['消毒灭菌', 'CIP/SIP清洗', '≥85℃ / 30min', '', 'FDA 21 CFR'],
    ['暖通空调', '换气次数', '≥15', '次/h', 'GB 50073'],
  ],
  '精细化工': [
    ['洁净度', 'ISO等级', 'ISO 6', '', 'GB 50073'],
    ['环境控制', '防爆分区', '1区/2区', '', 'GB 3836'],
    ['环境控制', '温湿度', '15~30℃ / ≤70%', '', 'GB 50073'],
    ['材料构造', '防腐墙面', 'FRP玻璃钢', '', 'HG/T 20696'],
    ['暖通空调', '排风换气次数', '≥12', '次/h', 'GB 50073'],
    ['消防系统', '泡沫灭火系统', '低倍数', '', 'GB 50151'],
  ],
  '航空航天': [
    ['洁净度', '装配区ISO等级', 'ISO 5', '', 'NASA STD-8719'],
    ['环境控制', '温湿度', '20~25℃ / 35~55%', '', 'NASA STD-8719'],
    ['防微振', '振动等级', 'VC-A', '', 'ISO 14644-4'],
    ['ESD防护', '防静电地板电阻', '≤1×10⁹', 'Ω', 'MIL-STD-1686'],
    ['材料构造', '低释气/不燃材料', '总质量损失≤1%', '', 'ASTM E595'],
  ],
  '医疗/医疗器械': [
    ['洁净度', 'ISO等级', 'ISO 7', '', 'ISO 13485'],
    ['环境控制', '温湿度', '18~28℃ / 40~65%', '', 'ISO 13485'],
    ['纯水/废水', '纯化水电导率', '≤5.1', 'μS/cm', 'USP 1231'],
    ['环境控制', '压差梯度', '≥5', 'Pa', 'YY 0033'],
    ['材料构造', '生物相容性材料', '通过ISO 10993', '', 'ISO 10993'],
  ],
  '光伏/新能源': [
    ['洁净度', '电池片制绒区', 'ISO 4', '', 'GB/T 36280'],
    ['环境控制', '露点温度', '≤-40', '℃', 'GB/T 36280'],
    ['暖通空调', '换气次数', '≥25', '次/h', 'GB 50073'],
    ['静电防护', '接地电阻', '≤1', 'Ω', 'SJ/T 10694'],
    ['工艺排气', '酸排/有机排', '耐腐蚀管道', '', 'GB 50726'],
  ],
  '电子组装/通用工业': [
    ['洁净度', '丝印/贴片区', 'ISO 6', '', 'GB 50073'],
    ['环境控制', '温湿度', '22±2℃ / 50±10%', '', 'IPC-J-STD-001'],
    ['静电防护', '防静电工作台电阻', '≤1×10⁹', 'Ω', 'ANSI ESD S20.20'],
    ['暖通空调', '换气次数', '≥20', '次/h', 'GB 50073'],
    ['照明', '照度要求', '≥500', 'Lux', 'GB 50034'],
  ],
};

// ---- 十二大行业标准映射（main 主要 / special 行业专项 / support 配套） ----
const INDUSTRY_STANDARDS: Record<string, { code: string; name: string; type: string; priority: number; scope: string }[]> = {
  '数据中心/IDC': [
    { code: 'GB 50174-2017', name: '数据中心设计规范', type: '主要', priority: 4, scope: '数据中心设计' },
    { code: 'TIA-942-B', name: '数据中心基础设施标准', type: '行业专项', priority: 5, scope: '数据中心基础设施分级' },
    { code: 'NFPA 75', name: '信息技术设备防火标准', type: '配套', priority: 2, scope: '机房消防' },
  ],
  '动物实验室（SPF级）': [
    { code: 'GB 14925-2010', name: '实验动物 环境及设施', type: '主要', priority: 4, scope: '实验动物环境' },
    { code: 'GB 50447-2008', name: '实验动物设施建筑技术规范', type: '行业专项', priority: 5, scope: '设施建筑' },
    { code: 'GB 19489-2008', name: '实验室 生物安全通用要求', type: '配套', priority: 2, scope: '生物安全' },
  ],
  '精密机械/钟表制造': [
    { code: 'VDI 2083', name: '洁净室技术（德国工程师协会）', type: '行业专项', priority: 5, scope: '精密制造洁净控制' },
    { code: 'ISO 14644-4:2015', name: '洁净室及相关受控环境 第4部分：设计、建造、启动', type: '配套', priority: 2, scope: '设计建造' },
  ],
  '纳米材料/新材料': [
    { code: 'SEMI F21', name: '分子级环境空气品质分类', type: '行业专项', priority: 5, scope: 'AMC控制' },
    { code: 'ASTM E595', name: '真空环境中材料释气测试', type: '配套', priority: 2, scope: '低释气材料' },
  ],
  'PCB/半导体制造': [
    { code: 'SEMI F63', name: '超纯水系统设计规范', type: '行业专项', priority: 5, scope: 'UPW系统' },
    { code: 'ANSI ESD S20.20', name: '静电放电控制程序', type: '行业专项', priority: 5, scope: 'ESD体系' },
    { code: 'ITRS', name: '国际半导体技术路线图', type: '配套', priority: 2, scope: 'AMC控制目标' },
  ],
  '医药/生物制药（GMP）': [
    { code: 'EU GMP Annex 1', name: '欧盟GMP 无菌药品生产附录1', type: '行业专项', priority: 5, scope: '无菌环境' },
    { code: 'FDA 21 CFR Part 11', name: '电子记录与电子签名', type: '配套', priority: 2, scope: '数据完整性' },
    { code: 'GB 50457-2019', name: '医药工业洁净厂房设计标准', type: '主要', priority: 4, scope: '医药洁净设计' },
  ],
  '食品/饮料制造': [
    { code: 'GB 14881-2013', name: '食品生产通用卫生规范', type: '主要', priority: 4, scope: '食品生产卫生' },
    { code: 'GB 50687-2011', name: '食品工业洁净用房建筑技术规范', type: '行业专项', priority: 5, scope: '洁净用房' },
    { code: 'GB 50037-2013', name: '建筑地面设计规范', type: '配套', priority: 2, scope: '地坪设计' },
  ],
  '精细化工': [
    { code: 'GB 3836.1-2010', name: '爆炸性环境 第1部分：设备通用要求', type: '行业专项', priority: 5, scope: '防爆' },
    { code: 'HG/T 20696-1999', name: '化工企业防腐蚀设计规范', type: '行业专项', priority: 5, scope: '防腐设计' },
    { code: 'GB 50151-2021', name: '泡沫灭火系统技术标准', type: '配套', priority: 2, scope: '消防' },
  ],
  '航空航天': [
    { code: 'NASA STD-8719', name: 'NASA安全标准', type: '行业专项', priority: 5, scope: '装配环境' },
    { code: 'MIL-STD-1686', name: 'ESD控制军用标准', type: '行业专项', priority: 5, scope: 'ESD防护' },
  ],
  '医疗/医疗器械': [
    { code: 'YY 0033-2000', name: '无菌医疗器具生产管理规范', type: '行业专项', priority: 5, scope: '无菌生产' },
    { code: 'ISO 13485:2016', name: '医疗器械质量管理体系', type: '主要', priority: 4, scope: '质量体系' },
    { code: 'ISO 10993-1', name: '医疗器械生物学评价', type: '配套', priority: 2, scope: '生物相容性' },
    { code: 'USP 1231', name: '美国药典 制药用水', type: '配套', priority: 2, scope: '纯化水' },
  ],
  '光伏/新能源': [
    { code: 'GB 50726-2011', name: '工业设备及管道防腐蚀工程施工规范', type: '配套', priority: 2, scope: '防腐蚀管道' },
  ],
  '电子组装/通用工业': [
    { code: 'IPC-J-STD-001', name: '焊接电气和电子组件要求', type: '行业专项', priority: 5, scope: '焊接工艺环境' },
    { code: 'GB 50034-2013', name: '建筑照明设计标准', type: '配套', priority: 2, scope: '照度' },
  ],
};

// ---- 9 大专业领域（固定 nodeCode，upsert 幂等） ----
const SPECIALTY_TOPICS = [
  { code: 'SPEC-01-消防', name: '消防系统深化', sheets: ['喷淋系统', '气体灭火', 'VESDA极早期探测', '细水雾', '防排烟', '防火分隔'] },
  { code: 'SPEC-02-安全', name: '安全与职业健康', sheets: ['化学品安全', '生物安全', '辐射防护', '噪声控制', '人机工程'] },
  { code: 'SPEC-03-验证', name: '验证与确认', sheets: ['IQ安装确认', 'OQ运行确认', 'PQ性能确认', '系统调试', '洁净检测'] },
  { code: 'SPEC-04-认证', name: '认证与合规', sheets: ['GMP认证', 'ISO体系认证', '行业准入', '审计迎检'] },
  { code: 'SPEC-05-供应链', name: '供应链与采购', sheets: ['设备采购', '材料比选', '供应商管理', '进口设备清关'] },
  { code: 'SPEC-06-能源', name: '能源与碳排放', sheets: ['能耗计量', '碳盘查', '绿色建造', '节能改造'] },
  { code: 'SPEC-07-智造', name: '智能制造与自动化', sheets: ['MES系统', 'SCADA监控', '数据采集', '设备联网'] },
  { code: 'SPEC-08-质量', name: '质量管理体系', sheets: ['ISO 9001', 'QA/QC流程', '偏差管理', '变更控制'] },
  { code: 'SPEC-09-项目管理', name: 'EPC项目管理', sheets: ['设计管理', '进度控制', '造价管理', '变更签证', 'BIM协同'] },
];

// ---- 行业工艺补充 [工序, 类别, 步骤数组, 质量标准, 验收, 安全] ----
const INDUSTRY_PROCESSES: Array<{ processName: string; category: string; steps: string[]; qualityStd: string; acceptance: string; safetyNotes: string }> = [
  { processName: '聚氨酯砂浆地坪施工（食品车间）', category: '地面', steps: ['基层抛丸', '底涂', '砂浆层摊铺', '面涂', '养护7天'], qualityStd: '厚度≥4mm，抗冲击无开裂', acceptance: '无毒认证+防滑系数≥0.6', safetyNotes: '施工时强制通风，佩戴防毒面具' },
  { processName: 'UPW超纯水管道安装（半导体）', category: '纯水', steps: ['管材确认PVDF', '自动热熔焊接', '内窥镜检查', '纯水冲洗', ' TOC检测'], qualityStd: '焊口合格率100%，颗粒≤1个/mL', acceptance: '电阻率≥18.2MΩ·cm持续24h', safetyNotes: '焊接区严禁粉尘，人员穿无尘服' },
  { processName: 'FRP防腐墙面施工（化工）', category: '装饰', steps: ['基层除锈', '刮腻子', 'FRP分层铺贴', '固化养护'], qualityStd: '无气泡无分层，附着力≥1级', acceptance: '电火花检测无漏点', safetyNotes: '固化剂严禁接触皮肤，防火防爆' },
  { processName: '医药级不锈钢管道焊接（GMP）', category: '管道', steps: ['管口清洁', '自动轨道氩弧焊', '内窥镜检查', '钝化处理', '纯蒸汽灭菌'], qualityStd: '内焊缝无黑线，Ra≤0.4μm', acceptance: '死区≤3D，坡度≥1%', safetyNotes: '氩气瓶固定，焊接面罩' },
  { processName: '数据中心热通道封闭改造', category: '暖通', steps: ['机柜布局测量', '通道框架安装', '滑门安装', '缝隙密封', 'CFD气流验证'], qualityStd: '通道密封≥99%', acceptance: 'PUE实测下降≥0.15', safetyNotes: '带电作业需双人监护' },
  { processName: '波峰焊排风系统安装（电子组装）', category: '暖通', steps: ['排风罩定位', '风管连接', '活性炭吸附箱安装', '风速调试'], qualityStd: '罩面风速≥0.5m/s', acceptance: '排放浓度达标检测', safetyNotes: '助焊剂烟气有毒，过滤器更换需防护' },
];

async function main() {
  console.log('🌱 植入十二大行业完整种子数据...');

  // 1. 行业标准 → Standard upsert
  let stdCount = 0;
  for (const [industry, stds] of Object.entries(INDUSTRY_STANDARDS)) {
    for (const s of stds) {
      await prisma.standard.upsert({
        where: { code: s.code },
        update: {}, // 不覆盖已有行业归属
        create: { code: s.code, name: s.name, type: s.type, priority: s.priority, industry, scope: s.scope, status: '现行', keywords: `${industry},${s.scope}` },
      });
      stdCount++;
    }
  }
  console.log(`  ✅ 行业标准 upsert ${stdCount} 条`);

  // 2. 行业选型参数（按 industry+paramKey 幂等跳过）
  let cfgNew = 0, cfgSkip = 0;
  for (const [industry, params] of Object.entries(INDUSTRY_PARAMS)) {
    for (const [system, key, value, unit, ref] of params) {
      const exists = await prisma.industryConfig.findFirst({ where: { industry, paramKey: key } });
      if (exists) { cfgSkip++; continue; }
      await prisma.industryConfig.create({
        data: { industry, systemCategory: system, paramKey: key, paramValue: value, unit, reference: ref, priority: 3 },
      });
      cfgNew++;
    }
  }
  console.log(`  ✅ 选型参数：新增 ${cfgNew} 条，跳过已有 ${cfgSkip} 条`);

  // 3. 9 大专业领域节点（固定 nodeCode upsert）
  for (const t of SPECIALTY_TOPICS) {
    await prisma.knowledgeNode.upsert({
      where: { nodeCode: t.code },
      update: {
        summary: `L0：${t.name}——涵盖 ${t.sheets.join('、')} 等细分领域`,
        parameters: JSON.stringify(t.sheets.map((s, i) => ({ index: i + 1, sheet: s }))),
      },
      create: {
        nodeCode: t.code,
        industry: '通用',
        facilityType: '全形态',
        environment: 'N/A',
        title: `专业领域：${t.name}`,
        summary: `L0：${t.name}——涵盖 ${t.sheets.join('、')} 等细分领域`,
        regulations: JSON.stringify([]),
        chapters: JSON.stringify([]),
        clauses: '细分领域清单，具体条文按各专项标准补充',
        parameters: JSON.stringify(t.sheets.map((s, i) => ({ index: i + 1, sheet: s }))),
        logic: '该领域为跨行业通用专业，与各行业专项标准交叉引用',
        crossLinks: JSON.stringify([]),
        lifecycle: JSON.stringify([{ stage: '知识地图', note: '2026-09-04 初始化' }]),
        status: 'review',
        source: 'system',
      },
    });
  }
  console.log(`  ✅ 专业领域节点 ${SPECIALTY_TOPICS.length} 个（upsert）`);

  // 4. 行业工艺（按 processName 幂等跳过）
  let procNew = 0;
  for (const p of INDUSTRY_PROCESSES) {
    const exists = await prisma.processFlow.findFirst({ where: { processName: p.processName } });
    if (exists) continue;
    await prisma.processFlow.create({
      data: { processName: p.processName, category: p.category, steps: p.steps, qualityStd: p.qualityStd, acceptance: p.acceptance, safetyNotes: p.safetyNotes },
    });
    procNew++;
  }
  console.log(`  ✅ 工艺：新增 ${procNew} 条`);

  // 5. 消防类速查演示数据（让"喷淋系统/气体灭火"等 Sheet 有内容，幂等）
  const fireStandards = [
    { code: 'GB 50084-2017', name: '自动喷水灭火系统设计规范', type: '主要', priority: 4, industry: '通用', scope: '喷淋系统设计', keywords: '喷淋系统,喷头,洒水' },
    { code: 'GB 50116-2013', name: '火灾自动报警系统设计规范', type: '主要', priority: 4, industry: '通用', scope: '火灾探测与联动', keywords: '火灾报警,VESDA,探测器' },
    { code: 'GB 50370-2005', name: '气体灭火系统设计规范', type: '主要', priority: 4, industry: '通用', scope: '气体灭火', keywords: '气体灭火,IG-541,七氟丙烷' },
  ];
  for (const s of fireStandards) {
    await prisma.standard.upsert({ where: { code: s.code }, update: {}, create: { ...s, status: '现行' } });
  }
  const fireConfigs = [
    { industry: '通用', systemCategory: '消防系统', paramKey: '喷淋喷头溅水盘与吊顶距离', paramValue: '75~150', unit: 'mm', reference: 'GB 50084', priority: 3 },
    { industry: '通用', systemCategory: '消防系统', paramKey: '防护区泄压口面积', paramValue: '按IG-541计算', unit: '', reference: 'GB 50370', priority: 3 },
  ];
  for (const c of fireConfigs) {
    const exists = await prisma.industryConfig.findFirst({ where: { industry: c.industry, paramKey: c.paramKey } });
    if (!exists) await prisma.industryConfig.create({ data: c });
  }
  const fireProcess = { processName: '喷淋管道安装与试压', category: '消防', steps: ['管道预制', '支架安装', '管道连接', '喷头安装', '水压试验', '冲洗'], qualityStd: '试验压力1.4倍工作压力，稳压30min无泄漏', acceptance: '末端试水压力≥0.05MPa', safetyNotes: '试压时人员避开管口方向' };
  const fireProcExists = await prisma.processFlow.findFirst({ where: { processName: fireProcess.processName } });
  if (!fireProcExists) await prisma.processFlow.create({ data: fireProcess });
  console.log('  ✅ 消防类速查演示数据就绪');
  const [stdTotal, cfgTotal, procTotal, nodes] = await Promise.all([
    prisma.standard.count(), prisma.industryConfig.count(), prisma.processFlow.count(),
    prisma.industryConfig.groupBy({ by: ['industry'], _count: true }),
  ]);
  console.log(`\n📊 当前总量：标准 ${stdTotal} 条 | 选型参数 ${cfgTotal} 条 | 工艺 ${procTotal} 条`);
  console.log(`📊 覆盖行业 ${nodes.length} 个：${nodes.map((n) => `${n.industry}(${n._count})`).join(' ')}`);
  console.log('🎉 十二大行业种子植入完成！');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
