import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 工程知识体系统一搜索：标准库（专项>主要>配套排序）+ 行业选型 + 施工工艺 + 十级坐标
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  if (!q) return NextResponse.json({ success: false, error: '请输入搜索关键词' }, { status: 400 });

  try {
    // 1. 标准库（按优先级降序：专项 > 主要 > 配套）
    const standards = await prisma.standard.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { keywords: { contains: q } },
          { industry: { contains: q } },
          { code: { contains: q } },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    // 2. 行业选型
    const industryConfigs = await prisma.industryConfig.findMany({
      where: {
        OR: [
          { industry: { contains: q } },
          { paramKey: { contains: q } },
          { systemCategory: { contains: q } },
          { reference: { contains: q } },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    // 3. 施工工艺
    const processes = await prisma.processFlow.findMany({
      where: {
        OR: [
          { processName: { contains: q } },
          { category: { contains: q } },
        ],
      },
    });

    // 4. 十级坐标（从 ENG-CORE-2026 节点取：parameters 存十级，crossLinks 存联动矩阵）
    const coreNode = await prisma.knowledgeNode.findUnique({
      where: { nodeCode: 'ENG-CORE-2026' },
    });
    let coordinates: { index: number; layer: string }[] = [];
    let matrix: { from: string; to: string; impact: string }[] = [];
    if (coreNode) {
      try { coordinates = JSON.parse(coreNode.parameters || '[]'); } catch { /* ignore */ }
      try { matrix = JSON.parse(coreNode.crossLinks || '[]'); } catch { /* ignore */ }
    }

    return NextResponse.json({
      success: true,
      data: {
        query: q,
        standards: {
          main: standards.filter((s) => s.type === '主要'),
          special: standards.filter((s) => s.type === '行业专项'),
          support: standards.filter((s) => s.type === '配套'),
        },
        industryConfigs,
        processes,
        coordinates: {
          layers: coordinates,
          matrix,
        },
      },
    });
  } catch (error) {
    console.error('搜索失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
