"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface LogItem {
  id: number;
  userName: string;
  action: string;
  targetType: string;
  detail: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  upload: '上传',
  login: '登录',
  logout: '退出',
};

const TYPE_LABELS: Record<string, string> = {
  project: '项目',
  document: '文档',
  note: '笔记',
  equipment: '设备',
  user: '用户',
};

export default function LogsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    const token = Cookies.get('token');
    if (!token) return;
    const params = new URLSearchParams();
    if (actionFilter) params.append('action', actionFilter);
    if (typeFilter) params.append('targetType', typeFilter);
    const res = await fetch(`/api/logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setLogs(data.data);
    setLoading(false);
  }, [actionFilter, typeFilter]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && user.roleCode !== 'super_admin') {
      router.push('/');
      return;
    }
    if (user) fetchLogs();
  }, [authLoading, user, router, fetchLogs]);

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
          <h1 className="text-2xl font-bold text-gray-900">操作日志</h1>
          <p className="text-gray-500 text-sm mt-1">系统操作记录（仅超管可见）</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm"
        >
          返回
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">全部操作</option>
          <option value="create">创建</option>
          <option value="update">更新</option>
          <option value="delete">删除</option>
          <option value="upload">上传</option>
          <option value="login">登录</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">全部类型</option>
          <option value="document">文档</option>
          <option value="note">笔记</option>
          <option value="project">项目</option>
          <option value="equipment">设备</option>
          <option value="user">用户</option>
        </select>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
          筛选
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400">暂无日志</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3">用户</th>
                <th className="text-left px-4 py-3">操作</th>
                <th className="text-left px-4 py-3">对象</th>
                <th className="text-left px-4 py-3">详情</th>
                <th className="text-left px-4 py-3">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{log.userName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      log.action === 'delete' ? 'bg-red-100 text-red-700' :
                      log.action === 'create' || log.action === 'upload' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {TYPE_LABELS[log.targetType] || log.targetType}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.detail || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
