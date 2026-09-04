import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权使用' }, { status: 403 });
    }

    const body = await request.json();
    const { labTypeId, equipmentItems } = body;

    if (!labTypeId || !Array.isArray(equipmentItems) || equipmentItems.length === 0) {
      return NextResponse.json({ success: false, error: '缺少必要数据' }, { status: 400 });
    }

    // 验证实验室类型存在
    const labType = await prisma.labType.findUnique({ where: { id: Number(labTypeId) } });
    if (!labType) {
      return NextResponse.json({ success: false, error: '实验室类型不存在' }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;

    for (const item of equipmentItems) {
      const name = String(item.name || '').trim();
      if (!name) continue;

      // 价格转 number
      let price = 0;
      if (typeof item.price === 'number') {
        price = item.price;
      } else if (typeof item.price === 'string') {
        price = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
      }

      // 按 labTypeId + equipmentName 判断是否已存在
      const existing = await prisma.equipmentTemplate.findFirst({
        where: { labTypeId: Number(labTypeId), equipmentName: name },
      });

      if (existing) {
        // 更新价格
        await prisma.equipmentTemplate.update({
          where: { id: existing.id },
          data: {
            baseUnitPrice: price,
            specification: item.specification || existing.specification,
          },
        });
        updated++;
      } else {
        // 新增
        await prisma.equipmentTemplate.create({
          data: {
            labTypeId: Number(labTypeId),
            equipmentName: name,
            specification: String(item.specification || ''),
            unit: String(item.unit || '台'),
            qtyPer100Area: 1,
            baseUnitPrice: price,
            isRequired: false,
            sortOrder: imported,
          },
        });
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      data: { imported, updated, total: equipmentItems.length },
    });
  } catch (error) {
    console.error('设备导入失败:', error);
    return NextResponse.json({ success: false, error: '导入失败' }, { status: 500 });
  }
}
