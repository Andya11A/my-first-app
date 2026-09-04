import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AI_MODELS } from '@/lib/ai-models';
import { buildRagSystemPrompt } from '@/lib/prompts';
import { prisma } from '@/lib/db';
import { autoSaveKnowledge } from '@/lib/auto-save-knowledge';

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
    const { question, modelIds = ['deepseek'], topK = 5 } = body;

    if (!question?.trim()) {
      return NextResponse.json({ success: false, error: '请输入问题' }, { status: 400 });
    }

    // 检索知识库
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { docId: { not: null } },
      include: {
        doc: { select: { title: true, docType: true } },
      },
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: '知识库为空，请先上传文档' },
        { status: 400 }
      );
    }

    // 中文2-4字滑窗关键词提取
    const cleanQ = question.replace(/[？?。，,！!、\s]/g, ' ');
    const tokens = cleanQ.split(' ').filter((k: string) => k.length > 0);
    const keywords = new Set<string>();
    for (const token of tokens) {
      if (/^[a-zA-Z0-9]+$/.test(token)) {
        keywords.add(token.toLowerCase());
        continue;
      }
      for (let n = 2; n <= Math.min(4, token.length); n++) {
        for (let i = 0; i + n <= token.length; i++) {
          keywords.add(token.slice(i, i + n).toLowerCase());
        }
      }
      if (token.length >= 2) keywords.add(token.toLowerCase());
    }

    // 打分检索
    const scored = chunks.map((chunk) => {
      let score = 0;
      const content = chunk.content.toLowerCase();
      const title = (chunk.title ?? '').toLowerCase();
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        score += (content.split(kw).length - 1) * 2;
        score += (title.split(kw).length - 1) * 5;
      }
      return { chunk, score };
    });

    const topChunks = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // 构建上下文
    let context = '';
    const references: { docTitle: string; chunkTitle: string; content: string }[] = [];

    if (topChunks.length > 0) {
      context = topChunks.map((s, i) => {
        const docTitle = s.chunk.doc?.title || '未知文档';
        const chunkTitle = s.chunk.title ?? '';
        references.push({
          docTitle,
          chunkTitle,
          content: s.chunk.content.slice(0, 500),
        });
        return `【参考资料${i + 1}】来源：《${docTitle}》 ${chunkTitle}\n${s.chunk.content.slice(0, 1000)}`;
      }).join('\n\n');
    }

    // 洁净EPC人设 + RAG优先规则（知识库为准/冲突以知识库/空结果如实说明）+ 免责声明要求
    const systemPrompt = buildRagSystemPrompt(context || '', topChunks.length > 0);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    const results = [];

    for (const modelId of modelIds) {
      const modelConfig = AI_MODELS.find((m) => m.id === modelId);
      if (!modelConfig) continue;

      const apiKey = process.env[modelConfig.apiKeyEnv];
      if (!apiKey) {
        results.push({
          modelId,
          modelName: modelConfig.name,
          success: false,
          error: `未配置 ${modelConfig.name} 的 API Key`,
        });
        continue;
      }

      try {
        const response = await fetch(modelConfig.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelConfig.modelName,
            messages,
            temperature: 0.3,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          results.push({
            modelId,
            modelName: modelConfig.name,
            success: false,
            error: `${modelConfig.name} 调用失败`,
          });
          continue;
        }

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || '未获取到回答';
        results.push({
          modelId,
          modelName: modelConfig.name,
          success: true,
          answer,
        });
      } catch {
        results.push({
          modelId,
          modelName: modelConfig.name,
          success: false,
          error: `${modelConfig.name} 调用异常`,
        });
      }
    }

    // 自动沉淀：每个成功模型的回答都整理成知识节点（不阻塞响应）
    for (const r of results) {
      if (r.success && r.answer) {
        autoSaveKnowledge(question, r.answer).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        references: references.map((r) => ({
          docTitle: r.docTitle,
          chunkTitle: r.chunkTitle,
          preview: r.content.slice(0, 200),
        })),
      },
    });
  } catch (error) {
    console.error('RAG问答失败:', error);
    return NextResponse.json({ success: false, error: 'RAG问答失败' }, { status: 500 });
  }
}
