import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { prisma } from '@/lib/db';
import type { QuoteResult } from '@/lib/types';

const CELL_SIZE = 21;

function h1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
  });
}

function para(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 22 })],
    spacing: { after: 100 },
  });
}

function cell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: CELL_SIZE })],
      }),
    ],
  });
}

function makeTable(header: string[], rows: (string | number)[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: header.map((t) => cell(t, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((v) => cell(String(v))) })),
    ],
  });
}

function money(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN')}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json(
        { success: false, error: '无效的项目ID' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return NextResponse.json(
        { success: false, error: '项目不存在' },
        { status: 404 }
      );
    }

    const quote: QuoteResult = JSON.parse(project.generatedJson);
    const p = quote.labTypeParams;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: '实验室建设方案书', bold: true, size: 52 }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 2400, after: 480 },
            }),
            new Paragraph({
              children: [new TextRun({ text: quote.projectName, bold: true, size: 32 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 240 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `生成日期：${new Date(quote.generatedAt).toLocaleDateString('zh-CN')}`,
                  size: 22,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '', pageBreakBefore: true }),

            h1('一、项目概况'),
            para(`项目名称：${quote.projectName}`),
            para(`实验室类型：${quote.labTypeName}`),
            para(`建筑面积：${quote.area} ㎡`),
            para(`洁净等级：${quote.cleanLevel}`),
            para(`预算档位：${quote.budgetLevel}`),
            quote.specialRequirements
              ? para(`特殊要求：${quote.specialRequirements}`)
              : para('特殊要求：无'),

            h1('二、设计参数'),
            para(`洁净等级默认值：${p.cleanLevelDefault}`),
            para(`压差要求：${p.pressureRequirement}`),
            para(`温湿度要求：${p.tempHumidity}`),
            para(`换气次数：${p.airChangesPerHour} 次/h`),
            para(`照度要求：${p.illuminationLux} lx`),
            p.notes ? para(`设计要点：${p.notes}`) : para('设计要点：无'),

            h1('三、设备清单'),
            makeTable(
              ['序号', '设备名称', '规格', '单位', '数量', '单价', '小计', '必配'],
              quote.equipmentList.map((e, i) => [
                i + 1,
                e.equipmentName,
                e.specification,
                e.unit,
                e.quantity,
                money(e.unitPrice),
                money(e.subtotal),
                e.isRequired ? '是' : '否',
              ])
            ),
            para(`设备合计：${money(quote.equipmentTotal)}`, true),

            h1('四、工程量清单'),
            ...quote.constructionByCategory.map((c) =>
              para(`${c.category}小计：${money(c.subtotal)}`)
            ),
            makeTable(
              ['序号', '工程项目', '类别', '单位', '数量', '单价', '小计'],
              quote.constructionList.map((c, i) => [
                i + 1,
                c.itemName,
                c.category,
                c.unit,
                c.quantity,
                money(c.unitPrice),
                money(c.subtotal),
              ])
            ),
            para(`工程合计：${money(quote.constructionTotal)}`, true),

            h1('五、报价汇总'),
            para(`设备合计：${money(quote.equipmentTotal)}`),
            para(`工程合计：${money(quote.constructionTotal)}`),
            para(`管理费：${money(quote.managementFee)}`),
            para(`利润：${money(quote.profit)}`),
            para(`项目总价：${money(quote.grandTotal)}`, true),

            new Paragraph({ text: '', spacing: { after: 160 } }),
            makeTable(
              ['档位', '设备', '工程', '管理费', '利润', '总价'],
              quote.quoteComparison.map((c) => [
                c.levelName,
                money(c.equipmentTotal),
                money(c.constructionTotal),
                money(c.managementFee),
                money(c.profit),
                money(c.grandTotal),
              ])
            ),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = encodeURIComponent(`${quote.projectName}-方案书.docx`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (error) {
    console.error('导出方案书失败:', error);
    return NextResponse.json(
      { success: false, error: '导出方案书失败' },
      { status: 500 }
    );
  }
}
