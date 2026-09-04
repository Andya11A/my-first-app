// 工程知识体系种子数据：标准库 + 行业选型参数 + 十级坐标节点 + 施工工艺
// 运行：npx tsx prisma/seed-engineering.ts（幂等，可重复运行）
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// Prisma 7 需要 driver adapter 连接 SQLite（dev.db 位于项目根目录）
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 植入工程知识体系种子数据...');

  // ---- 1. 标准库（电池行业为主，专项优先） ----
  const standards = [
    { code: 'GB 50073-2013', name: '洁净厂房设计规范', type: '主要', priority: 3, industry: '电子,电池,医药', scope: '洁净厂房总体设计', status: '现行', keywords: '洁净室,压差,温湿度' },
    { code: 'GB 50457-2019', name: '医药工业洁净厂房设计标准', type: '主要', priority: 3, industry: '医药,电池', scope: '医药及类似洁净生产', status: '现行', keywords: 'GMP,洁净,无菌' },
    // 行业专项（电池专属，优先级最高）
    { code: 'GB/T 36280-2018', name: '锂离子电池生产洁净室技术规范', type: '行业专项', priority: 5, industry: '电池', scope: '锂电池生产环境控制', status: '现行', keywords: '锂电池,电极,涂布,注液' },
    { code: 'SJ/T 10694-2006', name: '电子产品制造防静电系统测试方法', type: '行业专项', priority: 4, industry: '电池,电子', scope: '防静电接地与测试', status: '现行', keywords: 'ESD,静电,接地' },
    { code: 'GB 50591-2010', name: '洁净室施工及验收规范', type: '配套', priority: 2, industry: '通用', scope: '施工与验收', status: '现行', keywords: '施工,验收,调试' },
    { code: 'GB/T 16292-2010', name: '医药工业洁净室（区）悬浮粒子的测试方法', type: '配套', priority: 2, industry: '通用', scope: '粒子检测', status: '现行', keywords: '悬浮粒子,尘埃,计数器' },
    { code: 'ISO 14644-1:2015', name: '洁净室及相关受控环境 第1部分：空气洁净度分级', type: '配套', priority: 2, industry: '通用', scope: '洁净度分级', status: '现行', keywords: 'ISO等级,洁净度' },
  ];

  for (const s of standards) {
    await prisma.standard.upsert({ where: { code: s.code }, update: {}, create: s });
  }
  console.log(`  ✅ 植入 ${standards.length} 条标准`);

  // ---- 2. 行业选型参数（电池/数据中心/动物实验室/纳米材料） ----
  const configs = [
    // 电池行业
    { industry: '电池制造', systemCategory: '洁净度', paramKey: '颗粒度（≥0.5μm）', paramValue: '≤3520', unit: '粒/m³', reference: 'GB/T 36280', priority: 5 },
    { industry: '电池制造', systemCategory: '环境控制', paramKey: '露点温度', paramValue: '≤-40', unit: '℃', reference: 'GB/T 36280', priority: 5 },
    { industry: '电池制造', systemCategory: '暖通空调', paramKey: '换气次数', paramValue: '≥25', unit: '次/h', reference: 'GB 50073', priority: 4 },
    { industry: '电池制造', systemCategory: '静电防护', paramKey: '接地电阻', paramValue: '≤1', unit: 'Ω', reference: 'SJ/T 10694', priority: 5 },
    // 数据中心
    { industry: '数据中心/IDC', systemCategory: '暖通空调', paramKey: 'PUE优化目标', paramValue: '≤1.3', unit: '', reference: 'GB 50174', priority: 5 },
    { industry: '数据中心/IDC', systemCategory: '电气系统', paramKey: 'UPS冗余', paramValue: '2N', unit: '', reference: 'TIA-942', priority: 5 },
    { industry: '数据中心/IDC', systemCategory: '环境控制', paramKey: '温度设定', paramValue: '18~27', unit: '℃', reference: 'ASHRAE', priority: 4 },
    // 动物实验室（SPF级）
    { industry: '动物实验室（SPF级）', systemCategory: '屏障环境', paramKey: '压差梯度', paramValue: '≥50', unit: 'Pa', reference: 'GB 14925', priority: 5 },
    { industry: '动物实验室（SPF级）', systemCategory: '关键设备', paramKey: 'IVC笼具换气次数', paramValue: '≥60', unit: '次/h', reference: 'GB 14925', priority: 5 },
    // 纳米材料/新材料
    { industry: '纳米材料/新材料', systemCategory: '洁净度', paramKey: 'ISO等级', paramValue: 'ISO 3', unit: '', reference: 'ISO 14644-1', priority: 5 },
    { industry: '纳米材料/新材料', systemCategory: '环境控制', paramKey: 'AMC浓度', paramValue: '≤0.1', unit: 'μg/m³', reference: 'SEMI F21', priority: 5 },
  ];

  const configCount = await prisma.industryConfig.count();
  if (configCount === 0) {
    await prisma.industryConfig.createMany({ data: configs });
    console.log(`  ✅ 植入 ${configs.length} 条行业选型参数`);
  } else {
    console.log(`  ⏭️ 行业选型参数已存在 ${configCount} 条，跳过`);
  }

  // ---- 3. 十级坐标 + 联动矩阵（存入知识节点，parameters 存十级、crossLinks 存矩阵） ----
  const layers = [
    '一级：行业定位', '二级：系统架构', '三级：节点形态', '四级：环境维度',
    '五级：材料构造', '六级：验收指标', '七级：运维周期', '八级：成本维度',
    '九级：合规认证', '十级：风险管控',
  ];

  const matrix = [
    { from: '环境维度', to: '材料构造', impact: '温湿度/洁净度直接影响彩钢板、环氧地坪选型与寿命' },
    { from: '材料构造', to: '验收指标', impact: '材料参数决定验收时的强度、气密性、防火等级' },
    { from: '验收指标', to: '合规认证', impact: '验收数据是认证（GMP/ISO）的必要证据链' },
    { from: '成本维度', to: '风险管控', impact: '低价选材增加后期故障停线风险，需平衡LCC' },
    { from: '运维周期', to: '风险管控', impact: '运维频次决定设备老化速度，影响突发故障概率' },
    { from: '行业定位', to: '系统架构', impact: '不同行业（电池/医药）决定暖通、电气冗余等级' },
    { from: '系统架构', to: '节点形态', impact: '系统形式（全空气/风机盘管）决定末端设备布置' },
    { from: '合规认证', to: '运维周期', impact: '认证要求（年度检测）反推运维计划必须覆盖' },
  ];

  await prisma.knowledgeNode.upsert({
    where: { nodeCode: 'ENG-CORE-2026' },
    update: {
      parameters: JSON.stringify(layers.map((l, i) => ({ index: i + 1, layer: l }))),
      crossLinks: JSON.stringify(matrix),
    },
    create: {
      nodeCode: 'ENG-CORE-2026',
      industry: '通用',
      facilityType: '全形态',
      environment: 'N/A',
      title: '工程核心标准体系速查表（十级坐标）',
      summary: 'L0：涵盖电池/数据中心/动物实验室/纳米材料的核心标准、专项规范与配套体系，十级坐标联动矩阵',
      regulations: JSON.stringify([]),
      chapters: JSON.stringify([]),
      clauses: '包含GB/T 36280-2018电池专项、GB 50073通用设计、ISO 14644配套检测',
      parameters: JSON.stringify(layers.map((l, i) => ({ index: i + 1, layer: l }))),
      logic: `联动关系：${matrix.map((m) => `${m.from}→${m.to}：${m.impact}`).join('；')}`,
      crossLinks: JSON.stringify(matrix),
      lifecycle: JSON.stringify([{ stage: '标准体系', note: '2026-09-04 初始化' }]),
      status: 'verified',
      source: 'system',
    },
  });
  console.log('  ✅ 植入十级坐标 + 联动矩阵（ENG-CORE-2026）');

  // ---- 4. 施工工艺（电池车间典型工序） ----
  const processes = [
    { processName: '彩钢板气密隔断安装', category: '装饰', steps: JSON.stringify(['弹线定位→安装天龙骨→安装地龙骨→竖龙骨→彩钢板嵌缝→密封胶打胶']), qualityStd: '垂直度≤2mm/2m，拼接缝≤1mm', acceptance: '压差测试≥50Pa不漏风', safetyNotes: '高空作业必须系安全带，切割时佩戴护目镜' },
    { processName: '电极涂布车间空调风管制作', category: '暖通', steps: JSON.stringify(['放样下料→咬口或焊接→法兰连接→吊架安装→漏光试验']), qualityStd: '漏光≤1处/10m，法兰平面度≤3mm', acceptance: '漏风量≤2%', safetyNotes: '咬口机操作严禁戴手套' },
    { processName: '防静电环氧地坪施工', category: '地面', steps: JSON.stringify(['基层打磨→底涂→导电层（铜箔网格）→中涂→面涂→养护']), qualityStd: '电阻≤1×10^9Ω，表面平整度≤2mm/2m', acceptance: '表面电阻测试合格', safetyNotes: '施工环境温湿度控制在10~30℃/≤80%' },
    { processName: 'FFU安装与送风测试', category: '暖通', steps: JSON.stringify(['龙骨安装→FFU定位→紧固→电气接线→调试风速']), qualityStd: '风速0.45±10%m/s，噪声≤50dB(A)', acceptance: '风速均匀度≤15%', safetyNotes: '接线前必须断电，锁死开关' },
  ];

  const processCount = await prisma.processFlow.count();
  if (processCount === 0) {
    await prisma.processFlow.createMany({ data: processes });
    console.log(`  ✅ 植入 ${processes.length} 条施工工艺`);
  } else {
    console.log(`  ⏭️ 施工工艺已存在 ${processCount} 条，跳过`);
  }

  console.log('🎉 工程种子数据植入完成！');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
