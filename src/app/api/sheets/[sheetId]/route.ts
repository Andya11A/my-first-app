import { NextRequest, NextResponse } from 'next/server';
import { getSheetDetail } from '@/lib/sheet-detail';

// 单个 Sheet 详情：匹配的相关标准 / 选型参数 / 施工工艺
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  const { sheetId } = await params;
  const sheetName = decodeURIComponent(sheetId);
  if (!sheetName.trim()) {
    return NextResponse.json({ success: false, error: 'Sheet 名称不能为空' }, { status: 400 });
  }
  try {
    const data = await getSheetDetail(sheetName);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('获取 Sheet 详情失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
