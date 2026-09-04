"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface ProfileData {
  id: number;
  username: string;
  realName: string;
  email: string | null;
  phone: string | null;
  roleName: string;
  roleCode: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ realName: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) return;
    const res = await fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      setProfile(data.data);
      setForm({
        realName: data.data.realName || '',
        email: data.data.email || '',
        phone: data.data.phone || '',
      });
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchProfile();
    }
  }, [authLoading, user, router, fetchProfile]);

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const token = Cookies.get("token");
    if (!token) return;
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      setMessage('保存成功');
      fetchProfile();
    } else {
      setError(data.error || '保存失败');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const token = Cookies.get("token");
    if (!token) return;
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(passwordForm),
    });
    const data = await res.json();
    if (data.success) {
      setMessage('密码修改成功');
      setPasswordForm({ oldPassword: '', newPassword: '' });
    } else {
      setError(data.error || '修改失败');
    }
  };

  if (authLoading || !user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">个人中心</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">账号信息</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">用户名</p>
            <p className="font-medium">{profile.username}</p>
          </div>
          <div>
            <p className="text-gray-500">角色</p>
            <p className="font-medium">{profile.roleName}</p>
          </div>
          <div>
            <p className="text-gray-500">最近登录</p>
            <p className="font-medium">
              {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('zh-CN') : '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">注册时间</p>
            <p className="font-medium">
              {new Date(profile.createdAt).toLocaleDateString('zh-CN')}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">编辑资料</h2>
        {message && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg mb-3 text-sm">{message}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg mb-3 text-sm">{error}</div>}
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input type="text" required value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">保存资料</button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">修改密码</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">原密码</label>
            <input type="password" required value={passwordForm.oldPassword} onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
            <input type="password" required minLength={6} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">修改密码</button>
        </form>
      </div>
    </main>
  );
}
