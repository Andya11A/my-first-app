import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 获取节点完整七层详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const node = await prisma.knowledgeNode.findUnique({
      where: { id: Number(id) },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: "节点不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: node });
  } catch (error) {
    console.error("获取节点详情失败:", error);
    return NextResponse.json({ success: false, error: "获取节点详情失败" }, { status: 500 });
  }
}

// 更新节点内容（七层字段）或状态流转
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    if (user.roleCode !== "super_admin" && user.roleCode !== "admin") {
      return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const updatableFields = [
      "industry", "facilityType", "environment", "title", "summary",
      "regulations", "chapters", "clauses", "parameters", "logic",
      "crossLinks", "lifecycle", "status", "moduleCode",
    ];

    const data: Record<string, unknown> = {};
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    // 状态流转合法性校验
    if (data.status !== undefined) {
      const validStatuses = ["draft", "review", "verified"];
      if (!validStatuses.includes(data.status as string)) {
        return NextResponse.json({ success: false, error: "无效的状态" }, { status: 400 });
      }
    }

    const node = await prisma.knowledgeNode.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json({ success: true, data: { id: node.id, status: node.status } });
  } catch (error) {
    console.error("更新节点失败:", error);
    return NextResponse.json({ success: false, error: "更新节点失败" }, { status: 500 });
  }
}

// 删除节点
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    if (user.roleCode !== "super_admin" && user.roleCode !== "admin") {
      return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.knowledgeNode.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除节点失败:", error);
    return NextResponse.json({ success: false, error: "删除节点失败" }, { status: 500 });
  }
}
