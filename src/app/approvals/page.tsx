"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface ApprovalItem {
  id: number;
  projectId: number;
  projectName: string;
  labTypeName: string;
  area: number;
  approverName: string;
  status: string;
  comment: string | null;
  createdAt: string;
  approvedAt: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
};

export default function ApprovalsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const fetchApprovals = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const res = await fetch("/api/approvals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setApprovals(data.data);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchApprovals();
    }
  }, [authLoading, user, router, fetchApprovals]);

  const filtered = filter === 'all' ? approvals : approvals.filter((a) => a.status === filter);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">审批中心</h1>
          <p className="text-gray-500 text-sm mt-1">
            {user.dataScope === 'all' ? '全部审批记录' : '我的审批记录'}
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? '全部' : f === 'pending' ? '待审批' : f === 'approved' ? '已通过' : '已驳回'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">暂无审批记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">项目名称</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">类型</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">面积</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">审批人</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">审批意见</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">提交时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => {
                const status = STATUS_MAP[a.status] || STATUS_MAP.pending;
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.projectName}</td>
                    <td className="px-4 py-3 text-gray-600">{a.labTypeName}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{a.area}㎡</td>
                    <td className="px-4 py-3 text-gray-600">{a.approverName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.comment || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(a.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
