import { NextResponse } from 'next/server';
import { getSheetGroups } from '@/lib/sheet-detail';

// 72 Sheet 全景视图：专业领域分组 + Sheet 列表（数据驱动，来自 SPEC-* 节点）
export async function GET() {
  try {
    const groups = await getSheetGroups();
    return NextResponse.json({ success: true, data: groups });
  } catch (error) {
    console.error('获取 Sheet 分组失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
