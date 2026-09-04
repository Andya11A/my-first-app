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

    // 数据权限
    const where = user.dataScope === 'all' ? {} : { createdById: user.id };

    // 项目总数
    const totalProjects = await prisma.project.count({ where });

    // 按状态统计
    const statusStats = await prisma.project.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    // 按实验室类型统计
    const typeStats = await prisma.project.groupBy({
      by: ['labTypeId'],
      where,
      _count: { id: true },
    });

    const typeNames = await prisma.labType.findMany({
      select: { id: true, typeName: true },
    });

    const typeStatsWithNames = typeStats.map((t) => ({
      labTypeId: t.labTypeId,
      labTypeName: typeNames.find((n) => n.id === t.labTypeId)?.typeName || '未知',
      count: t._count.id,
    }));

    // 总面积
    const areaSum = await prisma.project.aggregate({
      where,
      _sum: { area: true },
    });

    // 最新5个项目
    const recentProjects = await prisma.project.findMany({
      where,
      include: {
        labType: { select: { typeName: true } },
        createdBy: { select: { realName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 待审批数量
    const pendingCount = await prisma.approval.count({
      where: { status: 'pending' },
    });

    // 用户数量（仅超级管理员可见）
    let userCount = 0;
    if (user.roleCode === 'super_admin') {
      userCount = await prisma.user.count();
    }

    // 审批通过率
    const totalApprovals = await prisma.approval.count();
    const approvedApprovals = await prisma.approval.count({
      where: { status: 'approved' },
    });
    const approvalRate = totalApprovals > 0 ? Math.round((approvedApprovals / totalApprovals) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalProjects,
        pendingCount,
        totalArea: Number(areaSum._sum.area || 0),
        statusStats: statusStats.map((s) => ({ status: s.status, count: s._count.id })),
        typeStats: typeStatsWithNames,
        recentProjects: recentProjects.map((p) => ({
          id: p.id,
          projectName: p.projectName,
          labTypeName: p.labType.typeName,
          area: Number(p.area),
          status: p.status,
          createdByName: p.createdBy?.realName || '未知',
          createdAt: p.createdAt,
        })),
        approvalRate,
        userCount,
      },
    });
  } catch (error) {
    console.error('获取看板数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取看板数据失败' },
      { status: 500 }
    );
  }
}
