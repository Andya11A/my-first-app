"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const LAB_TYPES = [
  "化学实验室", "有机合成实验室", "PCR实验室", "微生物实验室",
  "理化实验室", "医院检验科", "生物安全P2实验室", "生物安全P3实验室",
  "动物实验室SPF级", "细胞培养室", "病理实验室", "疾控中心实验室",
];

export default function ProcessRecommendPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [labType, setLabType] = useState('化学实验室');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleMatch = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_CALC_ENGINE_URL}/api/v1/auto-match/all/${encodeURIComponent(labType)}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setError('无法连接计算引擎服务（端口8101）');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">环保工艺推荐</h1>
          <p className="text-gray-500 text-sm mt-1">选择实验室类型，自动推荐废气+废水处理方案</p>
        </div>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">返回</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">实验室类型</label>
        <div className="flex gap-3">
          <select value={labType} onChange={(e) => setLabType(e.target.value)} className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
            {LAB_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={handleMatch} disabled={loading} className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-green-300">
            {loading ? '匹配中...' : '自动匹配'}
          </button>
        </div>
        {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      </div>

      {result && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">♻️ 废气处理方案</h2>
            <div className="mb-3">
              <span className="text-sm text-gray-500">污染物：</span>
              {result.exhaust.pollutants.map((p: string) => (
                <span key={p} className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs mr-2">{p}</span>
              ))}
            </div>
            <div className="mb-3">
              <span className="text-sm text-gray-500">工艺链：</span>
              {result.exhaust.process_chain_names.map((name: string, i: number) => (
                <span key={i} className="inline-flex items-center">
                  <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">{name}</span>
                  {i < result.exhaust.process_chain_names.length - 1 && <span className="mx-2 text-gray-400">→</span>}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-600 mb-3">推荐理由：{result.exhaust.reason}</p>
            <div className="space-y-2">
              {result.exhaust.chain_details.map((detail: any) => (
                <div key={detail.technology_key} className="border border-gray-200 rounded-lg p-3 text-sm">
                  <p className="font-medium">{detail.technology_name}</p>
                  <p className="text-gray-600">设备：{detail.equipment}</p>
                  <p className="text-gray-500 text-xs">阻力：{detail.resistance_pa} Pa | 更换：{detail.replacement}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-medium">系统总阻力：{result.exhaust.total_resistance_pa} Pa</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">💧 废水处理方案</h2>
            <div className="mb-3">
              <span className="text-sm text-gray-500">废水类型：</span>
              {result.wastewater.wastewater_types.map((t: string) => (
                <span key={t} className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs mr-2">{t}</span>
              ))}
            </div>
            <div className="mb-3">
              <span className="text-sm text-gray-500">工艺链：</span>
              {result.wastewater.process_chain_names.map((name: string, i: number) => (
                <span key={i} className="inline-flex items-center">
                  <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">{name}</span>
                  {i < result.wastewater.process_chain_names.length - 1 && <span className="mx-2 text-gray-400">→</span>}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-600 mb-3">推荐理由：{result.wastewater.reason}</p>
            <div className="space-y-2">
              {result.wastewater.chain_details.map((detail: any) => (
                <div key={detail.process_key} className="border border-gray-200 rounded-lg p-3 text-sm">
                  <p className="font-medium">{detail.process_name}</p>
                  <p className="text-gray-600">设备：{detail.equipment}</p>
                  <p className="text-gray-500 text-xs">用途：{detail.purpose}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
