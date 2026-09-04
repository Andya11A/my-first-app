import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSheetDetail } from '@/lib/sheet-detail';

// 导出单个 Sheet 为 Excel（3 Sheet：标准 / 选型参数 / 施工工艺）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  const { sheetId } = await params;
  const sheetName = decodeURIComponent(sheetId);
  try {
    const { standards, configs, processes } = await getSheetDetail(sheetName);

    const wb = XLSX.utils.book_new();
    const stdData = standards.map((s) => ({ 代码: s.code, 名称: s.name, 类型: s.type, 适用行业: s.industry || '', 状态: s.status, 适用范围: s.scope || '' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stdData), '标准');

    const cfgData = configs.map((c) => ({ 行业: c.industry, 系统: c.systemCategory, 参数: c.paramKey, 推荐值: c.paramValue, 单位: c.unit || '', 参考: c.reference || '' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cfgData), '选型参数');

    const procData = processes.map((p) => ({ 工序: p.processName, 类别: p.category, 质量标准: p.qualityStd || '', 验收要点: p.acceptance || '', 安全交底: p.safetyNotes || '' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(procData), '施工工艺');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    // 文件名 ASCII 兜底 + RFC 5987 UTF-8（裸中文 header 会 500）
    const asciiName = `sheet-${encodeURIComponent(sheetName)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(`Sheet-${sheetName}.xlsx`)}`,
      },
    });
  } catch (error) {
    console.error('导出 Sheet 失败:', error);
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 });
  }
}
