export interface AIModelConfig {
  id: string;
  name: string;
  apiUrl: string;
  modelName: string;
  apiKeyEnv: string;
}

export const AI_MODELS: AIModelConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  {
    id: 'glm',
    name: '智谱GLM-4',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    modelName: 'glm-4-flash',
    apiKeyEnv: 'GLM_API_KEY',
  },
  {
    id: 'qianfan',
    name: '文心一言',
    apiUrl: 'https://qianfan.baidubce.com/v2/chat/completions',
    modelName: 'ernie-speed-pro-128k',
    apiKeyEnv: 'QIANFAN_API_KEY',
  },
  {
    id: 'doubao',
    name: '豆包',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    modelName: 'ep-20260901113313-rdlfl',
    apiKeyEnv: 'DOUBAO_API_KEY',
  },
  {
    id: 'qwen',
    name: '通义千问',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    modelName: 'qwen-turbo',
    apiKeyEnv: 'QWEN_API_KEY',
  },
];
