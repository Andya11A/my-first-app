"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface WallData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DeviceData {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  rectangularity: number;
}

interface RecognitionResult {
  success: boolean;
  error?: string;
  data?: {
    imageWidth: number;
    imageHeight: number;
    walls: WallData[];
    devices: DeviceData[];
    wallCount: number;
    deviceCount: number;
  };
}

export default function DrawingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageData, setImageData] = useState<string>("");
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 登录检查
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Canvas 重绘
  useEffect(() => {
    if (!result?.success || !result.data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { imageWidth, imageHeight, walls, devices } = result.data;

    // 设置 canvas 尺寸
    canvas.width = imageWidth;
    canvas.height = imageHeight;

    // 清空
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 白色背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制墙体（黑色粗线）
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (const wall of walls) {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    }

    // 绘制设备（蓝色矩形，半透明填充）
    for (const device of devices) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.35)";
      ctx.fillRect(device.x, device.y, device.width, device.height);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.strokeRect(device.x, device.y, device.width, device.height);
    }

    // 如果有设备，标注编号
    if (devices.length > 0) {
      ctx.fillStyle = "#1e40af";
      ctx.font = "bold 14px sans-serif";
      devices.forEach((device, index) => {
        const label = `设备${index + 1}`;
        ctx.fillText(label, device.x, device.y - 6);
      });
    }
  }, [result, showOriginal]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }

    // 检查文件大小（10MB限制）
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

  const handleRecognize = async () => {
    if (!imageData) {
      setError("请先上传图片");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });

      const data: RecognitionResult = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "识别失败");
      }
    } catch {
      setError("无法连接识别服务，请确认 Python 服务已启动（端口5000）");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImageUrl("");
    setImageData("");
    setResult(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">图纸识别</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传实验室平面图，自动识别墙体和设备
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
        {/* 左侧：上传区 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">上传图纸</h2>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              imageUrl ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
            }`}
          >
            {imageUrl ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">点击更换图片</p>
                <img
                  src={imageUrl}
                  alt="上传的图纸"
                  className="max-h-64 mx-auto rounded-lg"
                />
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-2">📐</p>
                <p className="text-gray-600">点击上传图纸图片</p>
                <p className="text-gray-400 text-xs mt-1">支持 JPG / PNG，最大 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleRecognize}
              disabled={!imageData || loading}
              className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? "识别中..." : "开始识别"}
            </button>
            {imageUrl && (
              <button
                onClick={handleReset}
                className="px-5 py-3 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
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

          {result?.success && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              识别成功！发现 {result.data?.wallCount || 0} 条墙线，{result.data?.deviceCount || 0} 个设备
            </div>
          )}
        </div>

        {/* 右侧：结果显示区 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">识别结果</h2>
            {result?.success && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowOriginal(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    showOriginal ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"
                  }`}
                >
                  原图
                </button>
                <button
                  onClick={() => setShowOriginal(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    !showOriginal ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"
                  }`}
                >
                  重绘
                </button>
              </div>
            )}
          </div>

          {!result ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              上传图纸并点击「开始识别」后显示结果
            </div>
          ) : !result.success ? (
            <div className="flex items-center justify-center h-64 text-red-500">
              {result.error || "识别失败"}
            </div>
          ) : (
            <div className="relative">
              {showOriginal && imageUrl ? (
                <img
                  src={imageUrl}
                  alt="原图"
                  className="w-full rounded-lg"
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  className="w-full rounded-lg border border-gray-200"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 识别结果数据明细 */}
      {result?.success && result.data && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              墙体数据（{result.data.wallCount} 条）
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-1 text-xs font-mono">
              {result.data.walls.slice(0, 30).map((wall, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-600">墙线{i + 1}</span>
                  <span>({wall.x1},{wall.y1}) → ({wall.x2},{wall.y2})</span>
                </div>
              ))}
              {result.data.wallCount > 30 && (
                <p className="text-gray-400">... 还有 {result.data.wallCount - 30} 条</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              设备数据（{result.data.deviceCount} 个）
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {result.data.devices.map((device, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                  <span className="font-medium text-gray-700">设备{i + 1}</span>
                  <span className="text-gray-500 text-xs">
                    位置({device.x},{device.y}) 尺寸{device.width}×{device.height}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
