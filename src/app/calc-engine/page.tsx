"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CALC_MODULES, ADVANCED_MODULES, CalcModuleConfig, FieldConfig } from "@/lib/calc-modules-config";

export default function CalcEnginePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activeModule, setActiveModule] = useState<CalcModuleConfig | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jsonInput, setJsonInput] = useState('{}');
  const [jsonMode, setJsonMode] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && CALC_MODULES.length > 0) {
      switchModule(CALC_MODULES[0]);
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  function switchModule(module: CalcModuleConfig) {
    setActiveModule(module);
    setResult(null);
    setError('');
    // 初始化表单默认值
    const defaults: Record<string, any> = {};
    for (const field of module.fields) {
      defaults[field.key] = field.default ?? '';
    }
    setFormValues(defaults);
  }

  function handleFieldChange(key: string, value: any) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function buildJsonFromForm(): any {
    const result: Record<string, any> = {};
    for (const field of activeModule!.fields) {
      const v = formValues[field.key];
      // 空值字段不发送（可选字段走后端默认/自动取值，如焓湿计算大气压"自动（按城市季节）"）
      if (v === '' || v === undefined || v === null) continue;
      result[field.key] = v;
    }
    return result;
  }

  async function handleCalc() {
    if (!activeModule) return;
    setCalculating(true);
    setError('');
    setResult(null);

    try {
      let params: any;
      if (jsonMode) {
        try {
          params = JSON.parse(jsonInput);
        } catch {
          setError('JSON格式错误');
          setCalculating(false);
          return;
        }
      } else {
        params = buildJsonFromForm();
      }

      const url = `${process.env.NEXT_PUBLIC_CALC_ENGINE_URL}${activeModule.endpoint}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setError('无法连接计算引擎服务，请确认已启动');
    } finally {
      setCalculating(false);
    }
  }

  function renderField(field: FieldConfig) {
    const value = formValues[field.key];

    switch (field.type) {
      case 'number':
        return (
          <div key={field.key} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.description && <span className="text-xs text-gray-400 ml-2">{field.description}</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={value}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={(e) => handleFieldChange(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {field.unit && <span className="text-sm text-gray-500 whitespace-nowrap">{field.unit}</span>}
            </div>
          </div>
        );
      case 'select':
        return (
          <div key={field.key} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <select
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {field.options?.map((opt) => (
                <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );
      case 'boolean':
        return (
          <div key={field.key} className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(field.key, e.target.checked)}
              className="w-4 h-4 text-blue-600"
            />
            <label className="text-sm font-medium text-gray-700">{field.label}</label>
          </div>
        );
      case 'text':
        return (
          <div key={field.key} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">计算中心</h1>
          <p className="text-gray-500 text-sm mt-1">29个专业模块，图形化表单输入，国标计算</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/precise-quote')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            💰 精确报价
          </button>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm">返回</button>
        </div>
      </div>

      {/* 常用模块（表单化） */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CALC_MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => { switchModule(m); setJsonMode(false); setShowAdvanced(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeModule?.id === m.id && !showAdvanced ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {m.icon} {m.name}
          </button>
        ))}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${showAdvanced ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-600'}`}
        >
          📚 更多模块
        </button>
      </div>

      {/* 高级模块 */}
      {showAdvanced && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
          {ADVANCED_MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setActiveModule({ ...m, fields: [] } as any);
                setJsonMode(true);
                setResult(null);
                setError('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-orange-100"
            >
              {m.icon} {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 输入区 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              {activeModule ? `${activeModule.icon} ${activeModule.name}` : '选择模块'}
            </h2>
            {activeModule && activeModule.fields.length > 0 && (
              <button
                onClick={() => setJsonMode(!jsonMode)}
                className="text-xs text-blue-500 hover:underline"
              >
                {jsonMode ? '切到表单' : '切到JSON'}
              </button>
            )}
          </div>

          {activeModule && (
            <>
              {jsonMode || !activeModule.fields || activeModule.fields.length === 0 ? (
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder='{"key": "value"}'
                />
              ) : (
                <div>
                  {activeModule.fields.map((field) => renderField(field))}
                </div>
              )}

              <button
                onClick={handleCalc}
                disabled={calculating}
                className="w-full mt-4 px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300"
              >
                {calculating ? '计算中...' : '开始计算'}
              </button>
            </>
          )}

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 结果区 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-3">计算结果</h2>
          {!result ? (
            <div className="text-center py-12 text-gray-400">
              选择模块 → 填参数 → 点计算
            </div>
          ) : (
            <>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    const baseUrl = process.env.NEXT_PUBLIC_CALC_ENGINE_URL || 'http://localhost:8101';
                    window.open(`${baseUrl}/api/v1/export/report/${result?.meta?.record_id || result?.data?.record_id || ''}`, '_blank');
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  📄 导出计算书
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
