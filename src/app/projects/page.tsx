"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface ProjectItem {
  id: number;
  projectName: string;
  labTypeId: number;
  labTypeName: string;
  area: number;
  cleanLevel: string;
  budgetLevel: string;
  status: string;
  createdByName: string;
  createdAt: string;
}

interface LabType {
  id: number;
  typeName: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  pending: { label: '待审批', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
  archived: { label: '已归档', color: 'bg-blue-100 text-blue-600' },
};

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [labTypes, setLabTypes] = useState<LabType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchProjects = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.append("keyword", keyword);
      if (statusFilter) params.append("status", statusFilter);
      if (typeFilter) params.append("labTypeId", typeFilter);
      params.append("page", String(page));
      params.append("pageSize", "20");

      const res = await fetch(`/api/projects?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProjects(data.data.projects);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      } else {
        setError(data.error || "获取项目列表失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, [keyword, statusFilter, typeFilter, page]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetch("/api/lab-types")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setLabTypes(data.data);
        })
        .catch(() => {});
      fetchProjects();
    }
  }, [authLoading, user, router, fetchProjects]);

  const handleStatusChange = async (projectId: number, status: string, comment?: string) => {
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, comment }),
      });
      const data = await res.json();
      if (data.success) {
        fetchProjects();
      } else {
        alert(data.error || "操作失败");
      }
    } catch {
      alert("网络错误");
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchProjects();
  };

  const handleReset = () => {
    setKeyword("");
    setStatusFilter("");
    setTypeFilter("");
    setPage(1);
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
          <h1 className="text-2xl font-bold text-gray-900">项目管理</h1>
          <p className="text-gray-500 text-sm mt-1">
            {user.dataScope === 'all' ? '查看全部项目' : '查看我的项目'}（共{total}个）
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + 新建项目
        </button>
      </div>

      {/* 搜索筛选区 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索项目名称..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending">待审批</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
            <option value="archived">已归档</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="">全部类型</option>
            {labTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.typeName}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              搜索
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">暂无符合条件的项目</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">项目名称</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">类型</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">面积</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">创建人</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">创建时间</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((p) => {
                  const status = STATUS_MAP[p.status] || STATUS_MAP.draft;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.projectName}</td>
                      <td className="px-4 py-3 text-gray-600">{p.labTypeName}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{p.area}㎡</td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.createdByName}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 justify-center">
                          {p.status === 'draft' && (
                            <button
                              onClick={() => handleStatusChange(p.id, 'pending')}
                              className="text-yellow-600 hover:underline text-xs"
                            >
                              提交审批
                            </button>
                          )}
                          {p.status === 'pending' && user.dataScope === 'all' && (
                            <>
                              <button
                                onClick={() => {
                                  const comment = prompt('审批意见（可选）：');
                                  handleStatusChange(p.id, 'approved', comment || undefined);
                                }}
                                className="text-green-600 hover:underline text-xs"
                              >
                                通过
                              </button>
                              <button
                                onClick={() => {
                                  const comment = prompt('驳回原因：');
                                  handleStatusChange(p.id, 'rejected', comment || undefined);
                                }}
                                className="text-red-600 hover:underline text-xs"
                              >
                                驳回
                              </button>
                            </>
                          )}
                          {(p.status === 'approved' || p.status === 'rejected') && (
                            <button
                              onClick={() => handleStatusChange(p.id, 'archived')}
                              className="text-blue-600 hover:underline text-xs"
                            >
                              归档
                            </button>
                          )}
                          {p.status === 'archived' && (
                            <button
                              onClick={() => handleStatusChange(p.id, 'draft')}
                              className="text-gray-500 hover:underline text-xs"
                            >
                              恢复
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
