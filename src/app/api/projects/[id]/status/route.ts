import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const projectId = Number(id);
    const body = await request.json();
    const { status, comment } = body;

    const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'archived'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '无效的状态' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: '项目不存在' },
        { status: 404 }
      );
    }

    // 数据权限检查：非 all 权限只能操作自己的项目
    if (user.dataScope !== 'all' && project.createdById !== user.id) {
      return NextResponse.json(
        { success: false, error: '无权操作此项目' },
        { status: 403 }
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { status },
    });

    // 审批状态变更时，创建审批记录并发送消息
    if (status === 'pending') {
      // 创建审批记录
      await prisma.approval.create({
        data: {
          projectId,
          approverId: user.id,
          status: 'pending',
        },
      });

      // 给所有数据权限为 all 的用户发消息
      const managers = await prisma.user.findMany({
        where: {
          role: { dataScope: 'all' },
          status: 'active',
        },
      });

      for (const manager of managers) {
        await prisma.message.create({
          data: {
            userId: manager.id,
            title: '新的审批待办',
            content: `项目「${project.projectName}」已提交审批，请及时处理。`,
            type: 'approval',
          },
        });
      }
    }

    if (status === 'approved' || status === 'rejected') {
      // 更新审批记录
      const approval = await prisma.approval.findFirst({
        where: { projectId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });

      if (approval) {
        await prisma.approval.update({
          where: { id: approval.id },
          data: {
            status,
            comment: comment || null,
            approvedAt: new Date(),
          },
        });
      }

      // 通知项目创建人
      if (project.createdById) {
        const actionText = status === 'approved' ? '已通过' : '已驳回';
        const commentText = comment ? `审批意见：${comment}` : '';
        await prisma.message.create({
          data: {
            userId: project.createdById,
            title: `项目审批${actionText}`,
            content: `您提交的项目「${project.projectName}」${actionText}。${commentText}`,
            type: 'approval',
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新项目状态失败:', error);
    return NextResponse.json(
      { success: false, error: '更新项目状态失败' },
      { status: 500 }
    );
  }
}
