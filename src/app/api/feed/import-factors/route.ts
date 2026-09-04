import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const CATEGORIES = ['装修', '暖通', '电气', '给排水'];

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权操作' }, { status: 403 });
    }

    const body = await request.json();
    const { labTypeId, factors, mode } = body;
    const importMode = mode === 'overwrite' ? 'overwrite' : 'merge';

    if (!labTypeId) {
      return NextResponse.json({ success: false, error: '请选择实验室类型' }, { status: 400 });
    }
    if (!factors || !Array.isArray(factors) || factors.length === 0) {
      return NextResponse.json({ success: false, error: '缺少工程系数数据' }, { status: 400 });
    }

    const labTypeIdNum = Number(labTypeId);
    const labType = await prisma.labType.findUnique({ where: { id: labTypeIdNum } });
    if (!labType) {
      return NextResponse.json({ success: false, error: '实验室类型不存在' }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    // 批量覆盖模式：先删除该实验室类型下所有工程系数
    if (importMode === 'overwrite') {
      await prisma.constructionFactor.deleteMany({ where: { labTypeId: labTypeIdNum } });
    }

    for (let i = 0; i < factors.length; i++) {
      const item = factors[i];
      if (!item.itemName) {
        skipped++;
        continue;
      }
      const factor = Number(item.factorPerArea);
      if (!isFinite(factor) || factor <= 0) {
        skipped++;
        continue;
      }

      const unitPrice = Number(item.unitPrice);
      const category = CATEGORIES.includes(item.category) ? item.category : '装修';

      const existing = importMode === 'merge'
        ? await prisma.constructionFactor.findFirst({
            where: { labTypeId: labTypeIdNum, itemName: item.itemName },
          })
        : null;

      if (existing) {
        await prisma.constructionFactor.update({
          where: { id: existing.id },
          data: {
            factorPerArea: factor,
            baseUnitPrice: isFinite(unitPrice) && unitPrice > 0 ? unitPrice : existing.baseUnitPrice,
            unit: item.unit || existing.unit,
          },
        });
        updated++;
      } else {
        await prisma.constructionFactor.create({
          data: {
            labTypeId: labTypeIdNum,
            itemName: item.itemName,
            unit: item.unit || '㎡',
            factorPerArea: factor,
            baseUnitPrice: isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0,
            category,
            sortOrder: 99 + i,
          },
        });
        imported++;
      }
    }

    // 记录导入历史
    await prisma.importHistory.create({
      data: {
        userId: user.id,
        fileName: body.fileName || '未知文件',
        fileType: body.fileType || 'word',
        importMode,
        labTypeId: labTypeIdNum,
        equipmentCount: 0,
        factorCount: imported + updated,
      },
    });

    return NextResponse.json({
      success: true,
      data: { imported, updated, skipped, mode: importMode },
    });
  } catch (error) {
    console.error('导入工程系数失败:', error);
    return NextResponse.json(
      { success: false, error: '导入失败' },
      { status: 500 }
    );
  }
}
