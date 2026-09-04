/**
 * 智能专业建议引擎
 *
 * 三路数据融合，回答客户的实验建设问题：
 *   1) 规范依据  —— 内置规范库（lab-norms.ts）按关键词匹配条款
 *   2) 知识库资料 —— 客户/管理员喂入的已审核知识块（关键词计分检索）
 *   3) 行业数据   —— 平台自有的 117 类实验室参数 + 设备配置模板
 * 输出结构化的建议清单 + 汇总意见，每条建议均带来源引用。
 */
import { prisma } from './db';
import { matchNorms, NormMatch } from './lab-norms';

export interface AdviceItem {
  source: 'norm' | 'knowledge' | 'industry';
  sourceName: string;
  title: string;
  content: string;
  reference: string;
}

export interface AdviceResult {
  question: string;
  summary: string;
  items: AdviceItem[];
  stats: { normCount: number; knowledgeCount: number; industryCount: number };
}

/** 专业领域词表（用于补充检索词，提高召回） */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  '通风': ['排风', '换气', '补风', '风管'],
  '换气次数': ['排风', '通风'],
  '压差': ['负压', '正压', '洁净'],
  '气瓶': ['供气', '汇流排', '减压'],
  '管材': ['不锈钢管', '316L', '供气'],
  '电缆': ['配电', '负荷', '断路器'],
  '地面': ['地坪', '环氧', 'PVC'],
  '墙面': ['彩钢板', '围护', '装修'],
  '吊顶': ['彩钢板', '装修', '密封'],
  '监控': ['门禁', '智能化', '传感器'],
  '生物安全': ['BSL', '安全柜', '负压'],
  'PCR': ['洁净', '换气', '压差'],
};

/** 分词 + 同义词扩展 */
function buildTerms(question: string): string[] {
  const base = (question.match(/[\u4e00-\u9fa5]{2,8}|[A-Za-z][A-Za-z0-9-]{1,11}/g) || [])
    .filter((t) => t.length >= 2);
  const terms = new Set(base);
  for (const term of base) {
    for (const [key, syns] of Object.entries(DOMAIN_SYNONYMS)) {
      if (term.includes(key)) syns.forEach((s) => terms.add(s));
    }
  }
  return [...terms];
}

/** 知识块检索评分 */
function scoreChunk(content: string, keywords: string | null, terms: string[]): number {
  const kw = ` ${keywords || ''} `;
  let score = 0;
  for (const term of terms) {
    if (kw.includes(term)) score += 3;
    let idx = content.indexOf(term);
    let hits = 0;
    while (idx !== -1 && hits < 5) {
      score += 1;
      hits += 1;
      idx = content.indexOf(term, idx + term.length);
    }
  }
  return score;
}

/** 行业数据：按实验室类型名称匹配 */
async function matchLabTypes(terms: string[], take = 2) {
  const labTypes = await prisma.labType.findMany({ select: { id: true, typeName: true, cleanLevelDefault: true, pressureRequirement: true, tempHumidity: true, airChangesPerHour: true, illuminationLux: true } });
  const matched = labTypes.filter((lt) =>
    terms.some((term) => lt.typeName.includes(term) || term.includes(lt.typeName))
  );
  return matched.slice(0, take);
}

export async function buildAdvice(question: string): Promise<AdviceResult> {
  const terms = buildTerms(question);
  const items: AdviceItem[] = [];

  // ---------- 1) 规范依据 ----------
  const normMatches: NormMatch[] = matchNorms(question, 3, 2);
  for (const match of normMatches) {
    for (const clause of match.clauses) {
      items.push({
        source: 'norm',
        sourceName: '规范依据',
        title: `${match.doc.code}《${match.doc.title}》· ${clause.topic}`,
        content: clause.text,
        reference: match.doc.code,
      });
    }
  }

  // ---------- 2) 知识库资料（已审核） ----------
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { status: 'approved' },
    select: { id: true, content: true, keywords: true, file: { select: { title: true, category: true } } },
    orderBy: { id: 'desc' },
    take: 400,
  });
  const scored = chunks
    .map((c) => ({ ...c, score: scoreChunk(c.content, c.keywords, terms) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  for (const chunk of scored) {
    const snippet = chunk.content.length > 260 ? `${chunk.content.slice(0, 260)}…` : chunk.content;
    items.push({
      source: 'knowledge',
      sourceName: `知识库·${chunk.file?.category ?? '其他'}`,
      title: chunk.file?.title ?? '知识片段',
      content: snippet,
      reference: `喂养资料：${chunk.file?.title ?? '知识片段'}`,
    });
  }

  // ---------- 3) 行业数据（实验室类型参数 + 典型设备配置） ----------
  const labTypes = await matchLabTypes(terms);
  for (const lt of labTypes) {
    const templates = await prisma.equipmentTemplate.findMany({
      where: { labTypeId: lt.id },
      orderBy: [{ isRequired: 'desc' }, { sortOrder: 'asc' }],
      take: 6,
      select: { equipmentName: true, specification: true, unit: true, qtyPer100Area: true },
    });
    const equipText = templates
      .map((t) => `${t.equipmentName}（${t.specification}，每100㎡约${t.qtyPer100Area}${t.unit}）`)
      .join('；');
    items.push({
      source: 'industry',
      sourceName: '行业数据',
      title: `${lt.typeName} 行业配置参考`,
      content:
        `典型参数：洁净等级 ${lt.cleanLevelDefault}；换气次数 ${lt.airChangesPerHour} 次/h；` +
        `压差要求 ${lt.pressureRequirement}；温湿度 ${lt.tempHumidity}；照度 ${lt.illuminationLux}lx。` +
        (equipText ? `典型设备配置：${equipText}` : ''),
      reference: '平台实验室类型库 / 设备配置模板',
    });
  }

  // ---------- 汇总意见 ----------
  const stats = {
    normCount: items.filter((i) => i.source === 'norm').length,
    knowledgeCount: items.filter((i) => i.source === 'knowledge').length,
    industryCount: items.filter((i) => i.source === 'industry').length,
  };

  let summary: string;
  if (items.length === 0) {
    summary =
      '暂未从规范库和知识库中检索到与该问题直接相关的内容。' +
      '建议补充更具体的关键词（如：换气次数、压差、供气管材、地面材料等），' +
      '或在「资料喂养」中上传相关规范/案例文件，审核入库后即可参与建议生成。';
  } else {
    const firstNorm = items.find((i) => i.source === 'norm');
    const firstKnowledge = items.find((i) => i.source === 'knowledge');
    const firstIndustry = items.find((i) => i.source === 'industry');
    const parts: string[] = [];
    if (firstNorm) parts.push(`规范层面：${firstNorm.title}——${firstNorm.content}`);
    if (firstIndustry) parts.push(`行业参考：${firstIndustry.title}（${firstIndustry.content.slice(0, 80)}…）`);
    if (firstKnowledge) parts.push(`结合已喂入资料《${firstKnowledge.title}》中的实践经验`);
    parts.push(`共引用 ${stats.normCount} 条规范条款、${stats.knowledgeCount} 条知识库资料、${stats.industryCount} 组行业数据，详见下方分项建议。`);
    summary = parts.join(' ');
  }

  return { question, summary, items, stats };
}
