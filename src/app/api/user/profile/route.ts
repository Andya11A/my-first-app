import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: fullUser?.id,
        username: fullUser?.username,
        realName: fullUser?.realName,
        email: fullUser?.email,
        phone: fullUser?.phone,
        roleName: fullUser?.role.roleName,
        roleCode: fullUser?.role.roleCode,
        lastLoginAt: fullUser?.lastLoginAt,
        createdAt: fullUser?.createdAt,
      },
    });
  } catch (error) {
    console.error('获取个人信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取个人信息失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { realName, email, phone, oldPassword, newPassword } = body;

    const updateData: Record<string, string> = {};

    if (realName) updateData.realName = realName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    // 修改密码
    if (oldPassword && newPassword) {
      const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!fullUser) {
        return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
      }
      const isValid = await verifyPassword(oldPassword, fullUser.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: '原密码错误' },
          { status: 400 }
        );
      }
      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: '新密码至少6位' },
          { status: 400 }
        );
      }
      updateData.passwordHash = await hashPassword(newPassword);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新个人信息失败:', error);
    return NextResponse.json(
      { success: false, error: '更新个人信息失败' },
      { status: 500 }
    );
  }
}
