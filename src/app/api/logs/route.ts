import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin') {
      return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
    }

    const action = request.nextUrl.searchParams.get('action') || '';
    const targetType = request.nextUrl.searchParams.get('targetType') || '';

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;

    const logs = await prisma.operationLog.findMany({
      where,
      include: {
        user: { select: { realName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        userName: log.user.realName,
        action: log.action,
        targetType: log.targetType,
        detail: log.detail,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
