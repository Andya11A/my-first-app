import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 获取节点列表（按状态过滤 + 搜索）
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    if (user.roleCode !== "super_admin" && user.roleCode !== "admin") {
      return NextResponse.json({ success: false, error: "无权访问" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const status = params.get("status") || "";        // draft/review/verified，空=全部
    const industry = params.get("industry") || "";
    const keyword = params.get("keyword") || "";
    const source = params.get("source") || "";        // system/auto，空=全部

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (industry) where.industry = industry;
    if (source) where.source = source;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { nodeCode: { contains: keyword } },
      ];
    }

    const nodes = await prisma.knowledgeNode.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      success: true,
      data: nodes.map((n) => ({
        id: n.id,
        nodeCode: n.nodeCode,
        industry: n.industry,
        facilityType: n.facilityType,
        environment: n.environment,
        title: n.title,
        summary: n.summary,
        status: n.status,
        source: n.source,
        moduleCode: n.moduleCode,
        updatedAt: n.updatedAt,
      })),
    });
  } catch (error) {
    console.error("获取节点列表失败:", error);
    return NextResponse.json({ success: false, error: "获取节点列表失败" }, { status: 500 });
  }
}

// 手动创建节点（draft状态）
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    if (user.roleCode !== "super_admin" && user.roleCode !== "admin") {
      return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const { nodeCode, industry, facilityType, environment, title } = body;

    if (!nodeCode || !title) {
      return NextResponse.json({ success: false, error: "nodeCode 和 title 必填" }, { status: 400 });
    }

    // 检查 nodeCode 唯一性
    const existing = await prisma.knowledgeNode.findUnique({ where: { nodeCode } });
    if (existing) {
      return NextResponse.json({ success: false, error: `节点编号 ${nodeCode} 已存在` }, { status: 400 });
    }

    const node = await prisma.knowledgeNode.create({
      data: {
        nodeCode,
        industry: industry || "通用",
        facilityType: facilityType || "全形态",
        environment: environment || "",
        title,
        summary: "",
        regulations: "[]",
        chapters: "[]",
        clauses: "",
        parameters: "[]",
        logic: "",
        crossLinks: "[]",
        lifecycle: "[]",
        status: "draft",
      },
    });

    return NextResponse.json({ success: true, data: { id: node.id } });
  } catch (error) {
    console.error("创建节点失败:", error);
    return NextResponse.json({ success: false, error: "创建节点失败" }, { status: 500 });
  }
}
