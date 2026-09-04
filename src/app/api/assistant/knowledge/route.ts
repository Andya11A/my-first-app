import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logOperation } from '@/lib/logger';

// 获取知识库列表（支持搜索）
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权使用' }, { status: 403 });
    }

    const docId = request.nextUrl.searchParams.get('id');
    const keyword = request.nextUrl.searchParams.get('keyword') || '';

    // 获取单文档
    if (docId) {
      const doc = await prisma.knowledgeDoc.findUnique({
        where: { id: Number(docId) },
      });
      if (!doc) {
        return NextResponse.json({ success: false, error: '文档不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: doc });
    }

    // 列表搜索
    const where: Record<string, unknown> = {};
    if (keyword.trim()) {
      where.OR = [
        { title: { contains: keyword.trim() } },
        { docType: { contains: keyword.trim() } },
        { content: { contains: keyword.trim() } },
      ];
    }

    const docs = await prisma.knowledgeDoc.findMany({
      where,
      select: {
        id: true,
        title: true,
        docType: true,
        fileName: true,
        chunkCount: true,
        extractResults: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: docs });
  } catch (error) {
    console.error('获取知识库失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}

// 上传知识文档
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
    const { title, docType, fileName, fileSize, chunks, originalFileName, originalFilePath } = body;

    if (!title || !chunks || chunks.length === 0) {
      return NextResponse.json({ success: false, error: '缺少必要数据' }, { status: 400 });
    }

    const doc = await prisma.knowledgeDoc.create({
      data: {
        title,
        docType: docType || '技术资料',
        fileName: fileName || '',
        fileSize: fileSize || 0,
        content: chunks.map((c: { content: string }) => c.content).join('\n\n'),
        chunkCount: chunks.length,
        originalFileName: originalFileName || null,
        originalFilePath: originalFilePath || null,
        uploadedById: user.id,
      },
    });

    await prisma.knowledgeChunk.createMany({
      data: chunks.map((chunk: { title: string; content: string }, index: number) => ({
        docId: doc.id,
        seq: index,
        chunkIndex: index,
        title: chunk.title || '正文',
        content: chunk.content,
      })),
    });

    await logOperation(user.id, 'upload', 'document', doc.id, `上传文档「${doc.title}」（${chunks.length} 片段）`);

    return NextResponse.json({
      success: true,
      data: { docId: doc.id, chunkCount: chunks.length },
    });
  } catch (error) {
    console.error('知识入库失败:', error);
    return NextResponse.json({ success: false, error: '入库失败' }, { status: 500 });
  }
}

// 保存提炼结果
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权使用' }, { status: 403 });
    }

    const body = await request.json();
    const { docId, extractResults, newTitle } = body;

    if (!docId) {
      return NextResponse.json({ success: false, error: '缺少文档ID' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (extractResults) {
      updateData.extractResults = JSON.stringify(extractResults);
    }
    if (newTitle?.trim()) {
      updateData.title = newTitle.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '没有需要更新的内容' }, { status: 400 });
    }

    await prisma.knowledgeDoc.update({
      where: { id: Number(docId) },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存提炼结果失败:', error);
    return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 });
  }
}

// 删除知识文档
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权使用' }, { status: 403 });
    }

    const docId = Number(request.nextUrl.searchParams.get('id'));
    if (!docId) {
      return NextResponse.json({ success: false, error: '缺少文档ID' }, { status: 400 });
    }

    const deletedDoc = await prisma.knowledgeDoc.findUnique({ where: { id: docId } });
    await prisma.knowledgeDoc.delete({ where: { id: docId } });
    await logOperation(user.id, 'delete', 'document', docId, `删除文档「${deletedDoc?.title || docId}」`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除知识文档失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
