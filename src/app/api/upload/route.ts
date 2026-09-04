import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权使用' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: '缺少文件' }, { status: 400 });
    }

    // 保存到 public/uploads/knowledge
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'knowledge');
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || '';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, safeName);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(bytes));

    // 返回可访问的相对 URL
    const fileUrl = `/uploads/knowledge/${safeName}`;

    return NextResponse.json({
      success: true,
      data: { fileUrl, fileName: file.name, fileSize: file.size },
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 });
  }
}
