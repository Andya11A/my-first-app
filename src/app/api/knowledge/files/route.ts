import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { parseKnowledgeFile, sanitizeFileName, SUPPORTED_EXTENSIONS, extractKeywords } from '@/lib/knowledge-parse';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function isAdmin(roleCode: string) {
  return roleCode === 'admin' || roleCode === 'super_admin';
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const admin = isAdmin(user.roleCode);
    const status = request.nextUrl.searchParams.get('status') || '';
    const mine = request.nextUrl.searchParams.get('mine') === '1';

    const where: Record<string, unknown> = {};
    if (!admin || mine) where.uploaderId = user.id; // 客户只能看自己的
    if (status) where.status = status;

    const files = await prisma.knowledgeFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, fileName: true, fileType: true, fileSize: true,
        source: true, category: true, note: true, status: true,
        uploaderName: true, chunkCount: true, parseSummary: true, parseError: true,
        reviewNote: true, reviewedAt: true, createdAt: true,
      },
    });

    const statsRows = await prisma.knowledgeFile.groupBy({
      by: ['status'],
      _count: true,
      where: admin ? {} : { uploaderId: user.id },
    });
    const stats: Record<string, number> = { total: 0, pending: 0, approved: 0, rejected: 0 };
    for (const row of statsRows) {
      stats[row.status] = row._count;
      stats.total += row._count;
    }

    return NextResponse.json({ success: true, data: { files, stats, isAdmin: admin } });
  } catch (error) {
    console.error('知识文件列表失败:', error);
    return NextResponse.json({ success: false, error: '获取列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const title = String(form.get('title') || '').trim();
    const category = String(form.get('category') || '其他').trim() || '其他';
    const note = String(form.get('note') || '').trim() || null;

    if (!file) {
      return NextResponse.json({ success: false, error: '请选择要上传的文件' }, { status: 400 });
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
      return NextResponse.json(
        { success: false, error: `暂不支持 .${ext} 格式，请上传 ${SUPPORTED_EXTENSIONS.join(' / ')} 文件` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: '文件大小不能超过 10MB' }, { status: 400 });
    }

    const admin = isAdmin(user.roleCode);
    const buffer = Buffer.from(await file.arrayBuffer());

    // 保存文件到磁盘
    const dir = path.join(process.cwd(), 'uploads', 'knowledge');
    await fs.mkdir(dir, { recursive: true });
    const safeName = sanitizeFileName(file.name);
    const storedName = `${Date.now()}_${safeName}`;
    const filePath = path.join(dir, storedName);
    await fs.writeFile(filePath, buffer);

    // 解析为知识块
    let parsed;
    let parseError: string | null = null;
    try {
      parsed = await parseKnowledgeFile(buffer, file.name);
    } catch (err) {
      parseError = err instanceof Error ? err.message : '解析失败';
      parsed = { chunks: [], summary: { fileType: ext, chunkCount: 0 } };
    }

    const status = admin ? 'approved' : 'pending'; // 管理员上传直接入库；客户上传待审核
    const created = await prisma.knowledgeFile.create({
      data: {
        title: title || safeName.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        filePath: path.join('uploads', 'knowledge', storedName),
        fileType: ext,
        fileSize: file.size,
        source: admin ? 'admin' : 'customer',
        category,
        note,
        status,
        uploaderId: user.id,
        uploaderName: user.realName,
        chunkCount: parsed.chunks.length,
        parseSummary: JSON.stringify(parsed.summary),
        parseError,
        chunks: {
          create: parsed.chunks.map((c, i) => ({
            seq: i,
            content: c.content,
            keywords: `${category} ${extractKeywords(c.content)}`.trim(),
            status,
          })),
        },
      },
      include: { chunks: { select: { id: true }, take: 1 } },
    });

    // 客户上传 → 通知管理员审核
    if (!admin) {
      const admins = await prisma.user.findMany({
        where: { status: 'active', role: { roleCode: { in: ['admin', 'super_admin'] } } },
        select: { id: true },
      });
      for (const a of admins) {
        await prisma.message.create({
          data: {
            userId: a.id,
            title: '新资料待审核',
            content: `${user.realName} 上传了资料《${created.title}》（${parsed.chunks.length} 个知识块），请到知识库管理页面审核。`,
            type: 'system',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        title: created.title,
        status: created.status,
        chunkCount: parsed.chunks.length,
        parseError,
        message: admin
          ? `上传成功，已解析 ${parsed.chunks.length} 个知识块并直接入库${parseError ? '（部分解析失败：' + parseError + '）' : ''}`
          : `上传成功，已解析 ${parsed.chunks.length} 个知识块，等待管理员审核后入库${parseError ? '（部分解析失败：' + parseError + '）' : ''}`,
      },
    });
  } catch (error) {
    console.error('知识文件上传失败:', error);
    return NextResponse.json({ success: false, error: '上传失败，请重试' }, { status: 500 });
  }
}
