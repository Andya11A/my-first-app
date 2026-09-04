import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db';

// 工程速查表导出：多 Sheet Excel（核心标准/行业选型/施工工艺/十级坐标）
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '电池';
  try {
    const standards = await prisma.standard.findMany({
      where: { OR: [{ name: { contains: q } }, { industry: { contains: q } }, { code: { contains: q } }] },
      orderBy: { priority: 'desc' },
    });
    const configs = await prisma.industryConfig.findMany({
      where: { OR: [{ industry: { contains: q } }, { paramKey: { contains: q } }] },
      orderBy: { priority: 'desc' },
    });
    const processes = await prisma.processFlow.findMany({});

    // 十级坐标从 ENG-CORE-2026 节点读取（与种子数据保持一致）
    let layers: { index: number; layer: string }[] = [];
    let matrix: { from: string; to: string; impact: string }[] = [];
    try {
      const coreNode = await prisma.knowledgeNode.findUnique({ where: { nodeCode: 'ENG-CORE-2026' } });
      if (coreNode) {
        layers = JSON.parse(coreNode.parameters || '[]');
        matrix = JSON.parse(coreNode.crossLinks || '[]');
      }
    } catch { /* 兜底为空数组 */ }

    const wb = XLSX.utils.book_new();

    // Sheet1: 核心标准
    const stdData = standards.map((s) => ({
      标准代码: s.code, 名称: s.name, 类型: s.type, 优先级: s.priority,
      适用行业: s.industry || '', 状态: s.status, 适用范围: s.scope || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stdData), '核心标准');

    // Sheet2: 行业选型
    const cfgData = configs.map((c) => ({
      行业: c.industry, 系统分类: c.systemCategory, 参数: c.paramKey,
      推荐值: c.paramValue, 单位: c.unit || '', 参考来源: c.reference || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cfgData), '行业选型');

    // Sheet3: 施工工艺
    const procData = processes.map((p) => ({
      工序: p.processName, 类别: p.category,
      施工步骤: Array.isArray(p.steps) ? p.steps.join(' → ') : String(p.steps || ''),
      质量标准: p.qualityStd || '', 验收要点: p.acceptance || '', 安全交底: p.safetyNotes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(procData), '施工工艺');

    // Sheet4: 十级坐标 + 联动矩阵
    const coordRows: Record<string, string>[] = layers.map((l) => ({
      层级: `第${l.index}级`, 名称: l.layer.replace(/^[^：]+：/, ''), 联动关系: '',
    }));
    for (const m of matrix) {
      coordRows.push({
        层级: '联动', 名称: `${m.from} → ${m.to}`, 联动关系: m.impact,
      });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(coordRows), '十级坐标');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    // 中文文件名需 RFC 5987 编码（裸中文会导致部分客户端 500/乱码）
    const filename = `quick-reference-${encodeURIComponent(q)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(`工程速查表-${q}.xlsx`)}`,
      },
    });
  } catch (error) {
    console.error('导出失败:', error);
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 });
  }
}
