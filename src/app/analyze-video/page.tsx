"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface VideoAnalysis {
  success: boolean;
  error?: string;
  data?: {
    duration: number;
    totalFrames: number;
    analyzedFrames: number;
    overallTemperature: string;
    avgBrightness: number;
    avgSaturation: number;
    dominantTags: [string, number][];
    dominantMaterials: [string, number][];
    frameAnalyses: {
      styleTags: string[];
      colorTemperature: string;
      brightness: number;
      saturation: number;
      dominantColor: string;
    }[];
    designRecommendations: string[];
  };
}

export default function AnalyzeVideoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [videoUrl, setVideoUrl] = useState("");
  const [videoData, setVideoData] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<VideoAnalysis | null>(null);
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
    if (!file.type.startsWith("video/")) {
      setError("请上传视频文件");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("视频不能超过50MB");
      return;
    }

    setError("");
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setVideoData(dataUrl);
      setVideoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!videoData) {
      setError("请先上传视频");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: videoData }),
      });
      const data: VideoAnalysis = await res.json();
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
    setVideoUrl("");
    setVideoData("");
    setFileName("");
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">视频分析</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传场地视频或参考视频，分析整体风格特征
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
          <h2 className="font-semibold text-gray-900 mb-4">上传视频</h2>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer ${
              videoUrl ? "border-purple-300 bg-purple-50" : "border-gray-300 hover:border-purple-400"
            }`}
          >
            {fileName ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">{fileName}</p>
                <p className="text-xs text-gray-400">点击更换视频</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-2">🎬</p>
                <p className="text-gray-600">点击上传视频</p>
                <p className="text-gray-400 text-xs mt-1">支持 MP4，最大 50MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAnalyze}
              disabled={!videoData || loading}
              className="flex-1 px-5 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-medium rounded-lg"
            >
              {loading ? "分析中..." : "开始分析"}
            </button>
            {fileName && (
              <button
                onClick={handleReset}
                className="px-5 py-3 bg-white border border-gray-300 text-gray-600 rounded-lg"
              >
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
              上传视频并分析后显示结果
            </div>
          ) : result.success && result.data ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">视频概览</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">时长</p>
                    <p className="font-medium">{result.data.duration} 秒</p>
                  </div>
                  <div>
                    <p className="text-gray-500">总帧数</p>
                    <p className="font-medium">{result.data.totalFrames}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">分析帧数</p>
                    <p className="font-medium">{result.data.analyzedFrames}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">整体色温</p>
                    <p className="font-medium">{result.data.overallTemperature}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">主导风格</h3>
                <div className="flex flex-wrap gap-2">
                  {result.data.dominantTags.map(([tag, count], i) => (
                    <span key={i} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      {tag}（{count}帧）
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">材料倾向</h3>
                <div className="flex flex-wrap gap-2">
                  {result.data.dominantMaterials.map(([m, count], i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                      {m}（{count}帧）
                    </span>
                  ))}
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

              {/* 帧分析明细 */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">帧分析明细</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {result.data.frameAnalyses.map((frame, i) => (
                    <div key={i} className="min-w-16 h-16 rounded border border-gray-200 flex items-center justify-center" style={{ backgroundColor: frame.dominantColor }}>
                      <span className="text-[10px] text-gray-700 bg-white/80 px-1 rounded">
                        帧{i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
