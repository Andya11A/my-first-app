import { NextRequest, NextResponse } from 'next/server';

// 精确报价服务端代理：转发到 Python 计算引擎，隐藏引擎地址 + 统一超时
// 引擎真实路径：POST /api/v1/precise-quote/calculate
const ENGINE_URL =
  process.env.CALC_ENGINE_URL ||
  process.env.NEXT_PUBLIC_CALC_ENGINE_URL ||
  'http://localhost:8101';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await fetch(`${ENGINE_URL}/api/v1/precise-quote/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // 30s 超时
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `引擎异常: ${errorText.slice(0, 500)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const msg = error instanceof Error && error.name === 'TimeoutError' ? '计算引擎响应超时（30s）' : '精确报价服务不可达，请检查 calc_engine 是否启动（端口8101）';
    console.error('精确报价转发失败:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 503 });
  }
}
