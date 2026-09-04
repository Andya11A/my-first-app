import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateQuote } from "@/lib/calculator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);

    if (!projectId || isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: "无效的项目ID" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        labType: {
          select: { typeName: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "项目不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("获取项目详情失败:", error);
    return NextResponse.json(
      { success: false, error: "获取项目详情失败" },
      { status: 500 }
    );
  }
}

const UpdateSchema = z.object({
  projectName: z.string().min(1, '项目名称不能为空').max(200).optional(),
  labTypeId: z.number().int().positive('请选择实验室类型').optional(),
  area: z.number().positive('面积必须大于0').max(10000, '面积不能超过10000㎡').optional(),
  cleanLevel: z.string().min(1, '请选择洁净等级').optional(),
  budgetLevel: z.string().min(1, '请选择报价档位').optional(),
  specialRequirements: z.string().max(2000).nullable().optional(),
  preciseQuoteJson: z.string().nullable().optional(), // 精确报价结果JSON快照（附加产物，任何状态可存）
  regenerate: z.boolean().optional(),
});

// 可编辑/可删除的状态
const EDITABLE_STATUSES = ['draft', 'rejected'];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const projectId = Number(id);
    if (!projectId || isNaN(projectId)) {
      return NextResponse.json({ success: false, error: '无效的项目ID' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    // 权限：创建人或 all 权限
    if (user.dataScope !== 'all' && project.createdById !== user.id) {
      return NextResponse.json({ success: false, error: '无权操作此项目' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      const errMsg = parsed.error.issues.map((i) => i.message).join('；');
      return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
    }

    const { regenerate, preciseQuoteJson, ...fields } = parsed.data;
    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    // 是否仅保存报价快照（附加产物，不涉及项目核心信息变更）
    const quoteOnly = preciseQuoteJson !== undefined &&
      Object.keys(cleanFields).length === 0 && !regenerate;

    // 状态守卫：仅草稿/已驳回可编辑核心字段；报价快照任何状态均可保存
    if (!EDITABLE_STATUSES.includes(project.status) && !quoteOnly) {
      return NextResponse.json(
        { success: false, error: '当前状态不可编辑（仅草稿/已驳回可编辑）' },
        { status: 400 }
      );
    }

    if (Object.keys(cleanFields).length === 0 && !regenerate && preciseQuoteJson === undefined) {
      return NextResponse.json({ success: false, error: '没有需要更新的内容' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...cleanFields };

    // 保存精确报价快照（传入 null 表示清除）
    if (preciseQuoteJson !== undefined) {
      updateData.preciseQuoteJson = preciseQuoteJson;
    }

    // 重新计算报价
    if (regenerate) {
      const merged = {
        projectName: (cleanFields.projectName as string) ?? project.projectName,
        labTypeId: (cleanFields.labTypeId as number) ?? project.labTypeId,
        area: (cleanFields.area as number) ?? Number(project.area),
        cleanLevel: (cleanFields.cleanLevel as string) ?? project.cleanLevel,
        budgetLevel: (cleanFields.budgetLevel as string) ?? project.budgetLevel,
        specialRequirements:
          (cleanFields.specialRequirements as string | null | undefined) ??
          project.specialRequirements ??
          undefined,
      };
      const quote = await generateQuote(merged);
      updateData.generatedJson = JSON.stringify(quote);
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新项目失败:', error);
    return NextResponse.json({ success: false, error: '更新项目失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const projectId = Number(id);
    if (!projectId || isNaN(projectId)) {
      return NextResponse.json({ success: false, error: '无效的项目ID' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    // 权限：创建人或 all 权限
    if (user.dataScope !== 'all' && project.createdById !== user.id) {
      return NextResponse.json({ success: false, error: '无权操作此项目' }, { status: 403 });
    }

    // 状态守卫：仅草稿/已驳回可删除
    if (!EDITABLE_STATUSES.includes(project.status)) {
      return NextResponse.json(
        { success: false, error: '当前状态不可删除（仅草稿/已驳回可删除）' },
        { status: 400 }
      );
    }

    // 先删审批记录再删项目（审批表对项目是必需关系）
    await prisma.$transaction([
      prisma.approval.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除项目失败:', error);
    return NextResponse.json({ success: false, error: '删除项目失败' }, { status: 500 });
  }
}
