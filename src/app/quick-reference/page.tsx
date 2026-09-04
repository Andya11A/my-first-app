'use client';
import { useState } from 'react';

interface StandardItem { code: string; name: string; type: string; priority: number; industry: string | null; status: string; scope: string | null }
interface ConfigItem { industry: string; systemCategory: string; paramKey: string; paramValue: string; unit: string | null; reference: string | null }
interface ProcessItem { processName: string; category: string; qualityStd: string | null; acceptance: string | null; safetyNotes: string | null }
interface Coordinate { index: number; layer: string }
interface MatrixItem { from: string; to: string; impact: string }

interface SearchData {
  standards: { main: StandardItem[]; special: StandardItem[]; support: StandardItem[] };
  industryConfigs: ConfigItem[];
  processes: ProcessItem[];
  coordinates: { layers: Coordinate[]; matrix: MatrixItem[] };
}

export default function QuickReferencePage() {
  const [q, setQ] = useState('电池');
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || '搜索失败');
    } catch {
      setError('搜索请求失败');
    }
    setLoading(false);
  };

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">工程核心标准体系速查表</h1>
        <div className="flex gap-3">
          <a href="/sheets" className="text-sm text-blue-600 hover:underline">📋 72 Sheet 全景视图</a>
          <a href="/admin/knowledge-center" className="text-sm text-blue-600 hover:underline">← 知识管理中心</a>
        </div>
      </div>
      <div className="flex gap-2 mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="输入行业/关键词（如：电池、压差、ESD）"
          className="border border-gray-300 p-2 flex-1 rounded-lg"
        />
        <button onClick={search} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">搜索</button>
        <button
          onClick={() => window.open(`/api/export/quick-reference?q=${encodeURIComponent(q)}`)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          导出Excel
        </button>
      </div>

      {loading && <p className="text-gray-500">加载中...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {data && (
        <>
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2">📌 标准库（专项优先）</h2>
            {data.standards.special.length > 0 && (
              <div className="border-l-4 border-red-500 pl-4 my-2">
                <p className="font-semibold">🔴 行业专项（优先采用）</p>
                {data.standards.special.map((s) => (
                  <p key={s.code} className="text-sm">{s.code} {s.name} <span className="text-gray-400">（{s.scope}）</span></p>
                ))}
              </div>
            )}
            {data.standards.main.length > 0 && (
              <div className="border-l-4 border-blue-500 pl-4 my-2">
                <p className="font-semibold">🔵 主要标准（通用）</p>
                {data.standards.main.map((s) => (
                  <p key={s.code} className="text-sm">{s.code} {s.name} <span className="text-gray-400">（{s.scope}）</span></p>
                ))}
              </div>
            )}
            {data.standards.support.length > 0 && (
              <div className="border-l-4 border-gray-400 pl-4 my-2">
                <p className="font-semibold">⚪ 配套标准</p>
                {data.standards.support.map((s) => (
                  <p key={s.code} className="text-sm">{s.code} {s.name}</p>
                ))}
              </div>
            )}
            {data.standards.special.length + data.standards.main.length + data.standards.support.length === 0 && (
              <p className="text-sm text-gray-400">无匹配标准</p>
            )}
          </div>

          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2">📊 行业选型参数</h2>
            {data.industryConfigs.length > 0 ? (
              <table className="w-full border-collapse border text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-1">行业</th><th className="border p-1">系统</th>
                    <th className="border p-1">参数</th><th className="border p-1">推荐值</th><th className="border p-1">参考</th>
                  </tr>
                </thead>
                <tbody>
                  {data.industryConfigs.map((c, i) => (
                    <tr key={i}>
                      <td className="border p-1">{c.industry}</td>
                      <td className="border p-1">{c.systemCategory}</td>
                      <td className="border p-1">{c.paramKey}</td>
                      <td className="border p-1 font-medium">{c.paramValue} {c.unit}</td>
                      <td className="border p-1 text-gray-500">{c.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400">无匹配参数</p>
            )}
          </div>

          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2">🗺️ 十级坐标联动矩阵</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
              {data.coordinates.layers.map((l) => (
                <div key={l.index} className="border rounded-lg p-2 text-center text-sm bg-white">
                  <span className="text-gray-400 text-xs">第{l.index}级</span>
                  <p className="font-medium">{l.layer.replace(/^[^：]+：/, '')}</p>
                </div>
              ))}
            </div>
            <ul className="list-disc pl-5 text-sm text-gray-600">
              {data.coordinates.matrix.map((m, i) => (
                <li key={i}>{m.from} → {m.to}：{m.impact}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-lg mb-2">🔧 施工工艺</h2>
            {data.processes.length > 0 ? (
              data.processes.map((p, i) => (
                <div key={i} className="border p-3 my-2 rounded-lg bg-white">
                  <p className="font-medium">{p.processName} <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{p.category}</span></p>
                  <p className="text-xs text-gray-600 mt-1">✅ 验收：{p.acceptance}　⚠️ 安全：{p.safetyNotes}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">无匹配工艺</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
