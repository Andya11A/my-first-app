import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logOperation } from '@/lib/logger';

// 获取某文档的所有笔记
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const docId = Number(request.nextUrl.searchParams.get('docId'));
    if (!docId) {
      return NextResponse.json({ success: false, error: '缺少文档ID' }, { status: 400 });
    }

    const notes = await prisma.docNote.findMany({
      where: { docId },
      include: {
        createdBy: { select: { realName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: notes.map((n) => ({
        id: n.id,
        docId: n.docId,
        selectedText: n.selectedText,
        noteContent: n.noteContent,
        createdByName: n.createdBy.realName,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    console.error('获取笔记失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}

// 添加笔记
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { docId, selectedText, noteContent } = body;

    if (!docId || !selectedText || !noteContent?.trim()) {
      return NextResponse.json({ success: false, error: '缺少必要数据' }, { status: 400 });
    }

    const note = await prisma.docNote.create({
      data: {
        docId: Number(docId),
        selectedText,
        noteContent: noteContent.trim(),
        createdById: user.id,
      },
    });

    await logOperation(user.id, 'create', 'note', note.id, `添加笔记：「${selectedText.slice(0, 30)}...」`);

    return NextResponse.json({ success: true, data: { id: note.id } });
  } catch (error) {
    console.error('添加笔记失败:', error);
    return NextResponse.json({ success: false, error: '添加失败' }, { status: 500 });
  }
}

// 编辑笔记
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { id, noteContent } = body;

    if (!id || !noteContent?.trim()) {
      return NextResponse.json({ success: false, error: '缺少必要数据' }, { status: 400 });
    }

    await prisma.docNote.update({
      where: { id: Number(id) },
      data: { noteContent: noteContent.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('编辑笔记失败:', error);
    return NextResponse.json({ success: false, error: '编辑失败' }, { status: 500 });
  }
}

// 删除笔记
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const noteId = Number(request.nextUrl.searchParams.get('id'));
    if (!noteId) {
      return NextResponse.json({ success: false, error: '缺少笔记ID' }, { status: 400 });
    }

    await prisma.docNote.delete({ where: { id: noteId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除笔记失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
