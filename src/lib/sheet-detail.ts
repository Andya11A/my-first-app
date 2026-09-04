import { prisma } from '@/lib/db';

// 72 Sheet 全景视图共享逻辑：SPEC 节点分组解析 + 单 Sheet 数据查询

// SPEC 节点 parameters 实际格式：[{"index":1,"sheet":"喷淋系统"},...]
export function parseSheets(nodeCode: string, parameters: string | null): string[] {
  try {
    const parsed = JSON.parse(parameters || '[]');
    if (Array.isArray(parsed)) {
      return parsed.map((item: { sheet?: string }) => item.sheet).filter((s): s is string => Boolean(s));
    }
  } catch { /* ignore */ }
  return [];
}

export interface SheetGroup {
  professionalField: string;
  nodeCode: string;
  sheets: string[];
}

// 获取所有 SPEC 节点（nodeCode 以 SPEC- 开头），解析出专业领域 → Sheet 列表
export async function getSheetGroups(): Promise<SheetGroup[]> {
  const specNodes = await prisma.knowledgeNode.findMany({
    where: { nodeCode: { startsWith: 'SPEC-' } },
    select: { nodeCode: true, title: true, parameters: true },
    orderBy: { nodeCode: 'asc' },
  });
  return specNodes.map((node) => ({
    professionalField: node.title || node.nodeCode,
    nodeCode: node.nodeCode,
    sheets: parseSheets(node.nodeCode, node.parameters),
  }));
}

// 单个 Sheet 的关联数据：标准 + 选型参数 + 施工工艺（关键词模糊匹配）
// Sheet 名常带后缀（"喷淋系统"/"防排烟系统"），直接 contains 会漏掉"喷淋喷头"等短词数据，
// 故生成候选词：原词 + 剥离常见后缀（系统/工程/管理/控制/工程），多词联合匹配
export async function getSheetDetail(sheetName: string) {
  const terms = [sheetName];
  const stripped = sheetName.replace(/(系统|工程|管理|控制|确认|认证)$/, '');
  if (stripped && stripped !== sheetName) terms.push(stripped);

  const stdWhere = { OR: terms.flatMap((t) => ([
    { name: { contains: t } },
    { keywords: { contains: t } },
    { industry: { contains: t } },
    { scope: { contains: t } },
  ])) };
  const cfgWhere = { OR: terms.flatMap((t) => ([
    { industry: { contains: t } },
    { paramKey: { contains: t } },
    { reference: { contains: t } },
    { systemCategory: { contains: t } },
  ])) };
  const procWhere = { OR: terms.flatMap((t) => ([
    { processName: { contains: t } },
    { category: { contains: t } },
    { qualityStd: { contains: t } },
  ])) };

  const [standards, configs, processes] = await Promise.all([
    prisma.standard.findMany({ where: stdWhere, orderBy: { priority: 'desc' } }),
    prisma.industryConfig.findMany({ where: cfgWhere, orderBy: { priority: 'desc' } }),
    prisma.processFlow.findMany({ where: procWhere }),
  ]);
  return { sheetName, standards, configs, processes };
}
