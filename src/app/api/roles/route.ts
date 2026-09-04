import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const roles = await prisma.role.findMany({
      where: { status: 'active' },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: roles.map((r) => ({
        id: r.id,
        roleName: r.roleName,
        roleCode: r.roleCode,
      })),
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return NextResponse.json({ success: false, error: '获取角色列表失败' }, { status: 500 });
  }
}
