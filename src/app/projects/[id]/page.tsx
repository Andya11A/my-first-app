"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface ProjectDetail {
  id: number;
  projectName: string;
  labTypeId: number;
  labType: { typeName: string };
  area: number;
  cleanLevel: string;
  budgetLevel: string;
  status: string;
  specialRequirements: string | null;
  generatedJson: string;
  preciseQuoteJson: string | null;
  createdById: number | null;
  createdBy: { realName: string } | null;
  createdAt: string;
}

interface QuoteData {
  equipmentList: { id: number; equipmentName: string; specification: string; unit: string; quantity: number; unitPrice: number; subtotal: number }[];
  constructionList: { id: number; itemName: string; unit: string; quantity: number; unitPrice: number; subtotal: number; category: string }[];
  equipmentTotal: number;
  constructionTotal: number;
  managementFee: number;
  profit: number;
  grandTotal: number;
  quoteComparison: { levelName: string; grandTotal: number }[];
}

interface LabType {
  id: number;
  typeName: string;
  cleanLevelDefault: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  archived: '已归档',
};

const CLEAN_LEVELS = ['普通', '十万级', '万级', '千级'];
const BUDGET_LEVELS = ['经济型', '标准型', '高端型'];
const EDITABLE_STATUSES = ['draft', 'rejected'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [labTypes, setLabTypes] = useState<LabType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'equipment' | 'construction' | 'comparison'>('info');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState('');
  const [editForm, setEditForm] = useState({
    projectName: '',
    labTypeId: 0,
    area: 0,
    cleanLevel: '',
    budgetLevel: '',
    specialRequirements: '',
    regenerate: true,
  });

  const fetchProject = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.data);
        if (data.data.generatedJson) {
          setQuote(JSON.parse(data.data.generatedJson));
        } else {
          setQuote(null);
        }
      } else {
        router.push('/projects');
      }
    } catch {
      router.push('/projects');
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchProject();
      fetch("/api/lab-types")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setLabTypes(data.data);
        })
        .catch(() => {});
    }
  }, [authLoading, user, router, fetchProject]);

  const startEdit = () => {
    if (!project) return;
    setEditForm({
      projectName: project.projectName,
      labTypeId: project.labTypeId,
      area: Number(project.area),
      cleanLevel: project.cleanLevel,
      budgetLevel: project.budgetLevel,
      specialRequirements: project.specialRequirements || '',
      regenerate: true,
    });
    setActionError('');
    setEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setSaving(true);
    setActionError('');
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectName: editForm.projectName,
          labTypeId: Number(editForm.labTypeId),
          area: Number(editForm.area),
          cleanLevel: editForm.cleanLevel,
          budgetLevel: editForm.budgetLevel,
          specialRequirements: editForm.specialRequirements || null,
          regenerate: editForm.regenerate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditing(false);
        fetchProject();
      } else {
        setActionError(data.error || '保存失败');
      }
    } catch {
      setActionError('网络错误');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!project) return;
    setRegenerating(true);
    setActionError('');
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ regenerate: true }),
      });
      const data = await res.json();
      if (data.success) {
        fetchProject();
      } else {
        setActionError(data.error || '重新生成失败');
      }
    } catch {
      setActionError('网络错误');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!confirm(`确定删除项目「${project.projectName}」吗？删除后不可恢复。`)) return;
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        router.push('/projects');
      } else {
        setActionError(data.error || '删除失败');
      }
    } catch {
      setActionError('网络错误');
    }
  };

  if (authLoading || !user || loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const canEdit =
    EDITABLE_STATUSES.includes(project.status) &&
    (user.dataScope === 'all' || project.createdById === user.id);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← 返回列表
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{project.projectName}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {project.labType.typeName} | {Number(project.area)}㎡ | {project.cleanLevel} | {project.budgetLevel}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              project.status === 'approved' ? 'bg-green-100 text-green-700' :
              project.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              project.status === 'rejected' ? 'bg-red-100 text-red-700' :
              project.status === 'archived' ? 'bg-blue-100 text-blue-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              {STATUS_LABELS[project.status] || project.status}
            </span>
            <button
              onClick={() => router.push(`/precise-quote?projectId=${project.id}&projectName=${encodeURIComponent(project.projectName)}`)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
            >
              💰 精确报价
            </button>
            {project.preciseQuoteJson && (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 whitespace-nowrap">
                ✓ 已保存精确报价
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 text-sm">
          <div>
            <p className="text-gray-500 text-xs">创建人</p>
            <p className="font-medium">{project.createdBy?.realName || '未知'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">创建时间</p>
            <p className="font-medium">{new Date(project.createdAt).toLocaleDateString('zh-CN')}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">最终报价</p>
            <p className="font-medium text-blue-600">
              {quote ? formatCurrency(quote.grandTotal) : '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">特殊要求</p>
            <p className="font-medium truncate" title={project.specialRequirements || ''}>
              {project.specialRequirements || '无'}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        {canEdit && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            {!editing && (
              <button
                onClick={startEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                编辑项目
              </button>
            )}
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {regenerating ? '重新计算中...' : '重新生成报价'}
            </button>
            <button
              onClick={() => router.push(`/designer?projectId=${project.id}`)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
            >
              🎨 平面设计
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              删除项目
            </button>
          </div>
        )}
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg mt-3 text-sm">
            {actionError}
          </div>
        )}
      </div>

      {/* 编辑表单 */}
      {editing && (
        <form onSubmit={handleSaveEdit} className="bg-white rounded-xl border border-blue-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">编辑项目</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">项目名称 *</label>
              <input
                type="text"
                required
                value={editForm.projectName}
                onChange={(e) => setEditForm({ ...editForm, projectName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">实验室类型 *</label>
              <select
                required
                value={editForm.labTypeId}
                onChange={(e) => setEditForm({ ...editForm, labTypeId: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {labTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.typeName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">面积（㎡）*</label>
              <input
                type="number"
                required
                min={1}
                max={10000}
                value={editForm.area}
                onChange={(e) => setEditForm({ ...editForm, area: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">洁净等级 *</label>
              <select
                required
                value={editForm.cleanLevel}
                onChange={(e) => setEditForm({ ...editForm, cleanLevel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {CLEAN_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">预算档位 *</label>
              <select
                required
                value={editForm.budgetLevel}
                onChange={(e) => setEditForm({ ...editForm, budgetLevel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {BUDGET_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">特殊要求</label>
              <input
                type="text"
                value={editForm.specialRequirements}
                onChange={(e) => setEditForm({ ...editForm, specialRequirements: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={editForm.regenerate}
              onChange={(e) => setEditForm({ ...editForm, regenerate: e.target.checked })}
              className="w-4 h-4"
            />
            保存后按新参数重新生成报价
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存修改'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setActionError(''); }}
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 font-medium"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* Tab切换 */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('info')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'info' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>基本信息</button>
        {quote && (
          <>
            <button onClick={() => setActiveTab('equipment')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'equipment' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>设备清单</button>
            <button onClick={() => setActiveTab('construction')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'construction' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>工程量</button>
            <button onClick={() => setActiveTab('comparison')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'comparison' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>三档报价</button>
          </>
        )}
      </div>

      {activeTab === 'info' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">项目信息</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">实验室类型</span><span>{project.labType.typeName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">面积</span><span>{Number(project.area)}㎡</span></div>
            <div className="flex justify-between"><span className="text-gray-500">洁净等级</span><span>{project.cleanLevel}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">预算档位</span><span>{project.budgetLevel}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">特殊要求</span><span>{project.specialRequirements || '无'}</span></div>
          </div>
        </div>
      )}

      {activeTab === 'equipment' && quote && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3">设备名称</th>
                <th className="text-left px-4 py-3">规格</th>
                <th className="text-center px-4 py-3">数量</th>
                <th className="text-right px-4 py-3">单价</th>
                <th className="text-right px-4 py-3">小计</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quote.equipmentList.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.equipmentName}</td>
                  <td className="px-4 py-3 text-gray-500">{item.specification}</td>
                  <td className="px-4 py-3 text-center">{item.quantity}{item.unit}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-medium">设备总价</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">{formatCurrency(quote.equipmentTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {activeTab === 'construction' && quote && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3">项目</th>
                <th className="text-center px-4 py-3">分类</th>
                <th className="text-center px-4 py-3">工程量</th>
                <th className="text-right px-4 py-3">单价</th>
                <th className="text-right px-4 py-3">小计</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quote.constructionList.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.itemName}</td>
                  <td className="px-4 py-3 text-center text-xs text-blue-600">{item.category}</td>
                  <td className="px-4 py-3 text-center">{item.quantity}{item.unit}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-medium">工程量总价</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">{formatCurrency(quote.constructionTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {activeTab === 'comparison' && quote && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quote.quoteComparison.map((q) => (
            <div key={q.levelName} className={`bg-white rounded-xl border p-5 text-center ${q.levelName === project.budgetLevel ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}`}>
              <p className="font-medium text-gray-900 mb-2">{q.levelName}</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(q.grandTotal)}</p>
              {q.levelName === project.budgetLevel && (
                <p className="text-xs text-blue-500 mt-1">当前选择</p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
