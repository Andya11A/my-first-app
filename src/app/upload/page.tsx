"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface UploadResult {
  success: boolean;
  error?: string;
  fileType?: string;
  fileName?: string;
  summary?: {
    equipmentCount?: number;
    extractedArea?: number | null;
    paragraphCount?: number;
    pageCount?: number;
    tableCount?: number;
  };
  equipmentItems?: { name: string; price: number | string | null }[];
  paragraphs?: string[];
  tables?: { rowCount: number; headers: string[]; dataRows: string[][] }[];
  textContent?: string[];
  extractedInfo?: { area?: number | null };
}

export default function ClientUploadPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string>("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!authLoading && !user) {
    router.push("/login");
    return null;
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setResult(null);
    setError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileData(event.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file || !fileData) {
      setError("请先选择文件");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = Cookies.get("token");
      const res = await fetch("http://localhost:5000/api/parse-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData, fileName: file.name }),
      });

      const data: UploadResult = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "识别失败");
      }
    } catch {
      setError("识别服务暂时不可用，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileData("");
    setResult(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">资料上传</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传您的场地资料、设备清单或需求文档
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
        >
          返回首页
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            file ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-green-400"
          }`}
        >
          {file ? (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                {file.name}（{(file.size / 1024).toFixed(1)} KB）
              </p>
              <p className="text-xs text-gray-400">点击更换文件</p>
            </div>
          ) : (
            <div>
              <p className="text-4xl mb-2">📋</p>
              <p className="text-gray-600">点击上传文件</p>
              <p className="text-gray-400 text-xs mt-1">
                支持 Excel / Word / PDF / 图片
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.docx,.pdf,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex-1 px-5 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium rounded-lg"
          >
            {loading ? "上传中..." : "上传并识别"}
          </button>
          {file && (
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
      </div>

      {/* 识别结果 */}
      {result?.success && (
        <div className="mt-6 bg-white rounded-xl border border-green-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">识别结果</h2>

          {result.equipmentItems && result.equipmentItems.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                检测到设备清单（{result.equipmentItems.length} 项）
              </p>
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">设备名称</th>
                    <th className="text-right px-3 py-2">价格</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.equipmentItems.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2 text-right">
                        {typeof item.price === 'number' ? item.price.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.extractedInfo?.area && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                检测到面积：<span className="font-bold">{result.extractedInfo.area} ㎡</span>
              </p>
            </div>
          )}

          {result.paragraphs && result.paragraphs.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                文档内容摘要
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.paragraphs.slice(0, 10).map((p, i) => (
                  <p key={i} className="text-sm text-gray-600">{p}</p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
            以上信息已作为项目参考数据留存，设计师将在方案设计时使用。
          </div>
        </div>
      )}
    </main>
  );
}
