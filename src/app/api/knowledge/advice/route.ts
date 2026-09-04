import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { buildAdvice } from '@/lib/knowledge-advice';

/** 智能专业建议：规范条款 + 已入库知识 + 行业数据 三路融合 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const question = String(body?.question || '').trim();
    if (question.length < 2) {
      return NextResponse.json({ success: false, error: '请描述您的问题（至少 2 个字）' }, { status: 400 });
    }
    if (question.length > 500) {
      return NextResponse.json({ success: false, error: '问题描述过长（最多 500 字）' }, { status: 400 });
    }

    const advice = await buildAdvice(question);
    return NextResponse.json({ success: true, data: advice });
  } catch (error) {
    console.error('智能建议生成失败:', error);
    return NextResponse.json({ success: false, error: '建议生成失败' }, { status: 500 });
  }
}
