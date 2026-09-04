"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface ParseResult {
  success: boolean;
  error?: string;
  fileType?: string;
  fileName?: string;
  summary?: {
    sheetCount?: number;
    totalRows?: number;
    equipmentCount?: number;
    paragraphCount?: number;
    tableCount?: number;
    extractedArea?: number | null;
    pageCount?: number;
    textLength?: number;
  };
  equipmentItems?: { name: string; price: number | string | null }[];
  constructionFactors?: { itemName: string; factorPerArea: number; unit: string; unitPrice: number | string | null }[];
  sheets?: { sheetName: string; rowCount: number; headers: string[]; dataRows: string[][] }[];
  tables?: { rowCount: number; headers: string[]; dataRows: string[][] }[];
  paragraphs?: string[];
  textContent?: string[];
  extractedInfo?: { area?: number | null };
}

export default function AdminFeedPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [selectedLabTypeId, setSelectedLabTypeId] = useState<number>(0);
  const [labTypes, setLabTypes] = useState<{ id: number; typeName: string }[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [histories, setHistories] = useState<ImportHistoryItem[]>([]);

  interface ImportHistoryItem {
    id: number;
    fileName: string;
    fileType: string;
    importMode: string;
    labTypeName: string;
    equipmentCount: number;
    factorCount: number;
    operator: string;
    createdAt: string;
  }

  const fetchHistories = () => {
    const token = Cookies.get("token");
    if (!token) return;
    fetch("/api/feed/history", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setHistories(data.data);
      })
      .catch(() => {});
  };

  // 加载实验室类型列表
  useEffect(() => {
    fetch("/api/lab-types")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          setLabTypes(data.data);
          setSelectedLabTypeId(data.data[0].id);
        }
      })
      .catch(() => {});
    fetchHistories();
  }, []);

  // 权限检查：仅管理员
  if (!authLoading && user && user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
    router.push('/');
    return null;
  }

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
    if (selectedFiles.length > 20) {
      setError("最多一次上传20个文件");
      return;
    }
    setFiles(selectedFiles);
    setParseResult(null);
    setError("");
    setSuccess("");
  };

  const handleParse = async () => {
    if (files.length === 0) {
      setError("请先选择文件");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    let successCount = 0;
    const results: { fileName: string; fileType: string; autoType: string; equipmentCount?: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });

      try {
        const res = await fetch("http://localhost:5000/api/parse-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileData, fileName: file.name }),
        });
        const data: ParseResult = await res.json();
        if (data.success) {
          successCount++;

          // 自动识别文件类型
          let autoType = "技术资料";
          const fileName = file.name.toLowerCase();
          const contentSummary = JSON.stringify(data).toLowerCase();

          if (data.equipmentItems && data.equipmentItems.length > 0) {
            autoType = "设备价格表";
          } else if (fileName.includes("gb") || fileName.includes("jgj") ||
                     contentSummary.includes("标准") || contentSummary.includes("规范") ||
                     contentSummary.includes("第.*条")) {
            autoType = "国标规范";
          } else if (contentSummary.includes("招标") || contentSummary.includes("中标") ||
                     contentSummary.includes("采购")) {
            autoType = "招标文件";
          } else if (fileName.includes("方案") || fileName.includes("案例")) {
            autoType = "公司案例";
          }

          results.push({
            fileName: file.name,
            fileType: data.fileType || "unknown",
            autoType,
            equipmentCount: data.equipmentItems?.length,
          });

          // 如果是最后一个文件，显示解析结果
          if (i === files.length - 1) {
            setParseResult(data);
          }

          // 同时自动存入 AI 知识库
          try {
            const token = Cookies.get("token");
            await fetch("/api/assistant/knowledge", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                title: file.name.replace(/\.[^.]+$/, ""),
                docType: autoType,
                fileName: file.name,
                fileSize: file.size,
                chunks: (data as { chunks?: { title: string; content: string }[] }).chunks || [{
                  title: "解析内容",
                  content: (data as { fullText?: string }).fullText || JSON.stringify(data),
                }],
              }),
            });
          } catch (err) {
            console.error("同步到AI知识库失败:", err);
          }
        }
      } catch (err) {
        console.error(`解析 ${file.name} 失败:`, err);
      }
    }

    setSuccess(`✅ 解析完成：成功 ${successCount}/${files.length} 个\n${results.map(r => `· ${r.fileName} → 识别为「${r.autoType}」${r.equipmentCount ? `（${r.equipmentCount}台设备）` : ""}`).join("\n")}`);
    setLoading(false);
  };

  const handleImport = async () => {
    if (!parseResult?.equipmentItems || parseResult.equipmentItems.length === 0) {
      setImportMessage("没有可导入的设备数据");
      return;
    }
    if (!selectedLabTypeId) {
      setImportMessage("请选择实验室类型");
      return;
    }

    setImporting(true);
    setImportMessage("");

    const token = Cookies.get("token");
    const res = await fetch("/api/feed/import-equipment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        labTypeId: selectedLabTypeId,
        equipmentItems: parseResult.equipmentItems,
        mode: importMode,
        fileName: parseResult.fileName || "",
        fileType: parseResult.fileType,
      }),
    });

    const data = await res.json();
    if (data.success) {
      setImportMessage(
        `导入完成（${data.data.mode === 'overwrite' ? '覆盖模式' : '合并模式'}）：新增 ${data.data.imported} 个设备，更新 ${data.data.updated} 个价格，跳过 ${data.data.skipped} 个`
      );
      fetchHistories();
    } else {
      setImportMessage(data.error || "导入失败");
    }
    setImporting(false);
  };

  const handleImportFactors = async () => {
    if (!parseResult?.constructionFactors || parseResult.constructionFactors.length === 0) {
      setImportMessage("没有可导入的工程系数数据");
      return;
    }
    if (!selectedLabTypeId) {
      setImportMessage("请选择实验室类型");
      return;
    }

    setImporting(true);
    setImportMessage("");

    const token = Cookies.get("token");
    const res = await fetch("/api/feed/import-factors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        labTypeId: selectedLabTypeId,
        factors: parseResult.constructionFactors,
        mode: importMode,
        fileName: parseResult.fileName || "",
        fileType: parseResult.fileType,
      }),
    });

    const data = await res.json();
    if (data.success) {
      setImportMessage(
        `工程系数导入完成（${data.data.mode === 'overwrite' ? '覆盖模式' : '合并模式'}）：新增 ${data.data.imported} 项，更新 ${data.data.updated} 项，跳过 ${data.data.skipped} 项`
      );
      fetchHistories();
    } else {
      setImportMessage(data.error || "导入失败");
    }
    setImporting(false);
  };

  const handleReset = () => {
    setFiles([]);
    setParseResult(null);
    setError("");
    setSuccess("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据喂养台</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传文件，系统识别并整理数据（仅管理员可见）
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
        >
          返回首页
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">上传文件</h2>

        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            files.length > 0 ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400"
          }`}
        >
          {files.length > 0 ? (
            <div>
              <p className="text-sm font-medium">已选择 {files.length} 个文件</p>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {files.map((f, i) => (
                  <p key={i} className="text-xs text-gray-600">{f.name}（{(f.size / 1024).toFixed(1)} KB）</p>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">点击更换文件</p>
            </div>
          ) : (
            <div>
              <p className="text-4xl mb-2">📄</p>
              <p className="text-gray-600">点击上传文件（可多选，最多20个）</p>
              <p className="text-gray-400 text-xs mt-1">
                支持 Excel（.xlsx）/ Word（.docx）/ PDF / 图片
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.docx,.pdf,image/*"
            onChange={handleFileChange}
            className="hidden"
            multiple
          />
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleParse}
            disabled={files.length === 0 || loading}
            className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg"
          >
            {loading ? "解析中..." : files.length > 1 ? `批量解析 ${files.length} 个文件` : "开始解析"}
          </button>
          {files.length > 0 && (
            <button
              onClick={handleReset}
              className="px-5 py-3 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              重置
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}
      </div>

      {/* 解析结果展示 */}
      {parseResult?.success && (
        <div className="space-y-6">
          {/* Excel 设备清单 */}
          {parseResult.equipmentItems && parseResult.equipmentItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                识别到的设备清单（{parseResult.equipmentItems.length} 项）
              </h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5">设备名称</th>
                    <th className="text-right px-4 py-2.5">价格（元）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parseResult.equipmentItems.map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5">{item.name}</td>
                      <td className="px-4 py-2.5 text-right">
                        {typeof item.price === 'number' ? item.price.toLocaleString() : item.price || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 whitespace-nowrap">导入到：</label>
                  <select
                    value={selectedLabTypeId}
                    onChange={(e) => setSelectedLabTypeId(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {labTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.typeName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="text-gray-600 whitespace-nowrap">导入模式：</label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="importMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
                    <span>合并（同名更新价格，其余新增）</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="importMode" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} />
                    <span className="text-red-600">覆盖（清空该类型现有数据后全部替换）</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:bg-green-300"
                  >
                    {importing ? "导入中..." : "确认导入设备"}
                  </button>
                  <button className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm">
                    跳过
                  </button>
                </div>
                {importMessage && (
                  <div className={`px-4 py-3 rounded-lg text-sm ${
                    importMessage.includes("导入完成")
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}>
                    {importMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Excel 表格明细 */}
          {parseResult.sheets && parseResult.sheets.map((sheet, si) => (
            <div key={si} className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">
                工作表：{sheet.sheetName}（{sheet.rowCount} 行）
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {sheet.headers.map((h, hi) => (
                        <th key={hi} className="text-left px-3 py-2 text-xs text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sheet.dataRows.slice(0, 20).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-xs text-gray-600">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Word 工程系数 */}
          {parseResult.constructionFactors && parseResult.constructionFactors.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                识别到的工程量系数（{parseResult.constructionFactors.length} 项）
              </h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5">工程项</th>
                    <th className="text-center px-4 py-2.5">单位</th>
                    <th className="text-right px-4 py-2.5">每㎡系数</th>
                    <th className="text-right px-4 py-2.5">单价（元）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parseResult.constructionFactors.map((f, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5">{f.itemName}</td>
                      <td className="px-4 py-2.5 text-center">{f.unit}</td>
                      <td className="px-4 py-2.5 text-right">{f.factorPerArea}</td>
                      <td className="px-4 py-2.5 text-right">
                        {typeof f.unitPrice === 'number' ? f.unitPrice.toLocaleString() : f.unitPrice || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 space-y-3">
                <p className="text-xs text-gray-400">
                  将导入到上方设备清单区选择的实验室类型（当前：
                  {labTypes.find((t) => t.id === selectedLabTypeId)?.typeName || '-'}，模式：
                  {importMode === 'merge' ? '合并' : '覆盖'}）
                </p>
                <button
                  onClick={handleImportFactors}
                  disabled={importing}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:bg-amber-300"
                >
                  {importing ? "导入中..." : "确认导入工程系数"}
                </button>
              </div>
            </div>
          )}

          {/* Word 段落 */}
          {parseResult.paragraphs && parseResult.paragraphs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">
                文档内容（{parseResult.paragraphs.length} 段）
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {parseResult.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm text-gray-600">{p}</p>
                ))}
              </div>
            </div>
          )}

          {/* Word/PDF 表格 */}
          {parseResult.tables && parseResult.tables.map((table, ti) => (
            <div key={ti} className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">
                表格 {ti + 1}（{table.rowCount} 行）
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {table.headers.map((h, hi) => (
                        <th key={hi} className="text-left px-3 py-2 text-xs text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {table.dataRows.slice(0, 20).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-xs text-gray-600">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* PDF 文本 */}
          {parseResult.textContent && parseResult.textContent.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">
                PDF 文本内容
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {parseResult.textContent.map((text, i) => (
                  <p key={i} className="text-sm text-gray-600 whitespace-pre-wrap">{text}</p>
                ))}
              </div>
            </div>
          )}

          {/* 提取的信息 */}
          {parseResult.extractedInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h2 className="font-semibold text-blue-900 mb-3">提取的关键信息</h2>
              {parseResult.extractedInfo.area && (
                <p className="text-blue-700">面积：{parseResult.extractedInfo.area} ㎡</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 导入历史 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h2 className="font-semibold text-gray-900 mb-4">导入历史（最近 20 条）</h2>
        {histories.length === 0 ? (
          <p className="text-gray-400 text-sm">暂无导入记录</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">文件名</th>
                <th className="text-center px-4 py-2.5">类型</th>
                <th className="text-center px-4 py-2.5">模式</th>
                <th className="text-left px-4 py-2.5">实验室类型</th>
                <th className="text-center px-4 py-2.5">设备</th>
                <th className="text-center px-4 py-2.5">工程系数</th>
                <th className="text-left px-4 py-2.5">操作人</th>
                <th className="text-left px-4 py-2.5">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {histories.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-2.5 max-w-48 truncate" title={h.fileName}>{h.fileName}</td>
                  <td className="px-4 py-2.5 text-center">{h.fileType}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      h.importMode === 'overwrite' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {h.importMode === 'overwrite' ? '覆盖' : '合并'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{h.labTypeName}</td>
                  <td className="px-4 py-2.5 text-center">{h.equipmentCount || '-'}</td>
                  <td className="px-4 py-2.5 text-center">{h.factorCount || '-'}</td>
                  <td className="px-4 py-2.5">{h.operator}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {new Date(h.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
