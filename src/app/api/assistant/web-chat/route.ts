import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AI_MODELS } from '@/lib/ai-models';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { autoSaveKnowledge } from '@/lib/auto-save-knowledge';

// 联网模式问答：
// ① 通义千问开启 enable_search 先联网搜索并回答
// ② 把联网结果（通义回答 + 搜索来源）作为参考上下文
// ③ 并发给 DeepSeek、GLM，让两者基于最新信息回答
// ④ 三个回答并列返回（通义=联网搜索，DeepSeek/GLM=参考联网）

interface SearchResult {
  site_name?: string;
  title?: string;
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权使用' }, { status: 403 });
    }

    const body = await request.json();
    const { question, history = [] } = body;

    if (!question?.trim()) {
      return NextResponse.json({ success: false, error: '请输入问题' }, { status: 400 });
    }

    const qwen = AI_MODELS.find((m) => m.id === 'qwen');
    const deepseek = AI_MODELS.find((m) => m.id === 'deepseek');
    const glm = AI_MODELS.find((m) => m.id === 'glm');
    if (!qwen || !deepseek || !glm) {
      return NextResponse.json({ success: false, error: '模型配置缺失' }, { status: 500 });
    }

    const missingKey = [qwen, deepseek, glm].find((m) => !process.env[m.apiKeyEnv]);
    if (missingKey) {
      return NextResponse.json(
        { success: false, error: `未配置 ${missingKey.name} 的 API Key` },
        { status: 500 }
      );
    }

    const recentHistory = history
      .slice(-6)
      .filter((h: { role: string; content: string }) => h.role === 'user' || h.role === 'assistant')
      .map((h: { role: string; content: string }) => ({ role: h.role, content: h.content }));

    // ① 通义千问联网搜索（DashScope compatible-mode：enable_search=true 返回 search_results）
    const qwenRes = await fetch(qwen.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env[qwen.apiKeyEnv]}`,
      },
      body: JSON.stringify({
        model: qwen.modelName,
        messages: [
          {
            role: 'system',
            content:
              '你是实验室工程专家。请先联网搜索用户问题的最新资料，再基于搜索结果回答。回答末尾用「参考来源：」列出信息来源。不要输出markdown代码块以外的多余说明。',
          },
          ...recentHistory,
          { role: 'user', content: question },
        ],
        enable_search: true,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!qwenRes.ok) {
      const errText = await qwenRes.text();
      console.error('通义千问联网搜索失败:', errText);
      return NextResponse.json(
        { success: false, error: '通义千问联网搜索失败，请检查 Key 或稍后重试' },
        { status: 500 }
      );
    }

    const qwenData = await qwenRes.json();
    const qwenAnswer: string = qwenData.choices?.[0]?.message?.content || '';
    const searchResults: SearchResult[] = qwenData.choices?.[0]?.message?.search_results || [];

    // ② 组装联网参考上下文：通义回答 + 原始搜索来源
    const sourceList = searchResults
      .map((s, i) => `[${i + 1}] ${s.title || ''}（${s.site_name || ''}）${s.url || ''}`)
      .join('\n');
    const refText = [
      '【联网搜索参考资料（由通义千问实时搜索获取，可能比你的训练数据更新）】',
      qwenAnswer,
      sourceList ? `\n【搜索来源列表】\n${sourceList}` : '',
    ].join('\n');

    // ③ 并发给 DeepSeek / GLM，基于联网资料回答
    const refSystemPrompt =
      SYSTEM_PROMPT +
      '\n\n当前对话开启了联网模式：用户消息中附有通过联网搜索获取的最新参考资料。请优先依据参考资料回答；如资料与你的知识冲突，以资料为准并简要说明；资料未覆盖的部分结合你的专业知识补充，并注明哪些内容来自资料、哪些是你的补充。';

    const callWithRef = async (config: { id: string; name: string; apiUrl: string; modelName: string; apiKeyEnv: string }) => {
      try {
        const res = await fetch(config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env[config.apiKeyEnv]}`,
          },
          body: JSON.stringify({
            model: config.modelName,
            messages: [
              { role: 'system', content: refSystemPrompt },
              ...recentHistory,
              { role: 'user', content: `${refText}\n\n【用户问题】${question}` },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });
        if (!res.ok) {
          console.error(`${config.name} 联网参考问答失败:`, await res.text());
          return { modelId: config.id, modelName: config.name, success: false, error: `${config.name} 调用失败` };
        }
        const data = await res.json();
        const answer = data.choices?.[0]?.message?.content || '';
        if (!answer) {
          return { modelId: config.id, modelName: config.name, success: false, error: `${config.name} 未返回内容` };
        }
        return { modelId: config.id, modelName: config.name, success: true, answer };
      } catch {
        return { modelId: config.id, modelName: config.name, success: false, error: `${config.name} 网络异常` };
      }
    };

    const [deepseekResult, glmResult] = await Promise.all([
      callWithRef(deepseek),
      callWithRef(glm),
    ]);

    const results = [
      { modelId: 'qwen', modelName: '通义千问（联网搜索）', success: true, answer: qwenAnswer },
      deepseekResult,
      glmResult,
    ];

    // 自动沉淀：每个成功模型的回答都整理成知识节点（不阻塞响应）
    for (const r of results) {
      if (r.success && r.answer) {
        autoSaveKnowledge(question, r.answer).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        searchResults: searchResults.map((s) => ({
          title: s.title || '',
          siteName: s.site_name || '',
          url: s.url || '',
        })),
        results,
      },
    });
  } catch (error) {
    console.error('联网问答失败:', error);
    return NextResponse.json({ success: false, error: '联网问答失败' }, { status: 500 });
  }
}
