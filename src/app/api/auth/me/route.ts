import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: '未登录或登录已过期' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: user,
  });
}
