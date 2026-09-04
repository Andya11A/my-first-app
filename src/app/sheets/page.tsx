'use client';
import { useEffect, useState } from 'react';

interface Group {
  professionalField: string;
  nodeCode: string;
  sheets: string[];
}

interface StandardItem { code: string; name: string; type: string; status: string }
interface ConfigItem { industry: string; systemCategory: string; paramKey: string; paramValue: string; unit: string | null; reference: string | null }
interface ProcessItem { processName: string; category: string; acceptance: string | null }

interface SheetDetail {
  sheetName: string;
  standards: StandardItem[];
  configs: ConfigItem[];
  processes: ProcessItem[];
}

export default function SheetsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [detail, setDetail] = useState<SheetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/sheets')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setGroups(data.data);
        else setError(data.error || '加载失败');
      })
      .catch(() => setError('加载失败'));
  }, []);

  useEffect(() => {
    if (!selectedSheet) return;
    setLoading(true);
    setError('');
    fetch(`/api/sheets/${encodeURIComponent(selectedSheet)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setDetail(data.data);
        else setError(data.error || '加载失败');
        setLoading(false);
      })
      .catch(() => {
        setError('加载失败');
        setLoading(false);
      });
  }, [selectedSheet]);

  const handleExport = (sheetName: string) => {
    window.open(`/api/sheets/export/${encodeURIComponent(sheetName)}`);
  };

  const totalSheets = groups.reduce((sum, g) => sum + g.sheets.length, 0);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">📋 72 Sheet 全景视图（当前 {totalSheets} 个）</h1>
        <a href="/quick-reference" className="text-sm text-blue-600 hover:underline">← 标准速查表</a>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 左侧：专业领域 → Sheet 列表 */}
        <div className="col-span-1 bg-gray-50 p-4 rounded-lg h-fit overflow-y-auto max-h-[80vh]">
          {groups.length === 0 && <p className="text-gray-400 text-sm">暂无分组数据</p>}
          {groups.map((group) => (
            <div key={group.nodeCode} className="mb-4">
              <h2 className="font-bold text-base border-b pb-1 mb-2">{group.professionalField.replace(/^专业领域：/, '')}</h2>
              <ul className="space-y-1">
                {group.sheets.map((sheet, i) => (
                  <li key={i}>
                    <button
                      onClick={() => setSelectedSheet(sheet)}
                      className={`text-left w-full px-2 py-1 rounded hover:bg-blue-100 text-sm ${selectedSheet === sheet ? 'bg-blue-200 font-semibold' : ''}`}
                    >
                      {sheet}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* 右侧：Sheet 详情 */}
        <div className="col-span-2">
          {selectedSheet ? (
            loading ? (
              <p className="text-gray-500">加载中...</p>
            ) : detail ? (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xl font-semibold">{detail.sheetName}</h2>
                  <button
                    onClick={() => handleExport(detail.sheetName)}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                  >
                    导出 Excel
                  </button>
                </div>
                {detail.standards.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold border-b pb-1 mb-2">📌 相关标准</h3>
                    <ul className="list-disc pl-5 text-sm">
                      {detail.standards.map((s) => (
                        <li key={s.code}>{s.code} - {s.name} <span className="text-xs text-gray-500">（{s.type}）</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.configs.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold border-b pb-1 mb-2">⚙️ 选型参数</h3>
                    <table className="w-full border-collapse border text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border p-1">行业</th><th className="border p-1">系统</th>
                          <th className="border p-1">参数</th><th className="border p-1">推荐值</th><th className="border p-1">参考</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.configs.map((c, i) => (
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
                  </div>
                )}
                {detail.processes.length > 0 && (
                  <div>
                    <h3 className="font-bold border-b pb-1 mb-2">🔧 施工工艺</h3>
                    <ul className="space-y-2">
                      {detail.processes.map((p, i) => (
                        <li key={i} className="border p-2 rounded">
                          <p><strong>{p.processName}</strong>（{p.category}）</p>
                          <p className="text-sm text-gray-600">验收：{p.acceptance}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.standards.length === 0 && detail.configs.length === 0 && detail.processes.length === 0 && (
                  <p className="text-gray-500">该 Sheet 暂未关联数据，后续补充 IndustryConfig/ProcessFlow 数据后自动关联。</p>
                )}
              </div>
            ) : null
          ) : (
            <p className="text-gray-500">从左侧选择一个 Sheet 查看详情。</p>
          )}
        </div>
      </div>
    </main>
  );
}
