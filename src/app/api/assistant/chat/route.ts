import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AI_MODELS } from '@/lib/ai-models';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { autoSaveKnowledge } from '@/lib/auto-save-knowledge';

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
    const { question, history = [], modelId = 'deepseek' } = body;

    if (!question?.trim()) {
      return NextResponse.json({ success: false, error: '请输入问题' }, { status: 400 });
    }

    const modelConfig = AI_MODELS.find((m) => m.id === modelId);
    if (!modelConfig) {
      return NextResponse.json({ success: false, error: '不支持的模型' }, { status: 400 });
    }

    const apiKey = process.env[modelConfig.apiKeyEnv];
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `未配置 ${modelConfig.name} 的 API Key` },
        { status: 500 }
      );
    }

    // 洁净EPC垂直工程师助理人设（移植自朋友项目 prompts.py，保留多模型切换能力）
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map((h: { role: string; content: string }) => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: question },
    ];

    const response = await fetch(modelConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.modelName,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`${modelConfig.name} API 错误:`, errorData);
      return NextResponse.json(
        { success: false, error: `${modelConfig.name} 调用失败，请检查 Key 或稍后重试` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || '未获取到回答';

    if (answer && answer !== '未获取到回答') {
      autoSaveKnowledge(question, answer).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: { answer, model: modelConfig.modelName, modelName: modelConfig.name },
    });
  } catch (error) {
    console.error('AI 问答失败:', error);
    return NextResponse.json({ success: false, error: 'AI 问答失败' }, { status: 500 });
  }
}
