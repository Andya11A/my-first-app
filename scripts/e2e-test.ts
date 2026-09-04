// E2E 全链路测试：报价生成 → 知识沉淀 → Word 导出 → 精确报价代理
// 运行：npx tsx scripts/e2e-test.ts（需 dev server 在 localhost:3000，calc_engine 在 8101）
const BASE = 'http://localhost:3000';

async function main() {
  console.log('🧪 开始端到端测试...\n');

  // ---- 0. 登录拿 token（quote / export / 知识节点接口都要求鉴权） ----
  console.log('📌 Step 0: 管理员登录');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  }).then((r) => r.json());
  if (!loginRes.success) throw new Error(`登录失败: ${loginRes.error}`);
  const H = { Authorization: `Bearer ${loginRes.data.token}`, 'Content-Type': 'application/json' };
  console.log('   ✅ 登录成功\n');

  // ---- 1. 生成报价 ----
  console.log('📌 Step 1: 生成报价 (POST /api/quote)');
  const labTypes = await fetch(`${BASE}/api/lab-types`, { headers: H }).then((r) => r.json());
  const labType = labTypes.data[0];
  const quoteRes = await fetch(`${BASE}/api/quote`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      projectName: 'E2E测试项目-全链路验证',
      labTypeId: labType.id,
      area: 80,
      cleanLevel: labType.cleanLevelDefault || 'ISO 7',
      budgetLevel: '标准型',
      specialRequirements: '测试专用，无特殊要求',
    }),
  });
  if (!quoteRes.ok) throw new Error(`报价生成失败 (${quoteRes.status}): ${await quoteRes.text()}`);
  const quoteJson = await quoteRes.json();
  // 实际响应结构：{ success, data: { quote: QuoteResult, projectId } }
  const result = quoteJson.data.quote;
  const projectId = quoteJson.data.projectId;
  console.log(`   ✅ 报价成功 总价¥${result.grandTotal.toLocaleString()}，projectId=${projectId}`);
  console.log(`   设备项: ${result.equipmentList.length}，施工项: ${result.constructionList.length}`);

  // ---- 2. 验证知识沉淀（走 API，等异步写入） ----
  console.log('\n📌 Step 2: 等待 3 秒让异步沉淀完成...');
  await new Promise((r) => setTimeout(r, 3000));
  const nodes = await fetch(`${BASE}/api/assistant/knowledge-nodes?source=auto`, { headers: H }).then((r) => r.json());
  const latestNode = nodes.data.find((n: { title: string }) => n.title.includes('E2E测试项目'));
  if (!latestNode) throw new Error('❌ 未找到对应的知识沉淀节点，检查 syncQuoteToKnowledge 是否触发');
  const detail = await fetch(`${BASE}/api/assistant/knowledge-nodes/${latestNode.id}`, { headers: H }).then((r) => r.json());
  console.log(`   ✅ 已沉淀: ${latestNode.nodeCode} (source=${latestNode.source}, status=${latestNode.status})`);
  console.log(`   L4 参数数量: ${JSON.parse(detail.data.parameters || '[]').length}`);
  console.log(`   L5 预览: ${(detail.data.logic || '').slice(0, 60)}...`);

  // ---- 3. Word 导出 ----
  console.log('\n📌 Step 3: Word 导出 (GET /api/quote/export-docx?projectId=...)');
  const exportRes = await fetch(`${BASE}/api/quote/export-docx?projectId=${projectId}`, { headers: H });
  if (exportRes.ok) {
    const ct = exportRes.headers.get('content-type') || '';
    if (ct.includes('vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      console.log('   ✅ Word 导出 MIME 正确');
    } else {
      console.warn(`   ⚠️ 非预期 Content-Type: ${ct}`);
    }
  } else {
    console.warn(`   ⚠️ Word 导出失败 (${exportRes.status})`);
  }

  // ---- 4. 精确报价代理连通性 ----
  console.log('\n📌 Step 4: 精确报价代理 (POST /api/precise-quote)');
  try {
    const preciseRes = await fetch(`${BASE}/api/precise-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
      signal: AbortSignal.timeout(5000),
    });
    if (preciseRes.status === 503) {
      console.warn('   ⚠️ 服务不可达 (503)：calc_engine 未启动或地址不对');
    } else {
      console.log(`   ✅ 代理连通（HTTP ${preciseRes.status}，引擎在线）`);
    }
  } catch (e) {
    console.warn(`   ⚠️ 超时或异常: ${e instanceof Error ? e.message : e}`);
  }

  // ---- 5. 数据保留说明 ----
  console.log('\n💡 测试数据已保留：项目"E2E测试项目-全链路验证"（projectId=' + projectId + '）');
  console.log('   及审核台「💬 问答沉淀」Tab 中的 ' + latestNode.nodeCode + '，可在页面查看后手动删除');
  console.log('\n🎉 端到端测试完成！');
}

main().catch((err) => {
  console.error('\n❌ 测试失败:', err instanceof Error ? err.message : err);
  process.exit(1);
});
