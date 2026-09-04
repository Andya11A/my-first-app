"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface StyleAnalysis {
  success: boolean;
  error?: string;
  data?: {
    imageWidth: number;
    imageHeight: number;
    brightness: { value: number; level: string };
    saturation: { value: number; level: string };
    colorTemperature: string;
    dominantColors: { rgb: string; ratio: number }[];
    styleTags: string[];
    materialHints: string[];
    designRecommendations: string[];
  };
}

export default function AnalyzePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState("");
  const [result, setResult] = useState<StyleAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

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
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("图片不能超过10MB");
      return;
    }

    setError("");
    setResult(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImageUrl(dataUrl);
      setImageData(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageData) {
      setError("请先上传图片");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });
      const data: StyleAnalysis = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "分析失败");
      }
    } catch {
      setError("无法连接分析服务，请确认 Python 服务已启动");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImageUrl("");
    setImageData("");
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">参考图分析</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传客户喜欢的参考图，分析风格并推荐效果图方向
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
        >
          返回首页
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">上传参考图</h2>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer ${
              imageUrl ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400"
            }`}
          >
            {imageUrl ? (
              <div>
                <img src={imageUrl} alt="参考图" className="max-h-64 mx-auto rounded-lg" />
                <p className="text-xs text-gray-400 mt-2">点击更换图片</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-2">🎨</p>
                <p className="text-gray-600">点击上传参考图</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAnalyze}
              disabled={!imageData || loading}
              className="flex-1 px-5 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-medium rounded-lg"
            >
              {loading ? "分析中..." : "开始分析"}
            </button>
            {imageUrl && (
              <button onClick={handleReset} className="px-5 py-3 bg-white border border-gray-300 text-gray-600 rounded-lg">
                重置
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!result ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              上传图片并分析后显示结果
            </div>
          ) : result.success && result.data ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">风格标签</h3>
                <div className="flex flex-wrap gap-2">
                  {result.data.styleTags.map((tag, i) => (
                    <span key={i} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">色彩特征</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">色温</span>
                    <span className="font-medium">{result.data.colorTemperature}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">亮度</span>
                    <span className="font-medium">{result.data.brightness.level}（{result.data.brightness.value}）</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">饱和度</span>
                    <span className="font-medium">{result.data.saturation.level}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">主色调</p>
                  <div className="flex gap-2">
                    {result.data.dominantColors.map((color, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: color.rgb, border: '1px solid #ddd' }} />
                        <span className="text-xs text-gray-500">{color.ratio}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">材料倾向</h3>
                <div className="flex flex-wrap gap-2">
                  {result.data.materialHints.length > 0 ? result.data.materialHints.map((m, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                      {m}
                    </span>
                  )) : <span className="text-gray-400 text-sm">无明显倾向</span>}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-purple-200 bg-purple-50 p-6">
                <h3 className="font-semibold text-purple-900 mb-3">效果图方向建议</h3>
                <ul className="space-y-2">
                  {result.data.designRecommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-purple-800 flex items-start gap-2">
                      <span className="text-purple-500">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
