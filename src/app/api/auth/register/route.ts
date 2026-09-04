import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';

const RegisterSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50),
  password: z.string().min(6, '密码至少6位').max(100),
  realName: z.string().min(1, '请输入姓名').max(50),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = RegisterSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { username, password, realName, email, phone } = validationResult.data;

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: '用户名已存在' },
        { status: 400 }
      );
    }

    // 查找默认角色（设计师）
    const defaultRole = await prisma.role.findFirst({
      where: { roleCode: 'designer' },
    });

    if (!defaultRole) {
      return NextResponse.json(
        { success: false, error: '系统未初始化角色，请联系管理员' },
        { status: 500 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        realName,
        email: email || null,
        phone: phone || null,
        roleId: defaultRole.id,
      },
    });

    const token = await generateToken(user.id, user.username, defaultRole.roleCode);

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          realName: user.realName,
          roleName: defaultRole.roleName,
          roleCode: defaultRole.roleCode,
        },
      },
    });
  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json(
      { success: false, error: '注册失败' },
      { status: 500 }
    );
  }
}
