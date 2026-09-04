"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface KnowledgeFileItem {
  id: number;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  source: string;
  category: string;
  note: string | null;
  status: string;
  uploaderName: string;
  chunkCount: number;
  parseSummary: string | null;
  parseError: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface ChunkItem {
  id: number;
  seq: number;
  content: string;
  keywords: string | null;
  status: string;
}

const CATEGORIES = ["规范标准", "设备价格", "项目案例", "行业数据", "其他"];

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

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export default function AdminKnowledgePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [files, setFiles] = useState<KnowledgeFileItem[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // 上传表单
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);

  // 详情查看
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailChunks, setDetailChunks] = useState<ChunkItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const isAdminUser = user && ["admin", "super_admin"].includes(user.roleCode);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/knowledge/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
      });
      const data = await res.json();
      if (data.success) {
        setFiles(data.data.files);
        setStats(data.data.stats);
      } else {
        setError(data.error || "加载失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setListLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (isAdminUser) loadList();
  }, [isAdminUser, loadList]);

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">加载中...</div>;
  }
  if (!isAdminUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-600">该页面仅管理员可见</p>
        <button onClick={() => router.push("/")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">返回首页</button>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("请选择文件");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title);
      form.append("category", category);
      form.append("note", note);
      const res = await fetch("/api/knowledge/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.data.message);
        setFile(null);
        setTitle("");
        setNote("");
        loadList();
      } else {
        setError(data.error || "上传失败");
      }
    } catch {
      setError("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  const handleReview = async (id: number, action: "approve" | "reject") => {
    let reviewNote = "";
    if (action === "reject") {
      reviewNote = window.prompt("请填写驳回原因（上传人将收到站内消息）：") || "";
      if (!reviewNote) return;
    }
    const res = await fetch(`/api/knowledge/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Cookies.get("token")}` },
      body: JSON.stringify({ action, reviewNote }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(action === "approve" ? "已通过并入库" : "已驳回");
      loadList();
    } else {
      setError(data.error || "审核失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定删除该文件及其全部知识块？此操作不可恢复。")) return;
    const res = await fetch(`/api/knowledge/files/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${Cookies.get("token")}` },
    });
    const data = await res.json();
    if (data.success) {
      showToast("已删除");
      if (detailId === id) setDetailId(null);
      loadList();
    } else {
      setError(data.error || "删除失败");
    }
  };

  const toggleDetail = async (id: number) => {
    if (detailId === id) {
      setDetailId(null);
      return;
    }
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/knowledge/files/${id}`, {
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
      });
      const data = await res.json();
      setDetailChunks(data.success ? data.data.file.chunks : []);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识库管理</h1>
          <p className="text-gray-500 text-sm mt-1">
            管理员专属：上传资料自动解析入库，审核客户喂入的数据
          </p>
        </div>
        <button onClick={() => router.push("/")} className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">返回首页</button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "文件总数", value: stats.total || 0, color: "text-blue-600" },
          { label: "待审核", value: stats.pending || 0, color: "text-yellow-600" },
          { label: "已入库", value: stats.approved || 0, color: "text-green-600" },
          { label: "已驳回", value: stats.rejected || 0, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 上传区 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-medium text-gray-900 mb-4">上传资料（解析后直接入库）</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="资料标题（留空取文件名）"
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）：说明资料用途，如「华东区 2025 设备报价」"
          rows={2}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />
        <div className="flex items-center gap-3">
          <label className="flex-1 border-2 border-dashed border-gray-300 rounded-lg px-4 py-4 text-center text-sm text-gray-500 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors">
            {file ? `已选择：${file.name}（${formatSize(file.size)}）` : "点击选择文件（xlsx / csv / docx / pdf / txt / md，≤10MB）"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.docx,.pdf,.txt,.md"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg text-sm whitespace-nowrap"
          >
            {uploading ? "解析中..." : "上传并解析入库"}
          </button>
        </div>
        {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "", label: `全部 (${stats.total || 0})` },
          { value: "pending", label: `待审核 (${stats.pending || 0})` },
          { value: "approved", label: `已入库 (${stats.approved || 0})` },
          { value: "rejected", label: `已驳回 (${stats.rejected || 0})` },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              statusFilter === t.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 文件列表 */}
      {listLoading ? (
        <p className="text-center text-gray-500 py-8">加载中...</p>
      ) : files.length === 0 ? (
        <p className="text-center text-gray-400 py-8">暂无资料</p>
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{f.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[f.status] || ""}`}>
                      {STATUS_LABELS[f.status] || f.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.source === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {f.source === "admin" ? "管理员" : "客户"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{f.category}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {f.fileName} · {formatSize(f.fileSize)} · {f.chunkCount} 个知识块 · 上传人 {f.uploaderName} ·{" "}
                    {new Date(f.createdAt).toLocaleString("zh-CN")}
                  </p>
                  {f.parseError && <p className="text-xs text-red-500 mt-1">解析异常：{f.parseError}</p>}
                  {f.reviewNote && <p className="text-xs text-gray-500 mt-1">审核意见：{f.reviewNote}</p>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleDetail(f.id)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                      {detailId === f.id ? "收起" : "查看解析"}
                    </button>
                    <button onClick={() => handleDelete(f.id)} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                      删除
                    </button>
                  </div>
                  {f.status === "pending" && (
                    <div className="flex gap-1.5">
                      <button onClick={() => handleReview(f.id, "approve")} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                        通过
                      </button>
                      <button onClick={() => handleReview(f.id, "reject")} className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                        驳回
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 知识块详情 */}
              {detailId === f.id && (
                <div className="mt-4 border-t border-gray-100 pt-4 space-y-2 max-h-80 overflow-y-auto">
                  {detailLoading ? (
                    <p className="text-xs text-gray-500">加载中...</p>
                  ) : detailChunks.length === 0 ? (
                    <p className="text-xs text-gray-400">无可显示的知识块</p>
                  ) : (
                    detailChunks.map((c) => (
                      <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500">块 #{c.seq + 1}</span>
                          {c.keywords && <span className="text-xs text-blue-500">关键词：{c.keywords}</span>}
                        </div>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{c.content}</pre>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
