"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface MyFileItem {
  id: number;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string;
  note: string | null;
  status: string;
  chunkCount: number;
  parseError: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface ChunkItem {
  id: number;
  seq: number;
  content: string;
  status: string;
}

interface AdviceItem {
  source: "norm" | "knowledge" | "industry";
  sourceName: string;
  title: string;
  content: string;
  reference: string;
}

interface AdviceResult {
  question: string;
  summary: string;
  items: AdviceItem[];
  stats: { normCount: number; knowledgeCount: number; industryCount: number };
}

const CATEGORIES = ["规范标准", "项目案例", "行业数据", "设备价格", "其他"];

const STATUS_BADGES: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  approved: "已入库",
  pending: "待审核",
  rejected: "已驳回",
};

const SOURCE_STYLES: Record<string, { badge: string; label: string }> = {
  norm: { badge: "bg-blue-100 text-blue-700", label: "规范依据" },
  knowledge: { badge: "bg-purple-100 text-purple-700", label: "知识库资料" },
  industry: { badge: "bg-emerald-100 text-emerald-700", label: "行业数据" },
};

function formatSize(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export default function AdvisorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // 我的资料列表
  const [files, setFiles] = useState<MyFileItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // 上传表单
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 详情弹层
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailTitle, setDetailTitle] = useState("");
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // 智能建议
  const [question, setQuestion] = useState("");
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [advising, setAdvising] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const token = Cookies.get("token");
      const res = await fetch("/api/knowledge/files?mine=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setFiles(data.data.files);
      else setError(data.error || "加载失败");
    } catch {
      setError("网络错误，请刷新重试");
    } finally {
      setListLoading(false);
    }
  }, []);

  // 登录检查
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) loadFiles();
  }, [user, loadFiles]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 text-lg">加载中...</p>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!file) {
      setError("请先选择文件");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const token = Cookies.get("token");
      const form = new FormData();
      form.append("file", file);
      form.append("title", title);
      form.append("category", category);
      form.append("note", note);
      const res = await fetch("/api/knowledge/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.data.message);
        setFile(null);
        setTitle("");
        setNote("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        loadFiles();
      } else {
        setError(data.error || "上传失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除这份资料吗？（仅待审核的可删除）")) return;
    try {
      const token = Cookies.get("token");
      const res = await fetch(`/api/knowledge/files/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast("已删除");
        loadFiles();
      } else {
        showToast(data.error || "删除失败");
      }
    } catch {
      showToast("网络错误，请重试");
    }
  };

  const openDetail = async (item: MyFileItem) => {
    setDetailId(item.id);
    setDetailTitle(item.title);
    setChunks([]);
    setDetailLoading(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch(`/api/knowledge/files/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setChunks(data.data.file.chunks);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAdvice = async () => {
    const q = question.trim();
    if (q.length < 2) {
      setAdviceError("请描述您的问题（至少 2 个字）");
      return;
    }
    setAdviceError("");
    setAdvising(true);
    setAdvice(null);
    try {
      const token = Cookies.get("token");
      const res = await fetch("/api/knowledge/advice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (data.success) {
        setAdvice(data.data);
      } else {
        setAdviceError(data.error || "建议生成失败");
      }
    } catch {
      setAdviceError("网络错误，请重试");
    } finally {
      setAdvising(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">智能顾问 · 资料喂养</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传您的资料帮助平台学习，并获得基于规范与行业数据的专业建议
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
        >
          返回首页
        </button>
      </div>

      {/* 上传区 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">上传资料</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">选择文件（xlsx / csv / docx / pdf / txt / md，≤10MB）</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.docx,.pdf,.txt,.md"
              onChange={handleFileChange}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">资料标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：某医院PCR实验室验收报告"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">备注（选填）</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="补充说明，便于管理员审核"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            上传后将由管理员审核，审核通过的内容会参与智能建议
          </p>
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {uploading ? "解析上传中..." : "上传并解析"}
          </button>
        </div>
      </section>

      {/* 智能建议区 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">智能专业建议</h2>
        <p className="text-xs text-gray-400 mb-4">
          融合三路数据：国家规范条款 + 已入库知识资料 + 平台行业数据（117 类实验室参数与设备配置）
        </p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="描述您的问题，例如：PCR实验室的通风和压差有什么设计要求？集中供气管路用什么材质？"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {adviceError && <p className="text-red-500 text-sm mt-2">{adviceError}</p>}
        <div className="mt-3 text-right">
          <button
            onClick={handleAdvice}
            disabled={advising}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700"
          >
            {advising ? "分析中..." : "获取专业建议"}
          </button>
        </div>

        {advice && (
          <div className="mt-5 border-t border-gray-100 pt-5">
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">规范条款 {advice.stats.normCount} 条</span>
              <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">知识库 {advice.stats.knowledgeCount} 条</span>
              <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">行业数据 {advice.stats.industryCount} 条</span>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-4">
              <p className="text-xs text-indigo-500 mb-1">综合意见</p>
              <p className="text-sm text-indigo-900 whitespace-pre-wrap leading-relaxed">{advice.summary}</p>
            </div>
            <div className="space-y-3">
              {advice.items.map((item, i) => {
                const style = SOURCE_STYLES[item.source] || SOURCE_STYLES.knowledge;
                return (
                  <div key={i} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${style.badge}`}>{item.sourceName || style.label}</span>
                      <span className="text-sm font-medium text-gray-800">{item.title}</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    {item.reference && (
                      <p className="text-xs text-gray-400 mt-2">来源：{item.reference}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 我的资料列表 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">我的资料</h2>
          <span className="text-xs text-gray-400">共 {files.length} 份</span>
        </div>
        {listLoading ? (
          <p className="text-gray-400 text-sm py-8 text-center">加载中...</p>
        ) : files.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">还没有上传过资料，先传一份试试</p>
        ) : (
          <div className="space-y-3">
            {files.map((f) => (
              <div key={f.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{f.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGES[f.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[f.status] || f.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{f.category}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {f.fileName} · {formatSize(f.fileSize)} · {f.chunkCount} 个知识块 · {new Date(f.createdAt).toLocaleString("zh-CN")}
                    </p>
                    {f.parseError && (
                      <p className="text-xs text-orange-500 mt-1">解析提示：{f.parseError}</p>
                    )}
                    {f.status === "rejected" && f.reviewNote && (
                      <p className="text-xs text-red-500 mt-1">驳回原因：{f.reviewNote}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openDetail(f)}
                      className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      查看解析
                    </button>
                    {f.status === "pending" && (
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="px-3 py-1.5 text-xs bg-red-50 border border-red-100 text-red-600 rounded-lg hover:bg-red-100"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 解析详情弹层 */}
      {detailId !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">解析结果：《{detailTitle}》</h3>
              <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {detailLoading ? (
                <p className="text-gray-400 text-sm text-center py-8">加载中...</p>
              ) : chunks.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">没有解析出知识块</p>
              ) : (
                <div className="space-y-3">
                  {chunks.map((c) => (
                    <div key={c.id} className="border border-gray-100 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">知识块 #{c.seq + 1} · {STATUS_LABELS[c.status] || c.status}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
