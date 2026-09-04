import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权使用' }, { status: 403 });
    }

    const docId = Number(request.nextUrl.searchParams.get('docId'));
    if (!docId) {
      return NextResponse.json({ success: false, error: '缺少文档ID' }, { status: 400 });
    }

    const doc = await prisma.knowledgeDoc.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      return NextResponse.json({ success: false, error: '文档不存在' }, { status: 404 });
    }

    if (!doc.extractResults) {
      return NextResponse.json({ success: false, error: '该文档还没有提炼结果' }, { status: 400 });
    }

    // 解析提炼结果
    const extractResults = JSON.parse(doc.extractResults);

    // 生成 Markdown 格式导出内容
    let md = `# ${doc.title} - 提炼结果\n\n`;
    md += `文档类型：${doc.docType}\n`;
    md += `提炼时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    md += `---\n\n`;

    if (Array.isArray(extractResults)) {
      for (const r of extractResults) {
        md += `## ${r.modelName} ${r.success ? '✅' : '❌'}\n\n`;
        if (r.success && r.result) {
          md += r.result + '\n\n';
        } else {
          md += `❌ ${r.error || '失败'}\n\n`;
        }
        md += `---\n\n`;
      }
    }

    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.title)}-%E6%8F%90%E7%82%BC%E7%BB%93%E6%9E%9C.md`,
      },
    });
  } catch (error) {
    console.error('导出提炼结果失败:', error);
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 });
  }
}
