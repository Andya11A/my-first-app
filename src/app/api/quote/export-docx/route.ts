import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const projectId = Number(request.nextUrl.searchParams.get('projectId'));
    if (!projectId) {
      return NextResponse.json({ success: false, error: '缺少项目ID' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        labType: { select: { typeName: true } },
        createdBy: { select: { realName: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    // 解析报价数据
    const quote = JSON.parse(project.generatedJson);

    // 构建 Word 文档
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // ========== 封面 ==========
          new Paragraph({ text: '', spacing: { before: 2000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: project.projectName, bold: true, size: 48, font: '黑体' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '实验室建设方案书', bold: true, size: 36, font: '黑体' })],
            spacing: { before: 400 },
          }),
          new Paragraph({ text: '', spacing: { before: 1000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${quote.labTypeName}  |  ${project.area}㎡  |  ${project.cleanLevel}`, size: 24, font: '宋体' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `编制日期：${new Date().toLocaleDateString('zh-CN')}`, size: 24, font: '宋体' })],
            spacing: { before: 200 },
          }),
          new Paragraph({ text: '', pageBreakBefore: true }),

          // ========== 一、项目概述 ==========
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: '一、项目概述', bold: true, size: 28, font: '黑体' })],
          }),
          new Paragraph({ text: `项目名称：${project.projectName}`, spacing: { before: 200 } }),
          new Paragraph({ text: `实验室类型：${quote.labTypeName}` }),
          new Paragraph({ text: `建筑面积：${project.area} ㎡` }),
          new Paragraph({ text: `洁净等级：${project.cleanLevel}` }),
          new Paragraph({ text: `预算档位：${project.budgetLevel}` }),
          ...(project.specialRequirements ? [new Paragraph({ text: `特殊要求：${project.specialRequirements}` })] : []),
          new Paragraph({ text: `编制人：${project.createdBy?.realName || '—'}`, spacing: { before: 200 } }),

          // ========== 二、设计依据 ==========
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: '二、设计依据', bold: true, size: 28, font: '黑体' })],
            spacing: { before: 400 },
          }),
          new Paragraph({ text: '1. GB 50346-2011《生物安全实验室建筑技术规范》' }),
          new Paragraph({ text: '2. GB 19489-2008《实验室 生物安全通用要求》' }),
          new Paragraph({ text: '3. JGJ 91-2019《科研建筑设计标准》' }),
          new Paragraph({ text: '4. GB 50073-2013《洁净厂房设计规范》' }),
          new Paragraph({ text: '5. 客户提供的设计需求及现场条件' }),

          // ========== 三、设计参数 ==========
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: '三、设计参数', bold: true, size: 28, font: '黑体' })],
            spacing: { before: 400 },
          }),
          new Paragraph({ text: `压差要求：${quote.labTypeParams?.pressureRequirement || '—'}`, spacing: { before: 200 } }),
          new Paragraph({ text: `温湿度要求：${quote.labTypeParams?.tempHumidity || '—'}` }),
          new Paragraph({ text: `换气次数：${quote.labTypeParams?.airChangesPerHour || '—'} 次/h` }),
          new Paragraph({ text: `照度要求：${quote.labTypeParams?.illuminationLux || '—'} lux` }),
          ...(quote.labTypeParams?.notes ? [new Paragraph({ text: `设计要点：${quote.labTypeParams.notes}` })] : []),

          // ========== 四、设备清单 ==========
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: '四、设备清单', bold: true, size: 28, font: '黑体' })],
            spacing: { before: 400 },
          }),
          ...buildEquipmentTable(quote.equipmentList || []),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `设备总价：¥${formatMoney(quote.equipmentTotal || 0)}`, bold: true, size: 22 })],
            spacing: { before: 200 },
          }),

          // ========== 五、工程量清单 ==========
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: '五、工程量清单', bold: true, size: 28, font: '黑体' })],
            spacing: { before: 400 },
          }),
          ...buildConstructionTable(quote.constructionList || []),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `工程量总价：¥${formatMoney(quote.constructionTotal || 0)}`, bold: true, size: 22 })],
            spacing: { before: 200 },
          }),

          // ========== 六、报价汇总 ==========
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: '六、报价汇总', bold: true, size: 28, font: '黑体' })],
            spacing: { before: 400 },
          }),
          new Paragraph({ text: `设备总价：¥${formatMoney(quote.equipmentTotal || 0)}`, spacing: { before: 200 } }),
          new Paragraph({ text: `工程量总价：¥${formatMoney(quote.constructionTotal || 0)}` }),
          new Paragraph({ text: `管理费：¥${formatMoney(quote.managementFee || 0)}` }),
          new Paragraph({ text: `利润：¥${formatMoney(quote.profit || 0)}` }),
          new Paragraph({
            children: [new TextRun({ text: `最终报价：¥${formatMoney(quote.grandTotal || 0)}`, bold: true, size: 24 })],
            spacing: { before: 200 },
          }),
          ...(quote.quoteComparison?.length ? [
            new Paragraph({
              children: [new TextRun({ text: '三档报价对比：', bold: true })],
              spacing: { before: 300 },
            }),
            ...quote.quoteComparison.map((q: { levelName: string; grandTotal: number }) =>
              new Paragraph({ text: `${q.levelName}：¥${formatMoney(q.grandTotal)}` })
            ),
          ] : []),

          // ========== 七、实施计划 ==========
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: '七、实施计划', bold: true, size: 28, font: '黑体' })],
            spacing: { before: 400 },
          }),
          new Paragraph({ text: '1. 方案确认：3个工作日', spacing: { before: 200 } }),
          new Paragraph({ text: '2. 施工图深化设计：7个工作日' }),
          new Paragraph({ text: '3. 材料采购与加工：15个工作日' }),
          new Paragraph({ text: '4. 现场施工：20-30个工作日' }),
          new Paragraph({ text: '5. 调试与验收：5个工作日' }),

          // ========== 八、售后服务 ==========
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: '八、售后服务承诺', bold: true, size: 28, font: '黑体' })],
            spacing: { before: 400 },
          }),
          new Paragraph({ text: '1. 质保期内免费维修，终身维护', spacing: { before: 200 } }),
          new Paragraph({ text: '2. 设备安装调试后提供操作培训' }),
          new Paragraph({ text: '3. 定期回访，及时响应维修需求' }),
          new Paragraph({ text: '4. 提供完整的技术资料和图纸' }),
        ],
      }],
    });

    // 生成 buffer
    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(project.projectName + '-方案书.docx')}`,
      },
    });
  } catch (error) {
    console.error('导出方案书失败:', error);
    return NextResponse.json(
      { success: false, error: '导出失败' },
      { status: 500 }
    );
  }
}

// ========== 辅助函数 ==========

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildEquipmentTable(equipmentList: { equipmentName: string; specification: string; unit: string; quantity: number; unitPrice: number; subtotal: number }[]) {
  const rows = [
    new TableRow({
      children: [
        createHeaderCell('序号'),
        createHeaderCell('设备名称'),
        createHeaderCell('规格型号'),
        createHeaderCell('数量'),
        createHeaderCell('单价（元）'),
        createHeaderCell('小计（元）'),
      ],
    }),
    ...equipmentList.map((item, index) =>
      new TableRow({
        children: [
          createCell(String(index + 1)),
          createCell(item.equipmentName),
          createCell(item.specification || '—'),
          createCell(`${item.quantity}${item.unit}`),
          createCell(formatMoney(item.unitPrice)),
          createCell(formatMoney(item.subtotal)),
        ],
      })
    ),
  ];

  return [
    new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ];
}

function buildConstructionTable(constructionList: { itemName: string; category: string; unit: string; quantity: number; unitPrice: number; subtotal: number }[]) {
  const rows = [
    new TableRow({
      children: [
        createHeaderCell('序号'),
        createHeaderCell('项目名称'),
        createHeaderCell('分类'),
        createHeaderCell('工程量'),
        createHeaderCell('单价（元）'),
        createHeaderCell('小计（元）'),
      ],
    }),
    ...constructionList.map((item, index) =>
      new TableRow({
        children: [
          createCell(String(index + 1)),
          createCell(item.itemName),
          createCell(item.category || '—'),
          createCell(`${item.quantity}${item.unit}`),
          createCell(formatMoney(item.unitPrice)),
          createCell(formatMoney(item.subtotal)),
        ],
      })
    ),
  ];

  return [
    new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ];
}

function createHeaderCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
    shading: { fill: 'E8EEF7' },
  });
}

function createCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, size: 18 })], alignment: AlignmentType.CENTER })],
  });
}
