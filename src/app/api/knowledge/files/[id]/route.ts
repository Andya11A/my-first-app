import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function isAdmin(roleCode: string) {
  return roleCode === 'admin' || roleCode === 'super_admin';
}

/** 文件详情（含解析出的知识块）—— 管理员或本人可看 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    const { id } = await params;
    const file = await prisma.knowledgeFile.findUnique({
      where: { id: Number(id) },
      include: { chunks: { orderBy: { seq: 'asc' }, select: { id: true, seq: true, content: true, keywords: true, status: true } } },
    });
    if (!file) {
      return NextResponse.json({ success: false, error: '文件不存在' }, { status: 404 });
    }
    if (!isAdmin(user.roleCode) && file.uploaderId !== user.id) {
      return NextResponse.json({ success: false, error: '无权限查看该文件' }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: { file } });
  } catch (error) {
    console.error('知识文件详情失败:', error);
    return NextResponse.json({ success: false, error: '获取详情失败' }, { status: 500 });
  }
}

/** 审核（仅管理员）：approve / reject */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!isAdmin(user.roleCode)) {
      return NextResponse.json({ success: false, error: '仅管理员可审核' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const action = body?.action;
    const reviewNote = String(body?.reviewNote || '').trim() || null;
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, error: '无效的审核动作' }, { status: 400 });
    }

    const file = await prisma.knowledgeFile.findUnique({ where: { id: Number(id) } });
    if (!file) {
      return NextResponse.json({ success: false, error: '文件不存在' }, { status: 404 });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    await prisma.$transaction([
      prisma.knowledgeFile.update({
        where: { id: file.id },
        data: { status, reviewedById: user.id, reviewedAt: new Date(), reviewNote },
      }),
      prisma.knowledgeChunk.updateMany({ where: { fileId: file.id }, data: { status } }),
    ]);

    // 通知上传人审核结果
    if (file.uploaderId !== user.id) {
      await prisma.message.create({
        data: {
          userId: file.uploaderId,
          title: action === 'approve' ? '资料审核通过' : '资料被驳回',
          content:
            action === 'approve'
              ? `您上传的《${file.title}》已审核通过并入库（${file.chunkCount} 个知识块），现在参与智能建议。`
              : `您上传的《${file.title}》被驳回。${reviewNote ? '审核意见：' + reviewNote : ''}`,
          type: 'system',
        },
      });
    }

    return NextResponse.json({ success: true, data: { id: file.id, status } });
  } catch (error) {
    console.error('知识文件审核失败:', error);
    return NextResponse.json({ success: false, error: '审核失败' }, { status: 500 });
  }
}

/** 删除：管理员可删任意；客户仅能删自己待审核的 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const file = await prisma.knowledgeFile.findUnique({ where: { id: Number(id) } });
    if (!file) {
      return NextResponse.json({ success: false, error: '文件不存在' }, { status: 404 });
    }
    if (!isAdmin(user.roleCode) && !(file.uploaderId === user.id && file.status === 'pending')) {
      return NextResponse.json({ success: false, error: '无权限删除该文件' }, { status: 403 });
    }

    await prisma.knowledgeFile.delete({ where: { id: file.id } }); // chunks 级联删除
    try {
      await fs.unlink(path.join(process.cwd(), file.filePath));
    } catch {
      // 文件可能已被移动/清理，忽略
    }
    return NextResponse.json({ success: true, data: { id: file.id } });
  } catch (error) {
    console.error('知识文件删除失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
