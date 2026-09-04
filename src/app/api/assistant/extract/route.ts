import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AI_MODELS } from '@/lib/ai-models';
import { EXTRACT_SYSTEM_PROMPT } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      return NextResponse.json({ success: false, error: '无权使用' }, { status: 403 });
    }

    const body = await request.json();
    const { text, modelIds = ['deepseek'], extractType = 'summary' } = body;

    if (!text || text.trim().length < 50) {
      return NextResponse.json({ success: false, error: '文本内容太短，无法提炼' }, { status: 400 });
    }

    const maxLength = 30000;
    const truncatedText = text.length > maxLength ? text.slice(0, maxLength) + '\n...(内容已截断)' : text;

    // 构建提示词
    let prompt = '';
    if (extractType === 'summary') {
      prompt = `请对以下文档内容进行专业提炼总结，输出格式：

【核心要点】
1. （每条不超过30字，提炼5-8条最重要的内容）

【关键数据】
| 项目 | 数据/要求 | 说明 |
|------|----------|------|
（提取文档中的关键数字、参数、标准值，最多10行）

【适用场景】
（说明这些知识适用于哪些实验室类型或工程场景）

【规范条款】
（如果有引用标准编号，列出具体条款号和内容）

文档内容如下：
${truncatedText}`;
    } else if (extractType === 'equipment') {
      prompt = `请从以下文档中提取所有设备相关信息，输出格式：

【设备清单】
| 设备名称 | 规格/型号 | 数量 | 价格(如有) | 备注 |
|---------|----------|------|-----------|------|

【设备技术要求】
（列出文档中对设备的技术参数要求）

文档内容如下：
${truncatedText}`;
    } else if (extractType === 'construction') {
      prompt = `请从以下文档中提取所有工程量相关信息，输出格式：

【工程量清单】
| 项目 | 单位 | 数量 | 单价(如有) | 说明 |
|------|------|------|-----------|------|

【施工要求】
（列出文档中的施工工艺和技术要求）

文档内容如下：
${truncatedText}`;
    } else {
      prompt = `请对以下文档内容进行专业提炼总结，输出核心要点、关键数据和适用场景。\n\n文档内容如下：\n${truncatedText}`;
    }

    const messages = [
      // 洁净EPC专业视角（移植自朋友项目 prompts.py）：优先提取洁净等级/压差/换气次数等参数，规范编号不编造
      { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    const results = [];

    for (const modelId of modelIds) {
      const modelConfig = AI_MODELS.find((m) => m.id === modelId);
      if (!modelConfig) continue;

      const apiKey = process.env[modelConfig.apiKeyEnv];
      if (!apiKey) {
        results.push({
          modelId,
          modelName: modelConfig.name,
          success: false,
          error: `未配置 ${modelConfig.name} 的 API Key`,
        });
        continue;
      }

      try {
        const response = await fetch(modelConfig.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelConfig.modelName,
            messages,
            temperature: 0.3,
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          results.push({
            modelId,
            modelName: modelConfig.name,
            success: false,
            error: `${modelConfig.name} 调用失败`,
          });
          continue;
        }

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content || '未获取到提炼结果';
        results.push({
          modelId,
          modelName: modelConfig.name,
          success: true,
          result,
        });
      } catch {
        results.push({
          modelId,
          modelName: modelConfig.name,
          success: false,
          error: `${modelConfig.name} 调用异常`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { results, extractType },
    });
  } catch (error) {
    console.error('知识提炼失败:', error);
    return NextResponse.json({ success: false, error: '知识提炼失败' }, { status: 500 });
  }
}
