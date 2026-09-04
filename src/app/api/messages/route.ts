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

    const messages = await prisma.message.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = messages.filter((m) => !m.isRead).length;

    return NextResponse.json({
      success: true,
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          title: m.title,
          content: m.content,
          type: m.type,
          isRead: m.isRead,
          createdAt: m.createdAt,
        })),
        unreadCount,
      },
    });
  } catch (error) {
    console.error('获取消息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取消息失败' },
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
    const { id, markAll } = body;

    if (markAll) {
      await prisma.message.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (id) {
      await prisma.message.update({
        where: { id: Number(id) },
        data: { isRead: true },
      });
    }

    const unreadCount = await prisma.message.count({
      where: { userId: user.id, isRead: false },
    });

    return NextResponse.json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error('更新消息失败:', error);
    return NextResponse.json(
      { success: false, error: '更新消息失败' },
      { status: 500 }
    );
  }
}
