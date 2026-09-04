// 解析库类型声明（mammoth / pdf-parse 无官方 npm 类型）
declare module 'mammoth' {
  export interface ExtractResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function extractRawText(input: { buffer: Buffer }): Promise<ExtractResult>;
  export function convertToHtml(input: { buffer: Buffer }): Promise<ExtractResult>;
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
