import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin') {
      return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        realName: u.realName,
        email: u.email,
        phone: u.phone,
        roleName: u.role.roleName,
        roleCode: u.role.roleCode,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin') {
      return NextResponse.json({ success: false, error: '无权操作' }, { status: 403 });
    }

    const body = await request.json();
    const { id, roleId, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少用户ID' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (roleId) updateData.roleId = Number(roleId);
    if (status) updateData.status = status;

    await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
  }
}
