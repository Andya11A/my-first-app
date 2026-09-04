"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";
import Toast from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

interface KnowledgeDoc {
  id: number;
  title: string;
  docType: string;
  fileName: string;
  chunkCount: number;
  extractResults: string | null;
  createdAt: string;
}

interface LabType {
  id: number;
  typeName: string;
}

interface EquipmentItem {
  name: string;
  price: number | string | null;
}

export default function KnowledgeCenterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [docType, setDocType] = useState('技术资料');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [labTypes, setLabTypes] = useState<LabType[]>([]);
  const [selectedLabTypeId, setSelectedLabTypeId] = useState(0);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'upload'>('list');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<{ id: number; title: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 权限检查
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      router.push('/');
    }
  }, [authLoading, user, router]);

  const fetchDocs = useCallback(async () => {
    const token = Cookies.get('token');
    if (!token) return;
    const params = new URLSearchParams();
    if (searchKeyword.trim()) params.append('keyword', searchKeyword.trim());
    const res = await fetch(`/api/assistant/knowledge?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setDocs(data.data);
  }, [searchKeyword]);

  const fetchLabTypes = useCallback(async () => {
    const res = await fetch('/api/lab-types');
    const data = await res.json();
    if (data.success && data.data.length > 0) {
      setLabTypes(data.data);
      setSelectedLabTypeId(data.data[0].id);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchDocs();
      fetchLabTypes();
    }
  }, [user, fetchDocs, fetchLabTypes]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    if (selectedFiles.length > 10) {
      setMessage('最多一次上传10个文件');
      return;
    }
    setFiles(selectedFiles);
    setMessage('');
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage('请先选择文件');
      return;
    }

    setUploading(true);
    setMessage(`开始批量上传 ${files.length} 个文件...`);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });

      setMessage(`正在处理 ${i + 1}/${files.length}：${file.name}`);

      // 先上传原始文件
      let originalFileUrl: string | null = null;
      try {
        const uploadForm = new FormData();
        uploadForm.append('file', file);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${Cookies.get('token')}` },
          body: uploadForm,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          originalFileUrl = uploadData.data.fileUrl;
        }
      } catch {
        // 原始文件上传失败不阻断
      }

      // 解析文件
      const parseRes = await fetch('http://localhost:5000/api/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, fileName: file.name }),
      });
      const parseData = await parseRes.json();

      if (!parseData.success) {
        failCount++;
        errors.push(`${file.name}: ${parseData.error}`);
        continue;
      }

      // 智能识别：检测是否是设备价格表
      const isEquipmentFile = parseData.data.equipmentItems && parseData.data.equipmentItems.length > 0;

      // 入库到知识库
      const token = Cookies.get('token');
      const saveRes = await fetch('/api/assistant/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, ''),
          docType: isEquipmentFile ? '设备价格表' : docType,
          fileName: file.name,
          fileSize: file.size,
          originalFileName: file.name,
          originalFilePath: originalFileUrl,
          chunks: parseData.data.chunks || [{
            title: '解析内容',
            content: parseData.data.fullText || JSON.stringify(parseData.data),
          }],
        }),
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        successCount++;
      } else {
        failCount++;
        errors.push(`${file.name}: ${saveData.error}`);
        continue;
      }

      // 如果是设备价格表，提示可导入报价
      if (isEquipmentFile) {
        setEquipmentItems(parseData.data.equipmentItems);
        setShowImport(true);
      }
    }

    setMessage(
      `✅ 上传完成：成功 ${successCount} 个，失败 ${failCount} 个${errors.length > 0 ? '\n' + errors.slice(0, 3).join('\n') : ''}`
    );
    setToast({
      message: failCount === 0 ? `上传成功 ${successCount} 个文件` : `成功 ${successCount} 个，失败 ${failCount} 个`,
      type: failCount === 0 ? 'success' : 'error',
    });
    setFiles([]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchDocs();
  };

  const handleImportEquipment = async () => {
    if (!equipmentItems.length || !selectedLabTypeId) return;
    setImporting(true);
    const token = Cookies.get('token');
    const res = await fetch('/api/feed/import-equipment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        labTypeId: selectedLabTypeId,
        equipmentItems,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage(`✅ 设备导入成功：新增 ${data.data.imported} 个，更新 ${data.data.updated} 个`);
      setShowImport(false);
      setEquipmentItems([]);
    } else {
      setMessage(`导入失败：${data.error}`);
    }
    setImporting(false);
  };

  const handleDeleteDoc = (docId: number) => {
    setConfirmDelete(docId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const token = Cookies.get('token');
    await fetch(`/api/assistant/knowledge?id=${confirmDelete}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setConfirmDelete(null);
    setToast({ message: '文档已删除', type: 'success' });
    fetchDocs();
  };

  const handleRename = async () => {
    if (!renamingDoc || !renamingDoc.title.trim()) return;
    const token = Cookies.get('token');
    await fetch('/api/assistant/knowledge', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ docId: renamingDoc.id, newTitle: renamingDoc.title }),
    });
    setRenamingDoc(null);
    setToast({ message: '文档已重命名', type: 'success' });
    fetchDocs();
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识管理中心</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传资料 → 自动解析入库 → AI 提炼问答 → 设备导入报价
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            文档列表（{docs.length}）
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'upload' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            上传文件
          </button>
          <button
            onClick={() => router.push('/admin/assistant')}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm"
          >
            AI 问答
          </button>
          <button
            onClick={() => router.push('/admin/knowledge-nodes')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            📋 节点审核台
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm"
          >
            返回首页
          </button>
        </div>
      </div>

      {activeTab === 'upload' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">上传文件（最多10个）</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">文档类型</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="技术资料">技术资料</option>
                <option value="国标规范">国标规范</option>
                <option value="招标文件">招标文件</option>
                <option value="公司案例">公司案例</option>
                <option value="设备手册">设备手册</option>
                <option value="其他">其他</option>
              </select>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer ${files.length > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
            >
              {files.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">已选择 {files.length} 个文件</p>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {files.map((f, i) => (
                      <p key={i} className="text-xs text-gray-600">{f.name}（{(f.size / 1024).toFixed(1)} KB）</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-4xl mb-2">📁</p>
                  <p className="text-gray-600">点击选择文件（可多选）</p>
                  <p className="text-gray-400 text-xs mt-1">
                    PDF / Word / Excel / 图片（OCR识别）
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.xlsm,.png,.jpg,.jpeg,.bmp,.webp"
                onChange={handleFileChange}
                className="hidden"
                multiple
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="w-full mt-4 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg"
            >
              {uploading ? '上传解析中...' : files.length > 1 ? `批量上传 ${files.length} 个文件` : '上传并解析'}
            </button>

            {message && (
              <div className={`mt-4 px-4 py-3 rounded-lg text-sm whitespace-pre-wrap ${message.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {message}
              </div>
            )}
          </div>

          {/* 设备导入提示 */}
          {showImport && equipmentItems.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <h3 className="font-semibold text-yellow-800 mb-3">
                🎯 检测到设备价格表（{equipmentItems.length} 台设备）
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">导入到哪个实验室类型？</label>
                <select
                  value={selectedLabTypeId}
                  onChange={(e) => setSelectedLabTypeId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {labTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.typeName}</option>
                  ))}
                </select>
              </div>
              <div className="max-h-40 overflow-y-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2">设备名称</th>
                      <th className="text-right px-3 py-2">价格</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {equipmentItems.slice(0, 20).map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-right">
                          {typeof item.price === 'number' ? item.price.toLocaleString() : item.price || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleImportEquipment}
                  disabled={importing}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:bg-green-300"
                >
                  {importing ? '导入中...' : '✅ 一键导入报价系统'}
                </button>
                <button
                  onClick={() => { setShowImport(false); setEquipmentItems([]); }}
                  className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm"
                >
                  跳过
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 搜索框 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDocs()}
              placeholder="搜索文档标题/类型/内容..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            />
            <button onClick={fetchDocs} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm">
              搜索
            </button>
          </div>

          {/* 文档列表 */}
          {docs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200">
              <EmptyState
                icon="📚"
                title="暂无文档"
                description="切到「上传文件」添加文档，支持 PDF/Word/Excel/图片"
                actionText="去上传文件"
                onAction={() => setActiveTab('upload')}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3">标题</th>
                    <th className="text-left px-4 py-3">类型</th>
                    <th className="text-center px-4 py-3">片段</th>
                    <th className="text-center px-4 py-3">提炼状态</th>
                    <th className="text-left px-4 py-3">上传时间</th>
                    <th className="text-center px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {renamingDoc?.id === doc.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              value={renamingDoc.title}
                              onChange={(e) => setRenamingDoc({ ...renamingDoc, title: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                            />
                            <button onClick={handleRename} className="text-green-600 text-xs">保存</button>
                            <button onClick={() => setRenamingDoc(null)} className="text-gray-400 text-xs">取消</button>
                          </div>
                        ) : (
                          <>
                            {doc.title}
                            {doc.extractResults && (
                              <span className="ml-2 text-xs text-green-600">✓已提炼</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{doc.docType}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{doc.chunkCount}</td>
                      <td className="px-4 py-3 text-center">
                        {doc.extractResults ? (
                          <span className="text-green-600">✅</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setRenamingDoc({ id: doc.id, title: doc.title })}
                            className="text-gray-400 hover:text-blue-500 text-xs"
                          >
                            重命名
                          </button>
                          <button
                            onClick={() => router.push(`/admin/doc-viewer?docId=${doc.id}`)}
                            className="text-purple-500 hover:underline text-xs"
                          >
                            查看
                          </button>
                          <button
                            onClick={() => router.push(`/admin/assistant?tab=knowledge&docId=${doc.id}`)}
                            className="text-blue-500 hover:underline text-xs"
                          >
                            提炼
                          </button>
                          {doc.extractResults && (
                            <a
                              href={`/api/assistant/export-result?docId=${doc.id}&token=${Cookies.get('token')}`}
                              className="text-green-500 hover:underline text-xs"
                            >
                              导出
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="text-red-500 hover:underline text-xs"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="删除文档"
          message="确定要删除这个文档吗？删除后不可恢复。"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}
