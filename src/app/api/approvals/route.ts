import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 待办：需要我审批的（数据权限all的用户看到所有pending）
    // 已办：我审批过的
    const approvals = await prisma.approval.findMany({
      where:
        user.dataScope === 'all'
          ? {}
          : { approverId: user.id },
      include: {
        project: {
          select: {
            projectName: true,
            labType: { select: { typeName: true } },
            area: true,
          },
        },
        approver: { select: { realName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: approvals.map((a) => ({
        id: a.id,
        projectId: a.projectId,
        projectName: a.project.projectName,
        labTypeName: a.project.labType.typeName,
        area: Number(a.project.area),
        approverName: a.approver.realName,
        status: a.status,
        comment: a.comment,
        createdAt: a.createdAt,
        approvedAt: a.approvedAt,
      })),
    });
  } catch (error) {
    console.error('获取审批记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取审批记录失败' },
      { status: 500 }
    );
  }
}
