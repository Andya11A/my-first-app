import { generateQuote } from '../src/lib/calculator';

async function main() {
  // 用例1：PCR实验室 150㎡ 标准型
  const r1 = await generateQuote({
    projectName: '测试项目A',
    labTypeId: 1,
    area: 150,
    cleanLevel: '十万级',
    budgetLevel: '标准型',
  });
  console.log('--- 用例1: PCR 150㎡ 标准型 ---');
  console.log('设备项数:', r1.equipmentList.length, '设备合计(含选配):', r1.equipmentTotal);
  console.log('工程项数:', r1.constructionList.length, '工程合计:', r1.constructionTotal);
  console.log('分类汇总:', r1.constructionByCategory);
  console.log('管理费:', r1.managementFee, '利润:', r1.profit, '总价:', r1.grandTotal);

  // 一致性检查
  const eqSum = r1.equipmentList.reduce((s, e) => s + e.subtotal, 0);
  const conSum = r1.constructionList.reduce((s, c) => s + c.subtotal, 0);
  const catSum = r1.constructionByCategory.reduce((s, c) => s + c.subtotal, 0);
  const grandSum = r1.equipmentTotal + r1.constructionTotal + r1.managementFee + r1.profit;
  console.log(
    '一致性-设备合计:',
    eqSum === r1.equipmentTotal,
    '| 工程合计:',
    conSum === r1.constructionTotal,
    '| 分类汇总=工程合计:',
    catSum === r1.constructionTotal,
    '| 总价分解:',
    grandSum === r1.grandTotal
  );

  // 手工核对关键数字（新规则）
  // 生物安全柜: required, round(1.5×1)=2 × 45000 = 90000
  const bsc = r1.equipmentList.find((e) => e.equipmentName === '生物安全柜');
  console.log('核对-生物安全柜:', bsc?.quantity, '×', bsc?.unitPrice, '=', bsc?.subtotal, '(期望 2×45000=90000)');
  // 彩钢板隔断: 2.8×150=420㎡ × 260 = 109200
  const wall = r1.constructionList.find((c) => c.itemName === '彩钢板隔断');
  console.log('核对-彩钢板隔断:', wall?.quantity, '×', wall?.unitPrice, '=', wall?.subtotal, '(期望 420×260=109200)');
  // 净化空调机组: 0.01×150=1.5（保留2位，不取整）× 180000 = 270000
  const ahu = r1.constructionList.find((c) => c.itemName === '净化空调机组');
  console.log('核对-净化空调机组:', ahu?.quantity, '×', ahu?.unitPrice, '=', ahu?.subtotal, '(期望 1.5×180000=270000)');

  // 档位对比的主档位数字应与主结果一致
  const stdCmp = r1.quoteComparison.find((c) => c.levelName === '标准型');
  console.log(
    '一致性-对比表主档位:',
    stdCmp?.equipmentTotal === r1.equipmentTotal &&
      stdCmp?.constructionTotal === r1.constructionTotal &&
      stdCmp?.grandTotal === r1.grandTotal
  );

  // 用例2：理化实验室 80㎡ 经济型
  const r2 = await generateQuote({
    projectName: '测试项目B',
    labTypeId: 2,
    area: 80,
    cleanLevel: '普通',
    budgetLevel: '经济型',
  });
  console.log('--- 用例2: 理化 80㎡ 经济型 ---');
  console.log('设备合计:', r2.equipmentTotal, '工程合计:', r2.constructionTotal, '总价:', r2.grandTotal);
  console.log('对比表:', r2.quoteComparison.map((c) => `${c.levelName}=${c.grandTotal}`).join(' | '));

  // 用例3：不存在的档位 → 应直接报错
  try {
    await generateQuote({
      projectName: '测试项目C',
      labTypeId: 4,
      area: 100,
      cleanLevel: '普通',
      budgetLevel: '不存在的档位',
    });
    console.log('--- 用例3: 失败（未按预期抛错） ---');
    process.exitCode = 1;
  } catch (e) {
    console.log('--- 用例3: 按预期抛错 ---');
    console.log('错误信息:', e instanceof Error ? e.message : e);
  }

  // 格式化函数抽查
  const { formatCurrency, formatNumber } = await import('../src/lib/calculator');
  console.log('格式化:', formatCurrency(1955246), formatNumber(1.5), formatNumber(420, 0));
}

main()
  .catch((e) => {
    console.error('验证失败:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
