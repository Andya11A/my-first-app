"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface DashboardData {
  totalProjects: number;
  pendingCount: number;
  totalArea: number;
  statusStats: { status: string; count: number }[];
  typeStats: { labTypeId: number; labTypeName: string; count: number }[];
  recentProjects: {
    id: number;
    projectName: string;
    labTypeName: string;
    area: number;
    status: string;
    createdByName: string;
    createdAt: string;
  }[];
  approvalRate: number;
  userCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  archived: '已归档',
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
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
      fetchDashboard();
    }
  }, [authLoading, user, router, fetchDashboard]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">数据看板</h1>

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">项目总数</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{data.totalProjects}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">待审批</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{data.pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">总面积（㎡）</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{data.totalArea}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">审批通过率</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{data.approvalRate}%</p>
        </div>
      </div>

      {/* 状态分布 + 类型分布 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">项目状态分布</h2>
          {data.statusStats.length === 0 ? (
            <p className="text-gray-400 text-sm">暂无数据</p>
          ) : (
            <div className="space-y-3">
              {data.statusStats.map((s) => (
                <div key={s.status} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-16">
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5">
                    <div
                      className="bg-blue-500 rounded-full h-5"
                      style={{
                        width: `${data.totalProjects > 0 ? (s.count / data.totalProjects) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">实验室类型分布</h2>
          {data.typeStats.length === 0 ? (
            <p className="text-gray-400 text-sm">暂无数据</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.typeStats.slice(0, 10).map((t) => (
                <div key={t.labTypeId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t.labTypeName}</span>
                  <span className="font-medium text-gray-900">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 最新项目 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">最新项目</h2>
        {data.recentProjects.length === 0 ? (
          <p className="text-gray-400 text-sm">暂无数据</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">项目名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">类型</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600">面积</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600">状态</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">创建人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentProjects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/result?projectId=${p.id}`)}>
                  <td className="px-4 py-2.5 font-medium">{p.projectName}</td>
                  <td className="px-4 py-2.5 text-gray-600">{p.labTypeName}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{p.area}㎡</td>
                  <td className="px-4 py-2.5 text-center text-gray-600">
                    {STATUS_LABELS[p.status] || p.status}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{p.createdByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 用户数（仅超管可见） */}
      {user.roleCode === 'super_admin' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">系统用户数</p>
          <p className="text-2xl font-bold text-gray-900">{data.userCount}</p>
        </div>
      )}
    </main>
  );
}
