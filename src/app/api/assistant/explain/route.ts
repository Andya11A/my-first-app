import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AI_MODELS } from '@/lib/ai-models';
import { prisma } from '@/lib/db';

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
    const { selectedText, docId, modelId = 'deepseek' } = body;

    if (!selectedText?.trim()) {
      return NextResponse.json({ success: false, error: '请先选择文字' }, { status: 400 });
    }

    // 1. 定位条款：在文档中找选中文字的准确位置
    let locationInfo = '';
    let currentDocTitle = '';

    if (docId) {
      const currentDoc = await prisma.knowledgeDoc.findUnique({
        where: { id: Number(docId) },
      });
      if (currentDoc) {
        currentDocTitle = currentDoc.title;
        const chunks = await prisma.knowledgeChunk.findMany({
          where: { docId: Number(docId) },
          orderBy: { seq: 'asc' },
        });

        // 找到包含选中文字的片段
        for (const chunk of chunks) {
          if (chunk.content.includes(String(selectedText).trim())) {
            locationInfo = `该内容位于《${currentDoc.title}》${chunk.title ?? '正文'}（片段${chunk.seq + 1}/${chunks.length}）`;
            break;
          }
        }
        if (!locationInfo) {
          locationInfo = `该内容来自《${currentDoc.title}》，未能精确定位具体条款（可能是OCR识别偏差）`;
        }
      }
    }

    // 2. 搜索知识库所有文档
    const allChunks = await prisma.knowledgeChunk.findMany({
      where: { docId: { not: null } },
      include: { doc: { select: { title: true } } },
    });

    const cleanQ = String(selectedText).replace(/[？?。，,！!、\s]/g, ' ');
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

    const scored = allChunks.map((chunk) => {
      let score = 0;
      const content = chunk.content.toLowerCase();
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        score += (content.split(kw).length - 1) * 2;
      }
      return { chunk, score };
    });

    const relatedChunks = scored
      .filter((s) => s.score > 0 && s.chunk.docId !== Number(docId))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // 3. 构建给AI的上下文
    let relatedContext = '';
    if (relatedChunks.length > 0) {
      relatedContext = relatedChunks.map((s, i) => `【关联资料${i + 1}】《${s.chunk.doc?.title ?? '未知文档'}》${s.chunk.title ?? '正文'}\n${s.chunk.content.slice(0, 1000)}`).join('\n\n');
    }

    const modelConfig = AI_MODELS.find((m) => m.id === modelId);
    if (!modelConfig) {
      return NextResponse.json({ success: false, error: '不支持的模型' }, { status: 400 });
    }

    const apiKey = process.env[modelConfig.apiKeyEnv];
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `未配置 ${modelConfig.name} 的 API Key` },
        { status: 500 }
      );
    }

    const systemPrompt = `你是一位资深实验室工程专家，擅长解读标准和规范。

用户正在阅读《${currentDocTitle || '文档'}》，对以下内容有疑问，请提供专业解读。

要求（按以下结构输出）：

【条款定位】
${locationInfo || '（未能定位）'}

【详细解释】
用通俗语言详细解释这个内容：
1. 什么意思
2. 为什么这样要求
3. 实际工程中怎么应用
4. 常见误区或注意事项

【关联规范】
推荐可能相关的其他规范或标准（如果有）

${relatedContext ? '知识库中相关参考内容：\n' + relatedContext : '（知识库中暂无其他相关内容）'}

请基于以上信息，给出专业、详细、实用的解读。`;

    const response = await fetch(modelConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请解读以下内容：${selectedText}` },
        ],
        temperature: 0.3,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`${modelConfig.name} API 错误:`, errorData.slice(0, 300));
      return NextResponse.json(
        { success: false, error: `${modelConfig.name} 调用失败` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content || '未获取到解释';

    return NextResponse.json({
      success: true,
      data: {
        explanation,
        location: locationInfo || null,
        relatedDocs: relatedChunks.map((s) => ({
          docTitle: s.chunk.doc?.title ?? '未知文档',
          chunkTitle: s.chunk.title ?? '正文',
          preview: s.chunk.content.slice(0, 300),
        })),
      },
    });
  } catch (error) {
    console.error('深度解释失败:', error);
    return NextResponse.json({ success: false, error: '深度解释失败' }, { status: 500 });
  }
}
