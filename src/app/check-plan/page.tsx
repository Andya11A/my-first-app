"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface CheckResult {
  success: boolean;
  error?: string;
  data?: {
    labType: string;
    imageSize: { width: number; height: number };
    recognition: {
      wallCount: number;
      deviceCount: number;
      walls: { x1: number; y1: number; x2: number; y2: number }[];
      devices: { x: number; y: number; width: number; height: number }[];
    };
    checkResult: {
      overall: string;
      passCount: number;
      warnCount: number;
      errorCount: number;
      checks: { item: string; status: string }[];
      warnings: { item: string; issue: string; suggestion: string }[];
      errors: { item: string; issue: string; suggestion: string }[];
    };
  };
}

const LAB_TYPES = [
  '通用实验室', 'PCR实验室', '理化实验室', '微生物实验室',
  '生物安全P2实验室', '生物安全P3实验室', '动物实验室SPF级',
  '动物实验室普通级', '细胞培养室', '恒温恒湿实验室',
  '半导体洁净室', '食品检测实验室', '环境监测实验室',
  '医院检验科', '疾控中心实验室', '病理实验室'
];

export default function CheckPlanPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [imageUrl, setImageUrl] = useState('');
  const [imageData, setImageData] = useState('');
  const [labType, setLabType] = useState('通用实验室');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCanvas, setShowCanvas] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!result?.success || !result.data || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { imageSize, recognition } = result.data;
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 画墙线
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    for (const wall of recognition.walls) {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    }

    // 画设备
    for (const device of recognition.devices) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(device.x, device.y, device.width, device.height);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(device.x, device.y, device.width, device.height);
    }
  }, [result, showCanvas]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    setError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImageUrl(dataUrl);
      setImageData(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleCheck = async () => {
    if (!imageData) {
      setError('请先上传图纸');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/check-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData, labType }),
      });
      const data: CheckResult = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || '检查失败');
      }
    } catch {
      setError('无法连接检查服务，请确认 Python 服务已启动');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImageUrl('');
    setImageData('');
    setResult(null);
    setError('');
    setShowCanvas(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cr = result?.data?.checkResult;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">平面图工艺检查</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传平面图，识别后对照规范输出问题清单
          </p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
        >
          返回首页
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">上传图纸</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">实验室类型</label>
            <select
              value={labType}
              onChange={(e) => setLabType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {LAB_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer ${
              imageUrl ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="图纸" className="max-h-48 mx-auto rounded-lg" />
            ) : (
              <div>
                <p className="text-4xl mb-2">📐</p>
                <p className="text-gray-600">点击上传平面图</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCheck}
              disabled={!imageData || loading}
              className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg"
            >
              {loading ? '检查中...' : '开始检查'}
            </button>
            {imageUrl && (
              <button onClick={handleReset} className="px-5 py-3 bg-white border border-gray-300 rounded-lg">重置</button>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
        </div>

        <div className="space-y-4">
          {!result?.success ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              上传图纸并检查后显示结果
            </div>
          ) : cr ? (
            <>
              {/* 总体结论 */}
              <div className={`rounded-xl p-5 text-center ${
                cr.overall === '通过' ? 'bg-green-50 border border-green-200' :
                cr.overall === '有警告' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <p className="text-lg font-bold">
                  {cr.overall === '通过' ? '✅ 通过' :
                   cr.overall === '有警告' ? '⚠️ 有警告' : '❌ 不通过'}
                </p>
                <p className="text-sm mt-1">
                  ✅ {cr.passCount} 项通过 | ⚠️ {cr.warnCount} 项警告 | ❌ {cr.errorCount} 项不合格
                </p>
              </div>

              {/* 通过项 */}
              {cr.checks.length > 0 && (
                <div className="bg-white rounded-xl border border-green-200 p-5">
                  <h3 className="font-semibold text-green-700 mb-3">通过项</h3>
                  <ul className="space-y-2">
                    {cr.checks.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500">✅</span>
                        <div>
                          <p className="font-medium">{c.item}</p>
                          <p className="text-gray-500">{c.status}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 警告项 */}
              {cr.warnings.length > 0 && (
                <div className="bg-white rounded-xl border border-yellow-200 p-5">
                  <h3 className="font-semibold text-yellow-700 mb-3">警告项</h3>
                  <ul className="space-y-3">
                    {cr.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-yellow-500">⚠️</span>
                        <div>
                          <p className="font-medium">{w.item}</p>
                          <p className="text-gray-600">{w.issue}</p>
                          <p className="text-gray-400 text-xs mt-1">建议：{w.suggestion}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 不合格项 */}
              {cr.errors.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 p-5">
                  <h3 className="font-semibold text-red-700 mb-3">不合格项</h3>
                  <ul className="space-y-3">
                    {cr.errors.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-red-500">❌</span>
                        <div>
                          <p className="font-medium">{e.item}</p>
                          <p className="text-gray-600">{e.issue}</p>
                          <p className="text-gray-400 text-xs mt-1">建议：{e.suggestion}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 识别重绘 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">识别重绘</h3>
                  <button
                    onClick={() => setShowCanvas(!showCanvas)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    显示/隐藏
                  </button>
                </div>
                {showCanvas && (
                  <canvas ref={canvasRef} className="w-full rounded border border-gray-200" />
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
