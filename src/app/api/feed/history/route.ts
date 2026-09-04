import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权操作' }, { status: 403 });
    }

    const histories = await prisma.importHistory.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { realName: true } },
        labType: { select: { typeName: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: histories.map((h) => ({
        id: h.id,
        fileName: h.fileName,
        fileType: h.fileType,
        importMode: h.importMode,
        labTypeName: h.labType?.typeName || '-',
        equipmentCount: h.equipmentCount,
        factorCount: h.factorCount,
        operator: h.user.realName,
        createdAt: h.createdAt,
      })),
    });
  } catch (error) {
    console.error('获取导入历史失败:', error);
    return NextResponse.json(
      { success: false, error: '获取导入历史失败' },
      { status: 500 }
    );
  }
}
