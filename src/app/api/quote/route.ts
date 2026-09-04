import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateQuote } from '@/lib/calculator';
import { prisma } from '@/lib/db';
import { syncQuoteToKnowledge } from '@/lib/knowledge-sync';

const QuoteRequestSchema = z.object({
  projectName: z.string().min(1, '项目名称不能为空').max(200),
  labTypeId: z.number().int().positive('请选择实验室类型'),
  area: z.number().positive('面积必须大于0').max(10000, '面积不能超过10000㎡'),
  cleanLevel: z.string().min(1, '请选择洁净等级'),
  budgetLevel: z.string().min(1, '请选择报价档位'),
  specialRequirements: z.string().max(2000).optional(),
  createdById: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = QuoteRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues
        .map((issue) => issue.message)
        .join('；');
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

    const result = await generateQuote(parseResult.data);

    const project = await prisma.project.create({
      data: {
        projectName: parseResult.data.projectName,
        labTypeId: parseResult.data.labTypeId,
        area: parseResult.data.area,
        cleanLevel: parseResult.data.cleanLevel,
        budgetLevel: parseResult.data.budgetLevel,
        specialRequirements: parseResult.data.specialRequirements ?? null,
        createdById: parseResult.data.createdById ?? null,
        generatedJson: JSON.stringify(result),
      },
    });

    // 异步后台沉淀到知识库（不阻塞响应）
    syncQuoteToKnowledge(result, project.id).catch((e) => console.error('知识沉淀失败:', e));

    return NextResponse.json({
      success: true,
      data: {
        quote: result,
        projectId: project.id,
      },
    });
  } catch (error) {
    console.error('生成报价失败:', error);
    const message = error instanceof Error ? error.message : '生成报价失败';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
