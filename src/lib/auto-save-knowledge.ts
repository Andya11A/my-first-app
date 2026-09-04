import { AI_MODELS } from '@/lib/ai-models';
import { prisma } from '@/lib/db';

// 问答自动沉淀：把问答整理成七层知识节点（source=auto，draft状态），失败不影响主流程
// 三种模式共用：普通问答(chat) / 知识库问答(rag-chat) / 联网模式(web-chat)
export async function autoSaveKnowledge(question: string, answer: string) {
  try {
    const ds = AI_MODELS.find((m) => m.id === 'deepseek');
    if (!ds) return;
    const dsKey = process.env[ds.apiKeyEnv];
    if (!dsKey) return;

    const extractPrompt = `你是实验室工程知识库整理助手。请把下面的问答整理成知识节点的七层结构，严格输出JSON（不要markdown代码块）：

{
  "summary": "L0坐标确认：一句话说明这个知识回答的核心问题",
  "regulations": [{"standardNo":"标准号","name":"标准名称","versionStatus":"现行/需核实/已废止，拿不准写需核实"}],
  "chapters": [],
  "clauses": "L3条文内容：如果回答里有具体条文，写出来；没有就写'暂无具体条文，需人工补充'",
  "parameters": [{"name":"参数名","value":"数值","note":"依据或备注，拿不准写需核实"}],
  "logic": "L5工艺逻辑：把回答里的原理、为什么这么做讲清楚",
  "crossLinks": [],
  "lifecycle": []
}

规则：拿不准的规范版本标"需核实"，拿不准的条文标"原文待核"，禁止编造具体条号。

问题：${question}

回答：${answer}`;

    const res = await fetch(ds.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dsKey}`,
      },
      body: JSON.stringify({
        model: ds.modelName,
        messages: [
          { role: 'system', content: '你是知识库整理助手，只输出JSON。' },
          { role: 'user', content: extractPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) return;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return;
      try { parsed = JSON.parse(match[0]); } catch { return; }
    }

    const nodeCode = `KN-AUTO-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    await prisma.knowledgeNode.create({
      data: {
        nodeCode,
        industry: '通用',
        facilityType: '全形态',
        environment: '待分类',
        title: question.slice(0, 40),
        summary: parsed.summary || '',
        regulations: JSON.stringify(parsed.regulations || []),
        chapters: JSON.stringify(parsed.chapters || []),
        clauses: parsed.clauses || '',
        parameters: JSON.stringify(parsed.parameters || []),
        logic: parsed.logic || answer.slice(0, 500),
        crossLinks: JSON.stringify(parsed.crossLinks || []),
        lifecycle: JSON.stringify(parsed.lifecycle || []),
        status: 'draft',
        source: 'auto',
      },
    });

    console.log(`[autoSave] 已沉淀: ${nodeCode}`);
  } catch {
    console.log('[autoSave] 沉淀失败（不影响主流程）');
  }
}
