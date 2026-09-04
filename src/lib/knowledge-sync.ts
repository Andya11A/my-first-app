import { prisma } from './db';
import type { QuoteResult } from './types';

// 报价快照自动沉淀：把 QuoteResult 映射为七层知识节点（source=auto，review 状态待审核台确认）
// 注意：KnowledgeNode 七层字段均为 TEXT，JSON 数组需 stringify；nodeCode/industry/facilityType/environment 必填
export async function syncQuoteToKnowledge(result: QuoteResult, projectId?: number) {
  const date = new Date().toISOString().slice(0, 10);
  const money = (n: number) => `¥${n.toLocaleString('zh-CN')}`;

  // ---- 1. L4 参数层（15+ 项） ----
  // 设备按名称关键词归类（启发式：模板名含关键词即归入对应专业；未命中归入工艺设备）
  // 词表依据 dev.db EquipmentTemplate 实际名称整理
  const equipmentCategories: Record<string, string[]> = {
    暖通: ['净化空调', '新风机组', '排风机', '风阀', '散流器', 'FFU', '高效送风口', '风淋室', '过滤器', '精密空调', '除湿机'],
    电气: ['配电箱', '电源控制箱', '照明', '灯具', '紫外灯', '插座', '稳压电源', '离子风机'],
    给排水: ['纯水机', '蒸馏水器', '洗眼器', '给水管', '排水管', '地漏'],
    自控: ['传感器', '控制器', '温湿度巡检仪', '压差'],
    工艺设备: ['生物安全柜', '通风柜', '培养箱', '灭菌器', '冰箱', 'PCR', '显微镜', '离心机', '天平', '实验台', '工作台', '传递窗', '色谱', '光度计', '摇床', '振荡器', '提取仪', '干燥箱', '试剂柜', '器皿柜', '液氮罐'],
  };

  const categorizedEquipment = result.equipmentList.map((eq) => {
    let cat = '工艺设备';
    for (const [key, keywords] of Object.entries(equipmentCategories)) {
      if (keywords.some((kw) => eq.equipmentName.includes(kw))) {
        cat = key;
        break;
      }
    }
    return { ...eq, category: cat };
  });

  const equipSummary =
    Object.entries(
      categorizedEquipment.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.subtotal;
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([cat, total]) => `${cat}${money(total)}`)
      .join('；') || '无明细';

  // 施工按已有 category 汇总
  const constrSummary =
    result.constructionByCategory
      .map((c) => `${c.category}${money(c.subtotal)}`)
      .join('；') || '无明细';

  const parameters = [
    // 基础参数
    { name: '项目名称', value: result.projectName, note: '' },
    { name: '实验室类型', value: result.labTypeName, note: '快照' },
    { name: '建筑面积', value: `${result.area}㎡`, note: '' },
    { name: '洁净等级', value: result.cleanLevel, note: '' },
    { name: '预算档位', value: result.budgetLevel, note: '' },
    { name: '压差要求', value: result.labTypeParams.pressureRequirement, note: '设计参数' },
    { name: '温湿度要求', value: result.labTypeParams.tempHumidity, note: '设计参数' },
    { name: '换气次数', value: `${result.labTypeParams.airChangesPerHour} 次/h`, note: '设计参数' },
    { name: '照度', value: `${result.labTypeParams.illuminationLux} lux`, note: '设计参数' },
    // 成本结构
    { name: '设备费合计', value: money(result.equipmentTotal), note: `占比 ${((result.equipmentTotal / result.grandTotal) * 100).toFixed(1)}%` },
    { name: '工程量费合计', value: money(result.constructionTotal), note: `占比 ${((result.constructionTotal / result.grandTotal) * 100).toFixed(1)}%` },
    { name: '管理费', value: money(result.managementFee), note: '按(设备+施工)×费率' },
    { name: '利润', value: money(result.profit), note: '按(基数+管理费)×利润率' },
    { name: '总报价', value: money(result.grandTotal), note: '含管理费与利润' },
    // 分类构成
    { name: '设备分类构成', value: equipSummary, note: '按设备名称自动归类' },
    { name: '施工分类构成', value: constrSummary, note: '来自施工因子 category' },
  ];

  // ---- 2. L5 逻辑层（计价规则 + 成本合理性建议） ----
  const equipmentPct = ((result.equipmentTotal / result.grandTotal) * 100).toFixed(1);
  const constructionPct = ((result.constructionTotal / result.grandTotal) * 100).toFixed(1);
  const logic = [
    `报价快照沉淀：由基础引擎生成（设备：面积/100 × 模板数量 × 档位乘数；施工：面积 × 因子 × 档位乘数）。`,
    `设备占比 ${equipmentPct}%，施工占比 ${constructionPct}%。`,
    `三档对比：${result.quoteComparison.map((q) => `${q.levelName}${money(q.grandTotal)}`).join(' / ')}。`,
    `设备分类构成：${equipSummary}。`,
    `成本建议：${result.budgetLevel}档位下，${result.equipmentTotal > result.constructionTotal ? '设备投入偏高，可适当优化选型（复核必选项与数量）' : '施工投入偏高，可优化工序或材料档次'}。`,
  ].join('\n');

  // ---- 3. 写入知识节点 ----
  await prisma.knowledgeNode.create({
    data: {
      nodeCode: `KN-QUOTE-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      industry: '通用',
      facilityType: '全形态',
      environment: result.cleanLevel,
      title: `报价-${result.projectName}-${date}`,
      // L0 坐标确认
      summary: `${result.projectName} 报价方案快照：${result.labTypeName}，${result.area}㎡，${result.budgetLevel}档，总报价${money(result.grandTotal)}。`,
      // L1 规范清单（快照无规范引用，留空待审核补充）
      regulations: JSON.stringify([]),
      // L2 章节定位
      chapters: JSON.stringify([]),
      // L3 条文内容（此处存快照来源说明，非规范条文）
      clauses: `快照来源：项目报价单（projectId=${projectId ?? '未入库'}），生成于 ${new Date(result.generatedAt).toLocaleString()}。设备清单 ${result.equipmentList.length} 项，工程量 ${result.constructionList.length} 项。⚠️原文待核：本节点为报价快照，非规范条文，不作为计价依据。`,
      // L4 设计参数（15+ 项）
      parameters: JSON.stringify(parameters),
      // L5 工艺逻辑（计价口径 + 成本建议）
      logic,
      crossLinks: JSON.stringify([]),
      lifecycle: JSON.stringify([{ stage: '报价阶段', note: `档位：${result.budgetLevel}，生成时间：${new Date(result.generatedAt).toISOString()}` }]),
      status: 'review',
      source: 'auto',
    },
  });

  console.log(`[knowledge-sync] 报价快照已沉淀: ${result.projectName}`);
}
