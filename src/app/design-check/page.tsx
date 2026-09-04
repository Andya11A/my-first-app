"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { checkDesign, RuleCheckResult } from "@/lib/process-rules";

export default function DesignCheckPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [labType, setLabType] = useState('PCR实验室');
  const [designJson, setDesignJson] = useState('');
  const [results, setResults] = useState<RuleCheckResult[]>([]);
  const [checked, setChecked] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageResult, setImageResult] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    // 示例数据
    setDesignJson(JSON.stringify({
      devices: [
        { name: '生物安全柜', x: 100, y: 100, width: 80, height: 50 },
        { name: '离心机', x: 300, y: 100, width: 60, height: 50 },
      ],
      walls: [
        { x1: 50, y1: 50, x2: 550, y2: 50 },
        { x1: 50, y1: 50, x2: 50, y2: 350 },
      ],
      rooms: [
        { name: '试剂准备区' },
        { name: '标本制备区' },
      ],
    }, null, 2));
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    setImageResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        const res = await fetch('http://localhost:5000/api/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          setImageResult({
            wallCount: data.data.wallCount,
            deviceCount: data.data.deviceCount,
          });
          // 把识别结果转换成 design-check 需要的 JSON 格式
          const designData = {
            devices: (data.data.devices || []).map((d: any) => ({
              name: '设备',
              x: d.x,
              y: d.y,
              width: d.width,
              height: d.height,
            })),
            walls: data.data.walls || [],
            rooms: [],
          };
          setDesignJson(JSON.stringify(designData, null, 2));
        }
      } catch (err) {
        alert('图片识别失败，请确认 Python 服务已启动（端口5000）');
      } finally {
        setImageUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCheck = () => {
    try {
      const designData = JSON.parse(designJson);
      const ruleResults = checkDesign(labType, designData);
      setResults(ruleResults);
      setChecked(true);
    } catch {
      alert('JSON格式错误');
    }
  };

  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.length - passCount;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工艺检查</h1>
          <p className="text-gray-500 text-sm mt-1">对照规范检查平面设计是否合规</p>
        </div>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">返回</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        {/* 图片上传识别 */}
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">📐 上传平面图自动识别（可选）</p>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="text-sm text-gray-600 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {imageUploading && <span className="text-sm text-gray-500">识别中...</span>}
          </div>
          {imageResult && (
            <div className="mt-2 text-xs text-green-600">
              ✅ 识别到 {imageResult.wallCount} 条墙线、{imageResult.deviceCount} 个设备
            </div>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">实验室类型</label>
          <select value={labType} onChange={(e) => setLabType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option>PCR实验室</option>
            <option>生物安全P2实验室</option>
            <option>微生物实验室</option>
            <option>动物实验室SPF级</option>
            <option>动物实验室普通级</option>
            <option>恒温恒湿实验室</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">设计数据（JSON）</label>
          <textarea value={designJson} onChange={(e) => setDesignJson(e.target.value)} rows={10} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
        </div>
        <button onClick={handleCheck} className="w-full px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          开始检查
        </button>
      </div>

      {checked && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            检查结果：✅ {passCount} 通过 | ❌ {failCount} 不通过
          </h2>
          <div className="space-y-3">
            {results.map((r) => (
              <div key={r.ruleId} className={`border rounded-xl p-4 ${r.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{r.passed ? '✅' : '❌'} {r.ruleName}</p>
                  {r.regulation && <span className="text-xs text-gray-500">{r.regulation}</span>}
                </div>
                {!r.passed && (
                  <div className="mt-2 text-sm">
                    <p className="text-red-700">{r.violation}</p>
                    <p className="text-gray-600 mt-1">建议：{r.suggestion}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
