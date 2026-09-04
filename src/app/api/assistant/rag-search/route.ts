import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
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
    const { question, topK = 5 } = body;

    if (!question?.trim()) {
      return NextResponse.json({ success: false, error: '请输入问题' }, { status: 400 });
    }

    // 获取所有知识片段
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { docId: { not: null } },
      include: {
        doc: {
          select: { title: true, docType: true },
        },
      },
    });

    // 关键词匹配打分（中文做 2~4 字滑窗补充，提升召回）
    const cleanQ = question.replace(/[？?。，,！!、\s]/g, ' ');
    const tokens = cleanQ.split(' ').filter((k: string) => k.length > 0);
    const keywordSet = new Set<string>();
    for (const token of tokens) {
      if (/^[a-zA-Z0-9]+$/.test(token)) {
        keywordSet.add(token.toLowerCase());
        continue;
      }
      for (let n = 2; n <= Math.min(4, token.length); n++) {
        for (let i = 0; i + n <= token.length; i++) {
          keywordSet.add(token.slice(i, i + n).toLowerCase());
        }
      }
      if (token.length >= 2) keywordSet.add(token.toLowerCase());
    }
    const keywords = Array.from(keywordSet);

    // 额外检索 verified 状态的知识节点（优先于普通文档）
    const verifiedNodes = await prisma.knowledgeNode.findMany({
      where: { status: 'verified' },
    });

    if (chunks.length === 0 && verifiedNodes.length === 0) {
      return NextResponse.json(
        { success: false, error: '知识库为空，请先上传文档' },
        { status: 400 }
      );
    }

    // 把节点内容转成可打分的文本块：拼接 title + summary + clauses + logic + parameters
    const nodeChunks = verifiedNodes.map((node) => {
      let paramsText = '';
      try {
        const params = JSON.parse(node.parameters || '[]');
        if (Array.isArray(params)) {
          paramsText = params
            .map((p) => `${p.name || ''} ${p.value || ''} ${p.note || ''}`)
            .join(' ');
        }
      } catch {}
      const text = [node.title, node.summary, node.clauses, node.logic, paramsText]
        .filter(Boolean)
        .join(' ');
      return {
        nodeId: node.id,
        nodeCode: node.nodeCode,
        title: node.title,
        text,
      };
    });

    // 节点关键词打分
    const scoredNodes = nodeChunks.map((nc) => {
      const content = nc.text.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        score += (content.split(kw).length - 1) * 3; // 节点权重高于普通文档
      }
      return { ...nc, score };
    });

    const hitNodes = scoredNodes
      .filter((n) => n.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const scored = chunks.map((chunk) => {
      let score = 0;
      const content = chunk.content.toLowerCase();
      const title = (chunk.title ?? '').toLowerCase();

      for (const keyword of keywords) {
        const kw = keyword.toLowerCase();
        if (kw.length < 2) continue;

        const contentMatches = content.split(kw).length - 1;
        const titleMatches = title.split(kw).length - 1;

        score += contentMatches * 2; // 正文匹配权重2
        score += titleMatches * 5;   // 标题匹配权重5
      }

      // 加分：片段长度适中（太短信息少，太长抓不住重点）
      const len = content.length;
      if (len > 100 && len < 2000) score += 1;

      return { chunk, score };
    });

    // 按分数排序，取topK
    const topChunks = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // 节点结果作为特殊 chunk 排在最前
    const nodeResults = hitNodes.map((n) => ({
      docId: n.nodeId,
      docTitle: `【知识节点】${n.nodeCode} ${n.title}`,
      chunkTitle: '知识节点（verified）',
      content: n.text.slice(0, 1000),
      sourceType: 'knowledge_node',
      score: n.score,
    }));

    if (topChunks.length === 0 && nodeResults.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          chunks: [],
          message: '未在知识库中找到相关内容',
        },
      });
    }

    const chunkResults = topChunks.map((s) => ({
      docId: s.chunk.docId,
      docTitle: s.chunk.doc?.title ?? '',
      docType: s.chunk.doc?.docType ?? '',
      chunkTitle: s.chunk.title ?? '',
      content: s.chunk.content,
      score: s.score,
    }));

    return NextResponse.json({
      success: true,
      data: {
        chunks: [...nodeResults, ...chunkResults],
      },
    });
  } catch (error) {
    console.error('知识检索失败:', error);
    return NextResponse.json({ success: false, error: '知识检索失败' }, { status: 500 });
  }
}
