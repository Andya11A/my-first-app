import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AI_MODELS } from "@/lib/ai-models";

// 标准号归一化：去空格 + 全角字母数字转半角 + 全角斜杠转半角，避免 AI 输出写法差异
function normalizeStdNo(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/[０-９ａ-ｚＡ-Ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/／/g, "/");
}

// AI 输出常带年份后缀（GB 50073-2013、ISO 14644-1:2015、GB 50016-2014(2018版)），
// 生成渐进候选：原号 → 剥年份 → 再剥部分号（.1/-1），逐级尝试匹配台账
function stdNoCandidates(s: string): string[] {
  const k = normalizeStdNo(s);
  const noYear = k
    .replace(/[（(][^）)]*版[）)]$/, "")
    .replace(/[-—:：]?(19|20)\d{2}(版)?$/, "");
  const noPart = noYear.replace(/[.\-]\d{1,2}$/, "");
  return Array.from(new Set([k, noYear, noPart]));
}

const SYSTEM_PROMPT = `你是一位实验室工程EPC专家，从业15年，熟悉洁净室、实验室设计施工验收全流程。你为知识库生产结构化知识节点，每个节点都要达到工程级深度。

必须严格按JSON格式输出，不要输出任何markdown代码块或其他文字，只输出纯JSON：

{
  "summary": "L0 坐标确认：这个节点回答什么核心问题（1-2句）",
  "regulations": [{"standardNo": "标准号", "name": "标准名称", "versionStatus": "现行/需核实/已废止"}],
  "chapters": [{"standardNo": "标准号", "chapter": "章节号", "content": "该章节与本节点的关系"}],
  "clauses": "L3 条文内容。凡拿不准具体条文编号的，一律写⚠️原文待核，禁止编造具体条号",
  "parameters": [{"name": "参数名", "value": "数值或范围", "note": "备注或依据"}],
  "logic": "L5 工艺逻辑：为什么这么定，讲清物理/化学/合规原理",
  "crossLinks": [{"interface": "接口名", "parties": "涉及专业", "coupling": "如何协调"}],
  "lifecycle": [{"stage": "设计或施工或验收或运维", "points": "该阶段要点"}]
}

深度铁律（不达标就重写）：
1. 材质选型必须有横向对比，不许只列一种
2. 连接节点必须说清"材质与材质怎么连"：型材、密封胶、固定方式、间距
3. 跨专业接口必须说清"谁和谁碰头、怎么协调"
4. 施工细节精确到偏差值(mm)、间距(mm)、顺序
5. 验收细节精确到"测什么、怎么测、合格标准"
6. 至少埋3个"新手必错"的点
7. 标准版本拿不准一律标"需核实"，条文编号拿不准一律标"⚠️原文待核"
8. 宁缺毋假：不确定的内容明确写"需人工核实"，绝不编造
9. 版本状态一律以系统标准台账为准，禁止凭训练记忆标注版本号或状态`;

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
    const { nodeCode, industry, facilityType, environment, title, modelId = "deepseek", autoSubmitReview = false } = body;

    if (!nodeCode || !industry || !title) {
      return NextResponse.json({ success: false, error: "nodeCode、industry、title 必填" }, { status: 400 });
    }

    // 检查重复
    const existing = await prisma.knowledgeNode.findUnique({ where: { nodeCode } });
    if (existing) {
      return NextResponse.json({ success: false, error: `节点 ${nodeCode} 已存在` }, { status: 400 });
    }

    // 查询标准版本台账（用于生成后校验 L1 版本状态）
    const standardVersions = await prisma.standardVersion.findMany();
    // 归一化 key：去空格/全半角差异
    const versionMap = new Map(
      standardVersions.map((sv) => [normalizeStdNo(sv.standardNo), sv])
    );

    // 找模型配置
    const modelConfig = AI_MODELS.find((m) => m.id === modelId);
    if (!modelConfig) {
      return NextResponse.json({ success: false, error: "不支持的模型" }, { status: 400 });
    }
    const apiKey = process.env[modelConfig.apiKeyEnv];
    if (!apiKey) {
      return NextResponse.json({ success: false, error: `未配置 ${modelConfig.name} 的 API Key` }, { status: 500 });
    }

    const userPrompt = `请生成知识节点：

【节点编号】${nodeCode}
【行业】${industry}
【设施形态】${facilityType}
【工艺环境】${environment}
【节点标题】${title}`;

    // 调 AI
    const response = await fetch(modelConfig.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.modelName,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("生成节点AI调用失败:", err.slice(0, 500));
      return NextResponse.json({ success: false, error: "AI 调用失败" }, { status: 500 });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // 解析 JSON（容错：去掉可能的代码块包裹）
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // 尝试提取 JSON 块
      const match = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[1] || match[0]);
        } catch {
          return NextResponse.json({ success: false, error: "AI 返回的 JSON 解析失败，请重试" }, { status: 500 });
        }
      } else {
        return NextResponse.json({ success: false, error: "AI 返回格式异常，请重试" }, { status: 500 });
      }
    }

    // 后处理：把 AI 生成的 L1 版本状态强制与台账对齐
    if (Array.isArray(parsed.regulations)) {
      parsed.regulations = parsed.regulations.map((reg: {
        standardNo?: string;
        versionStatus?: string;
        [key: string]: unknown;
      }) => {
        if (!reg || !reg.standardNo) return reg;
        const std = stdNoCandidates(String(reg.standardNo))
          .map((key) => versionMap.get(key))
          .find((hit) => hit !== undefined);
        if (!std) {
          return { ...reg, versionStatus: "待核实（台账未收录）" };
        }
        if (std.status === "unknown") {
          return { ...reg, versionStatus: "需核实" };
        }
        if (std.status === "superseded") {
          return {
            ...reg,
            versionStatus: "已废止",
            ...(std.supersededBy ? { supersededBy: std.supersededBy } : {}),
          };
        }
        if (std.status === "current") {
          return { ...reg, versionStatus: "现行" };
        }
        return reg;
      });
    }

    // 写入数据库（默认 draft；autoSubmitReview=true 时直接进入待审核 review）
    const node = await prisma.knowledgeNode.create({
      data: {
        nodeCode,
        industry,
        facilityType: facilityType || "",
        environment: environment || "",
        title,
        summary: parsed.summary || "",
        regulations: JSON.stringify(parsed.regulations || []),
        chapters: JSON.stringify(parsed.chapters || []),
        clauses: parsed.clauses || "",
        parameters: JSON.stringify(parsed.parameters || []),
        logic: parsed.logic || "",
        crossLinks: JSON.stringify(parsed.crossLinks || []),
        lifecycle: JSON.stringify(parsed.lifecycle || []),
        status: autoSubmitReview ? "review" : "draft",
        source: "system",
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: node.id, nodeCode: node.nodeCode, status: node.status },
    });
  } catch (error) {
    console.error("生成节点失败:", error);
    return NextResponse.json({ success: false, error: "生成节点失败" }, { status: 500 });
  }
}
