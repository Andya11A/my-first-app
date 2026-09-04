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

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword') || '';
    const status = searchParams.get('status') || '';
    const labTypeId = searchParams.get('labTypeId') || '';
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '20');

    // 数据权限：all 看全部，self 只看自己创建的
    const where: Record<string, unknown> = user.dataScope === 'all' ? {} : { createdById: user.id };

    // 关键词搜索
    if (keyword) {
      where.projectName = { contains: keyword };
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 类型筛选
    if (labTypeId) {
      where.labTypeId = Number(labTypeId);
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          labType: { select: { typeName: true } },
          createdBy: { select: { realName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        projects: projects.map((p) => ({
          id: p.id,
          projectName: p.projectName,
          labTypeId: p.labTypeId,
          labTypeName: p.labType.typeName,
          area: Number(p.area),
          cleanLevel: p.cleanLevel,
          budgetLevel: p.budgetLevel,
          status: p.status,
          createdByName: p.createdBy?.realName || '未知',
          createdAt: p.createdAt,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取项目列表失败' },
      { status: 500 }
    );
  }
}
