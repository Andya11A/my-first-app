"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface LabType {
  id: number;
  typeName: string;
  cleanLevelDefault: string;
  pressureRequirement: string;
  tempHumidity: string;
  airChangesPerHour: number;
  illuminationLux: number;
  notes: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [labTypes, setLabTypes] = useState<LabType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    projectName: "",
    labTypeId: 0,
    area: 100,
    cleanLevel: "",
    budgetLevel: "标准型",
    specialRequirements: "",
  });

  // 登录检查
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  // 加载实验室类型
  useEffect(() => {
    if (!user) return;
    fetch("/api/lab-types")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          setLabTypes(data.data);
          setForm((prev) => ({
            ...prev,
            labTypeId: data.data[0].id,
            cleanLevel: data.data[0].cleanLevelDefault,
          }));
        }
        setLoadingTypes(false);
      })
      .catch(() => {
        setError("加载实验室类型失败，请刷新重试");
        setLoadingTypes(false);
      });
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 text-lg">加载中...</p>
      </div>
    );
  }

  const handleLabTypeChange = (labTypeId: number) => {
    const selected = labTypes.find((t) => t.id === labTypeId);
    setForm((prev) => ({
      ...prev,
      labTypeId,
      cleanLevel: selected?.cleanLevelDefault || prev.cleanLevel,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const token = document.cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1] || "";
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, createdById: user.id }),
      });

      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("lastQuote", JSON.stringify(data.data.quote));
        router.push(`/result?projectId=${data.data.projectId}`);
      } else {
        setError(data.error || "生成报价失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* 导航栏 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <a href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">新建报价</a>
        <a href="/projects" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">项目列表</a>
        <a href="/approvals" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">审批中心</a>
        <a href="/messages" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">消息中心</a>
        <a href="/dashboard" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">数据看板</a>
        <a href="/drawing" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">图纸识别</a>
        <a href="/analyze" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">参考图分析</a>
        <a href="/analyze-video" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">视频分析</a>
        <a href="/designer" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">平面设计</a>
        <a href="/calc-engine" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">计算引擎V2</a>
        <a href="/design-check" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">工艺检查</a>
        <a href="/process-recommend" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">环保推荐</a>
        <a href="/precise-quote" className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100">报价中心</a>
        <a href="/admin/knowledge-center" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">知识库</a>
        <a href="/quick-reference" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">📋 标准速查表</a>
        <a href="/advisor" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">智能顾问</a>
        <a href="/profile" className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">个人中心</a>
        {["admin", "super_admin"].includes(user.roleCode) && (
          <a href="/admin/knowledge" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">知识库管理</a>
        )}
        {["admin", "super_admin"].includes(user.roleCode) && (
          <a href="/admin/assistant" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500">AI 知识助手</a>
        )}
      </div>

      {/* 顶部用户栏 */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium">
            {user.realName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{user.realName}</p>
            <p className="text-xs text-gray-500">{user.roleName}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          退出登录
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          实验室方案书与报价生成工具
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          填写需求，自动生成设备清单、工程量估算与报价区间
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              项目名称 *
            </label>
            <input
              type="text"
              required
              value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              placeholder="如：某医院PCR实验室建设项目"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                实验室类型 *
              </label>
              <select
                required
                value={form.labTypeId}
                onChange={(e) => handleLabTypeChange(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                {labTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.typeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                面积（㎡）*
              </label>
              <input
                type="number"
                required
                min={1}
                max={10000}
                value={form.area}
                onChange={(e) => setForm({ ...form, area: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                洁净等级 *
              </label>
              <select
                required
                value={form.cleanLevel}
                onChange={(e) => setForm({ ...form, cleanLevel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="普通">普通</option>
                <option value="十万级">十万级</option>
                <option value="万级">万级</option>
                <option value="千级">千级</option>
                <option value="百级">百级</option>
                <option value="SPF级">SPF级</option>
                <option value="特殊">特殊</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                预算档位 *
              </label>
              <select
                required
                value={form.budgetLevel}
                onChange={(e) => setForm({ ...form, budgetLevel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="经济型">经济型</option>
                <option value="标准型">标准型</option>
                <option value="高端型">高端型</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              特殊要求
            </label>
            <textarea
              rows={3}
              value={form.specialRequirements}
              onChange={(e) => setForm({ ...form, specialRequirements: e.target.value })}
              placeholder="如：需要预留UPS接口、房间需分4个区域、需要气瓶间等"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loadingTypes}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {submitting ? "生成中..." : "生成方案与报价"}
          </button>
        </form>
      </div>
    </main>
  );
}
