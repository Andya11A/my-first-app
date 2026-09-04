import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const labTypes = await prisma.labType.findMany({
      select: {
        id: true,
        typeName: true,
        cleanLevelDefault: true,
        pressureRequirement: true,
        tempHumidity: true,
        airChangesPerHour: true,
        illuminationLux: true,
        notes: true,
      },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: labTypes,
    });
  } catch (error) {
    console.error('获取实验室类型失败:', error);
    return NextResponse.json(
      { success: false, error: '获取实验室类型失败' },
      { status: 500 }
    );
  }
}
