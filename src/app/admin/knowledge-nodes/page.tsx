"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface NodeItem {
  id: number;
  nodeCode: string;
  industry: string;
  facilityType: string;
  environment: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface NodeDetail {
  id: number;
  nodeCode: string;
  industry: string;
  facilityType: string;
  environment: string;
  title: string;
  summary: string;
  regulations: string;
  chapters: string;
  clauses: string;
  parameters: string;
  logic: string;
  crossLinks: string;
  lifecycle: string;
  status: string;
  moduleCode: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  review: "待审核",
  verified: "已通过",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  review: "bg-yellow-100 text-yellow-700",
  verified: "bg-green-100 text-green-700",
};

export default function KnowledgeNodesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [filter, setFilter] = useState("draft");
  const [sourceFilter, setSourceFilter] = useState("system");
  const [selected, setSelected] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchNodes = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) return;
    setLoading(true);
    const res = await fetch(`/api/assistant/knowledge-nodes?status=${filter}&source=${sourceFilter}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setNodes(data.data);
    setLoading(false);
  }, [filter, sourceFilter]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && user.roleCode !== "super_admin" && user.roleCode !== "admin") {
      router.push("/");
      return;
    }
    if (user) fetchNodes();
  }, [authLoading, user, router, fetchNodes]);

  const openNode = async (id: number) => {
    const token = Cookies.get("token");
    const res = await fetch(`/api/assistant/knowledge-nodes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setSelected(data.data);
  };

  const updateField = (field: string, value: string) => {
    if (!selected) return;
    setSelected({ ...selected, [field]: value });
  };

  const saveNode = async (newStatus?: string) => {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const token = Cookies.get("token");
    const body: Record<string, unknown> = {
      title: selected.title,
      industry: selected.industry,
      facilityType: selected.facilityType,
      environment: selected.environment,
      summary: selected.summary,
      regulations: selected.regulations,
      chapters: selected.chapters,
      clauses: selected.clauses,
      parameters: selected.parameters,
      logic: selected.logic,
      crossLinks: selected.crossLinks,
      lifecycle: selected.lifecycle,
    };
    if (newStatus) body.status = newStatus;

    const res = await fetch(`/api/assistant/knowledge-nodes/${selected.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      setMessage(newStatus ? `已保存并转为「${STATUS_LABELS[newStatus]}」` : "已保存");
      setSelected({ ...selected, status: newStatus || selected.status });
      fetchNodes();
    } else {
      setMessage(`保存失败：${data.error || "未知错误"}`);
    }
    setSaving(false);
  };

  const deleteNode = async () => {
    if (!selected) return;
    if (!confirm("确认删除此节点？删除后不可恢复。")) return;
    const token = Cookies.get("token");
    const res = await fetch(`/api/assistant/knowledge-nodes/${selected.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      setSelected(null);
      setMessage("已删除");
      fetchNodes();
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
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识节点审核台</h1>
          <p className="text-gray-500 text-sm mt-1">
            AI 生成七层知识节点，你审核通过后 AI 助手才能调用（verified）
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/knowledge-center")}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm"
        >
          ← 知识管理中心
        </button>
      </div>

      {/* 来源 Tab 切换 */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setSourceFilter("system")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            sourceFilter === "system" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"
          }`}
        >
          📋 系统节点
        </button>
        <button
          onClick={() => setSourceFilter("auto")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            sourceFilter === "auto" ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600"
          }`}
        >
          💬 问答沉淀
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2 mb-4">
        {["draft", "review", "verified"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === s ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            {STATUS_LABELS[s]}（{filter === s ? nodes.length : "?"}）
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 节点列表 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-fit">
          {loading ? (
            <div className="p-6 text-gray-500 text-sm">加载中...</div>
          ) : nodes.length === 0 ? (
            <div className="p-6 text-gray-400 text-sm">暂无「{STATUS_LABELS[filter]}」状态的节点</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {nodes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNode(n.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                    selected?.id === n.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{n.nodeCode}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[n.status]}`}>
                      {STATUS_LABELS[n.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{n.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {n.industry} | 更新于 {new Date(n.updatedAt).toLocaleDateString("zh-CN")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 节点详情编辑区 */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              点击左侧节点查看和编辑七层内容
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-gray-500">节点编号</label>
                    <p className="text-sm font-medium">{selected.nodeCode}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">状态</label>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[selected.status]}`}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">行业</label>
                    <input
                      value={selected.industry}
                      onChange={(e) => updateField("industry", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">设施形态</label>
                    <input
                      value={selected.facilityType}
                      onChange={(e) => updateField("facilityType", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500">标题</label>
                    <input
                      value={selected.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500">工艺环境</label>
                    <input
                      value={selected.environment}
                      onChange={(e) => updateField("environment", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                    />
                  </div>
                </div>

                {/* L0 */}
                <FieldBlock label="L0 坐标确认" value={selected.summary} onChange={(v) => updateField("summary", v)} />
                {/* L1-L7 */}
                <FieldBlock label="L1 规范清单（JSON）" value={selected.regulations} onChange={(v) => updateField("regulations", v)} tall />
                <FieldBlock label="L2 章节定位（JSON）" value={selected.chapters} onChange={(v) => updateField("chapters", v)} tall />
                <FieldBlock label="L3 条文内容" value={selected.clauses} onChange={(v) => updateField("clauses", v)} tall />
                <FieldBlock label="L4 设计参数（JSON）" value={selected.parameters} onChange={(v) => updateField("parameters", v)} tall />
                <FieldBlock label="L5 工艺逻辑" value={selected.logic} onChange={(v) => updateField("logic", v)} tall />
                <FieldBlock label="L6 组合关系（JSON）" value={selected.crossLinks} onChange={(v) => updateField("crossLinks", v)} tall />
                <FieldBlock label="L7 生命周期（JSON）" value={selected.lifecycle} onChange={(v) => updateField("lifecycle", v)} tall />
              </div>

              {/* 操作按钮 */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => saveNode()}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存"}
                </button>

                {selected.status === "draft" && (
                  <button
                    onClick={() => saveNode("review")}
                    disabled={saving}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 disabled:opacity-50"
                  >
                    提交审核
                  </button>
                )}

                {selected.status === "review" && (
                  <button
                    onClick={() => saveNode("verified")}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    ✓ 审核通过（供 AI 调用）
                  </button>
                )}

                {selected.status === "verified" && (
                  <button
                    onClick={() => saveNode("draft")}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50"
                  >
                    退回草稿
                  </button>
                )}

                <button
                  onClick={deleteNode}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
                >
                  删除
                </button>

                {message && (
                  <span className={`text-sm ${message.startsWith("保存失败") ? "text-red-600" : "text-green-600"}`}>
                    {message}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

// 七层字段编辑块组件
function FieldBlock({
  label,
  value,
  onChange,
  tall = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tall?: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {tall ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-1 font-mono"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-1"
        />
      )}
    </div>
  );
}
