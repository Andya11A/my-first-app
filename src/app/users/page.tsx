"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface UserItem {
  id: number;
  username: string;
  realName: string;
  email: string | null;
  phone: string | null;
  roleName: string;
  roleCode: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface RoleItem {
  id: number;
  roleName: string;
  roleCode: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) return;
    const [usersRes, rolesRes] = await Promise.all([
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/roles", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const usersData = await usersRes.json();
    const rolesData = await rolesRes.json();
    if (usersData.success) setUsers(usersData.data);
    if (rolesData.success) setRoles(rolesData.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && user.roleCode === 'super_admin') {
      fetchUsers();
    } else if (user) {
      router.push("/");
    }
  }, [authLoading, user, router, fetchUsers]);

  const handleUpdate = async (userId: number, data: { roleId?: number; status?: string }) => {
    const token = Cookies.get("token");
    if (!token) return;
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: userId, ...data }),
    });
    const result = await res.json();
    if (result.success) {
      fetchUsers();
    } else {
      alert(result.error || '操作失败');
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
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">用户管理</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">用户名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">角色</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">最近登录</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">{u.realName}</td>
                  <td className="px-4 py-3">
                    <select
                      value={roles.find((r) => r.roleCode === u.roleCode)?.id || ''}
                      onChange={(e) => handleUpdate(u.id, { roleId: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-2 py-1 text-xs"
                      disabled={u.username === 'admin'}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.roleName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.status === 'active' ? '正常' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.username !== 'admin' && (
                      <button
                        onClick={() => handleUpdate(u.id, { status: u.status === 'active' ? 'disabled' : 'active' })}
                        className={`text-xs hover:underline ${
                          u.status === 'active' ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {u.status === 'active' ? '禁用' : '启用'}
                      </button>
                    )}
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
