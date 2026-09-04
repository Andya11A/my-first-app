/**
 * 知识喂养 —— 文件解析库（服务端）
 *
 * 支持格式：xlsx / xls / csv（SheetJS）、docx（mammoth）、pdf（pdf-parse）、txt / md
 * 输出：统一的知识块（chunk）列表，每块约 600 字符，附带提取的关键词，
 *       作为 KnowledgeChunk 落库，供智能建议引擎检索。
 */
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const SUPPORTED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'docx', 'pdf', 'txt', 'md'] as const;

export interface ParsedChunk {
  content: string;
}

export interface ParseResult {
  chunks: ParsedChunk[];
  summary: {
    fileType: string;
    chunkCount: number;
    sheetCount?: number;
    rowCount?: number;
    paragraphCount?: number;
    wordCount?: number;
  };
}

/** 常见虚词停用表（关键词提取时剔除） */
const STOPWORDS = new Set([
  '的', '了', '和', '是', '在', '与', '及', '或', '对', '由', '从', '为', '以', '于',
  '可以', '应当', '需要', '通过', '进行', '按照', '根据', '对于', '关于', '以下', '以上',
  '我们', '他们', '要求', '规定', '采用', '不得', '不应', '并且', '同时', '以及', '或者',
  '一个', '使用', '相关', '其他', '包括', '其中', '之间', '每个', '各种', '不同',
]);

/** 从文本中提取高频词作为检索关键词（中文 2~8 字 / 英文 2~12 字母） */
export function extractKeywords(text: string, topN = 8): string {
  const tokens = text.match(/[\u4e00-\u9fa5]{2,8}|[A-Za-z][A-Za-z0-9-]{1,11}/g) || [];
  const freq = new Map<string, number>();
  for (const raw of tokens) {
    const token = raw.trim();
    if (token.length < 2 || STOPWORDS.has(token)) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w)
    .join(' ');
}

/** 把长文本切成 ~size 字符的知识块（按段落聚合，避免硬截断句子） */
function chunkText(text: string, size = 600): string[] {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if (current && (current.length + para.length > size)) {
      chunks.push(current);
      current = '';
    }
    // 单段超长时硬切
    if (para.length > size * 1.5) {
      for (let i = 0; i < para.length; i += size) {
        chunks.push(para.slice(i, i + size));
      }
    } else {
      current = current ? `${current}\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Excel / CSV：每个 sheet 按 15 行聚合为一块，保留表头上下文 */
function parseSpreadsheet(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', codepage: 936 });
  const chunks: ParsedChunk[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: '',
    });
    totalRows += rows.length;
    const header = rows[0]?.map((c) => String(c)).filter(Boolean).join(' | ') || '';

    for (let start = 0; start < rows.length; start += 15) {
      const batch = rows.slice(start, start + 15);
      const lines = batch
        .map((row) => row.map((c) => String(c ?? '')).filter(Boolean).join(' | '))
        .filter(Boolean);
      if (!lines.length) continue;
      const content =
        `【${sheetName}】第${start + 1}-${start + batch.length}行` +
        (header ? `\n表头: ${header}` : '') +
        `\n${lines.join('\n')}`;
      chunks.push({ content });
    }
  }

  return {
    chunks,
    summary: { fileType: 'spreadsheet', chunkCount: chunks.length, sheetCount: workbook.SheetNames.length, rowCount: totalRows },
  };
}

/** Word (docx)：提取纯文本后按段落分块 */
async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const { value } = await mammoth.extractRawText({ buffer });
  const textChunks = chunkText(value);
  const chunks = textChunks.map((content) => ({ content }));
  return {
    chunks,
    summary: { fileType: 'docx', chunkCount: chunks.length, wordCount: value.length },
  };
}

/** PDF：提取文本后分块 */
async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const result = await pdfParse(buffer);
  const textChunks = chunkText(result.text);
  const chunks = textChunks.map((content) => ({ content }));
  return {
    chunks,
    summary: { fileType: 'pdf', chunkCount: chunks.length, wordCount: result.text.length },
  };
}

/** txt / md：按段落分块 */
function parsePlainText(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf-8');
  const textChunks = chunkText(text);
  const chunks = textChunks.map((content) => ({ content }));
  return {
    chunks,
    summary: { fileType: 'text', chunkCount: chunks.length, wordCount: text.length },
  };
}

/** 按扩展名解析文件（入口） */
export async function parseKnowledgeFile(buffer: Buffer, fileName: string): Promise<ParseResult> {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'xlsx':
    case 'xls':
    case 'csv':
      return parseSpreadsheet(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'pdf':
      return parsePdf(buffer);
    case 'txt':
    case 'md':
      return parsePlainText(buffer);
    default:
      throw new Error(`暂不支持 .${ext} 格式，请上传 ${SUPPORTED_EXTENSIONS.join(' / ')} 文件`);
  }
}

/** 文件名安全化（保留中文，去除路径与非法字符） */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(-120) || 'unnamed';
}
