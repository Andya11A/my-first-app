import { prisma } from './db';

export async function logOperation(
  userId: number,
  action: string,
  targetType: string,
  targetId?: number,
  detail?: string
) {
  try {
    await prisma.operationLog.create({
      data: {
        userId,
        action,
        targetType,
        targetId: targetId || null,
        detail: detail || null,
      },
    });
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}
