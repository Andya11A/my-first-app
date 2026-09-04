"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface WebResultItem {
  modelId: string;
  modelName: string;
  success: boolean;
  answer?: string;
  error?: string;
}

interface WebSearchRef {
  title: string;
  siteName: string;
  url: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  modelName?: string;
  webData?: {
    qwenAnswer: string;
    searchResults: WebSearchRef[];
    results: WebResultItem[];
  };
}

interface KnowledgeDoc {
  id: number;
  title: string;
  docType: string;
  fileName?: string;
  chunkCount: number;
  extractResults?: string | null;
  createdAt: string;
}

export default function AssistantPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');
  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [docType, setDocType] = useState('技术资料');
  const [message, setMessage] = useState('');
  const [modelId, setModelId] = useState('deepseek');
  const [ragMode, setRagMode] = useState(false);
  const [webMode, setWebMode] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState('');
  const [extractModel, setExtractModel] = useState('deepseek');
  const [extractType, setExtractType] = useState('summary');
  const [extractResults, setExtractResults] = useState<{ modelId: string; modelName: string; success: boolean; result?: string; error?: string }[]>([]);
  const [extractMode, setExtractMode] = useState<'single' | 'all'>('all');
  const [toast, setToast] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingAll, setUploadingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && user.roleCode !== 'super_admin' && user.roleCode !== 'admin') {
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (user && activeTab === 'knowledge') {
      fetchDocs();
    }
  }, [user, activeTab]);

  const fetchDocs = async () => {
    const token = Cookies.get('token');
    if (!token) return;
    const params = new URLSearchParams();
    if (searchKeyword.trim()) params.append('keyword', searchKeyword.trim());
    const res = await fetch(`/api/assistant/knowledge?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setDocs(data.data);
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    const token = Cookies.get('token');

    // 联网模式：通义先联网搜索，DeepSeek/GLM 参考联网结果，三列并列展示
    if (webMode) {
      const webRes = await fetch('/api/assistant/web-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, history: messages.slice(-6) }),
      });
      const webData = await webRes.json();
      if (webData.success && webData.data) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: '🌐 联网模式问答（通义联网搜索 + 三模型对比）',
          webData: {
            qwenAnswer: webData.data.results?.find((r: WebResultItem) => r.modelId === 'qwen')?.answer || '',
            searchResults: webData.data.searchResults || [],
            results: webData.data.results || [],
          },
        }]);
        const okCount = (webData.data.results as WebResultItem[]).filter((r) => r.success).length;
        setToast(`✓ 联网问答完成，已自动沉淀 ${okCount} 个节点（审核台-问答沉淀）`);
        setTimeout(() => setToast(''), 3000);
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `❌ ${webData.error || '联网问答失败'}`,
        }]);
      }
      setLoading(false);
      return;
    }

    // RAG 知识库问答模式（多模型并发）
    if (ragMode) {
      const ragRes = await fetch('/api/assistant/rag-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, modelIds: ['deepseek', 'glm', 'qwen'] }),
      });
      const ragData = await ragRes.json();
      if (ragData.success && ragData.data) {
        const refText = ragData.data.references?.length
          ? '\n\n📚 引用来源：\n' + ragData.data.references.map((r: { docTitle: string; chunkTitle: string; preview: string }) => `· 《${r.docTitle}》${r.chunkTitle}`).join('\n')
          : '';
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: '📊 知识库问答（多模型对比）\n\n' + ragData.data.results.map((r: { modelName: string; success: boolean; answer?: string; error?: string }) =>
            `【${r.modelName}】${r.success ? '✅' : '❌'}\n${r.success ? r.answer : r.error}\n`
          ).join('\n---\n\n') + refText,
        }]);
        const okCount = (ragData.data.results as { success: boolean }[]).filter((r) => r.success).length;
        setToast(`✓ 回答已自动沉淀至知识库（${okCount} 个节点，审核台-问答沉淀）`);
        setTimeout(() => setToast(''), 3000);
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `❌ ${ragData.error || '知识库问答失败'}`,
        }]);
      }
      setLoading(false);
      return;
    }

    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ question, history: messages.slice(-10), modelId }),
    });

    const data = await res.json();
    if (data.success) {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.data.answer, modelName: data.data.modelName }]);
      setToast('✓ 回答已自动沉淀至知识库（审核台-问答沉淀）');
      setTimeout(() => setToast(''), 3000);
    } else {
      setMessages((prev) => [...prev, { role: 'assistant', content: `❌ ${data.error || '调用失败'}` }]);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    if (selectedFiles.length > 10) {
      setMessage('最多一次上传10个文件');
      return;
    }
    setFiles(selectedFiles);
    if (selectedFiles.length === 1 && !docTitle) {
      setDocTitle(selectedFiles[0].name.replace(/\.[^.]+$/, ''));
    } else if (selectedFiles.length > 1) {
      setDocTitle('');
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage('请先选择文件');
      return;
    }
    setUploading(true);
    setUploadingAll(files.length > 1);
    setMessage(files.length > 1 ? `开始批量上传 ${files.length} 个文件...` : '');

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(f);
      });

      setMessage(`正在处理 ${i + 1}/${files.length}：${f.name}`);

      // 先上传原始文件，拿到可访问的 URL（供文档查看页展示原件）
      const token = Cookies.get('token');
      let originalFilePath: string | null = null;
      try {
        const uploadForm = new FormData();
        uploadForm.append('file', f);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: uploadForm,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) originalFilePath = uploadData.data.fileUrl;
      } catch {
        // 原始文件上传失败不阻断流程，只是没有「原始文件」视图
      }

      // 解析文件
      const parseRes = await fetch('http://localhost:5000/api/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: fData, fileName: f.name }),
      });
      const parseData = await parseRes.json();

      if (!parseData.success) {
        failCount++;
        errors.push(`${f.name}: ${parseData.error}`);
        continue;
      }

      // 入库
      const saveRes = await fetch('/api/assistant/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: files.length === 1 ? (docTitle || f.name) : f.name.replace(/\.[^.]+$/, ''),
          docType,
          fileName: f.name,
          fileSize: f.size,
          chunks: parseData.data.chunks,
          originalFileName: f.name,
          originalFilePath,
        }),
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        successCount++;
      } else {
        failCount++;
        errors.push(`${f.name}: ${saveData.error}`);
      }
    }

    setMessage(
      `✅ 上传完成：成功 ${successCount} 个，失败 ${failCount} 个${errors.length > 0 ? '\n' + errors.slice(0, 3).join('\n') : ''}`
    );
    setFiles([]);
    setDocTitle('');
    setUploading(false);
    setUploadingAll(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchDocs();
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('确定删除此文档？')) return;
    const token = Cookies.get('token');
    await fetch(`/api/assistant/knowledge?id=${docId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchDocs();
  };

  const handleExtract = async (docId: number) => {
    setExtracting(true);
    setExtractResult('');
    setExtractResults([]);

    const token = Cookies.get('token');
    const docRes = await fetch(`/api/assistant/knowledge?id=${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const docData = await docRes.json();

    if (!docData.success || !docData.data?.content) {
      setExtractResult('获取文档内容失败');
      setExtracting(false);
      return;
    }

    const modelIds = extractMode === 'all' ? ['deepseek', 'glm', 'qwen'] : [extractModel];

    const extractRes = await fetch('/api/assistant/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: docData.data.content,
        modelIds,
        extractType,
      }),
    });

    const extractData = await extractRes.json();
    if (extractData.success && extractData.data?.results) {
      setExtractResults(extractData.data.results);

      // 自动保存提炼结果到数据库
      await fetch('/api/assistant/knowledge', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          docId,
          extractResults: extractData.data.results,
        }),
      });
      // 刷新列表，让「已提炼」标记更新
      fetchDocs();
    } else {
      setExtractResult(`❌ ${extractData.error || '提炼失败'}`);
    }
    setExtracting(false);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 知识助手</h1>
          <p className="text-gray-500 text-sm mt-1">你的私人实验室工程专家（DeepSeek）</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            智能问答
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'knowledge' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            知识库（{docs.length}）
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm"
          >
            返回
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <>
          <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-4xl mb-3">🤖</p>
                <p>问我任何实验室工程问题</p>
                <p className="text-xs mt-2">如：PCR实验室的换气次数要求是多少？</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.webData ? (
                    <div className="w-full">
                      <p className="text-xs text-cyan-700 font-medium mb-2">🌐 {msg.content}</p>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {msg.webData.results.map((r) => (
                          <div key={r.modelId} className={`border rounded-xl overflow-hidden flex flex-col ${r.success ? 'border-gray-200 bg-white' : 'border-red-200 bg-white'}`}>
                            <div className={`px-3 py-2 text-sm font-medium text-white flex items-center justify-between ${
                              r.modelId === 'qwen' ? 'bg-cyan-600' : r.success ? 'bg-blue-600' : 'bg-red-500'
                            }`}>
                              <span>{r.modelName} {r.success ? '✅' : '❌'}</span>
                              {r.success && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(r.answer || '');
                                    setToast('已复制到剪贴板');
                                  }}
                                  className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                                >
                                  📋 复制
                                </button>
                              )}
                            </div>
                            <div className="px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto flex-1">
                              {r.success ? r.answer : `❌ ${r.error}`}
                            </div>
                          </div>
                        ))}
                      </div>
                      {msg.webData.searchResults.length > 0 && (
                        <div className="mt-3 bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3">
                          <p className="text-xs font-semibold text-cyan-800 mb-1">🔍 联网搜索来源（{msg.webData.searchResults.length} 条）</p>
                          <ul className="text-xs text-cyan-700 space-y-1">
                            {msg.webData.searchResults.map((s, j) => (
                              <li key={j} className="truncate">
                                {j + 1}. {s.title}
                                {s.siteName && <span className="text-cyan-500">（{s.siteName}）</span>}
                                {s.url && (
                                  <a href={s.url} target="_blank" rel="noreferrer" className="ml-1 underline hover:text-cyan-900">链接</a>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500">
                  思考中...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-gray-500">模型：</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="glm">智谱GLM-4</option>
              <option value="qianfan">文心一言</option>
              <option value="doubao">豆包</option>
              <option value="qwen">通义千问</option>
            </select>
            <button
              onClick={() => {
                setRagMode(!ragMode);
                if (!ragMode) setWebMode(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ragMode ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title="开启后基于知识库文档回答，并引用出处"
            >
              {ragMode ? '✓ 知识库问答' : '知识库问答'}
            </button>
            {ragMode && (
              <span className="text-xs text-purple-600">基于知识库文档回答，附带引用出处</span>
            )}
            <button
              onClick={() => {
                setWebMode(!webMode);
                if (!webMode) setRagMode(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${webMode ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title="开启后通义千问先联网搜索，DeepSeek/GLM 参考联网结果回答，三列对比"
            >
              {webMode ? '✓ 联网模式' : '联网模式'}
            </button>
            {webMode && (
              <span className="text-xs text-cyan-600">通义联网搜索 → 三模型并列回答</span>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入你的问题，按 Enter 发送..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-xl"
            >
              发送
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">上传知识文档</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="文档标题"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
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
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${files.length > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
              >
                {files.length > 0 ? (
                  <div className="text-sm">
                    <p className="font-medium text-blue-700">已选 {files.length} 个文件：</p>
                    {files.map((f, i) => (
                      <p key={i} className="text-gray-600 text-xs mt-1">{f.name}（{(f.size / 1024).toFixed(1)} KB）</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">点击上传 PDF / Word / Excel / 图片(OCR识别)，支持一次选 10 个</p>
                )}
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.xlsm,.txt,.md,.png,.jpg,.jpeg,.bmp,.webp" onChange={handleFileChange} className="hidden" multiple />
              </div>
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || uploading}
                className="w-full px-5 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium rounded-lg"
              >
                {uploading ? (uploadingAll ? '批量上传中...' : '解析入库中...') : (files.length > 1 ? `批量入库 ${files.length} 个文件` : '解析并入库')}
              </button>
              {message && (
                <div className={`px-4 py-3 rounded-lg text-sm ${message.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {message}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">已入库文档</h2>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchDocs()}
                placeholder="搜索文档标题/类型/内容..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button onClick={() => fetchDocs()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">搜索</button>
            </div>
            {docs.length === 0 ? (
              <p className="text-gray-400 text-sm">暂无文档，上传后显示在这里</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between border-b border-gray-100 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {doc.title}
                        {doc.extractResults && (
                          <span className="ml-2 text-xs text-green-600">✓已提炼</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doc.docType} · {doc.chunkCount} 片段 · {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => router.push(`/admin/doc-viewer?docId=${doc.id}`)}
                        className="text-purple-500 text-xs hover:underline"
                      >
                        查看
                      </button>
                      <button onClick={() => handleExtract(doc.id)} disabled={extracting} className="text-blue-500 text-xs hover:underline disabled:opacity-50">
                        提炼
                      </button>
                      {doc.extractResults && (
                        <a
                          href={`/api/assistant/export-result?docId=${doc.id}&token=${Cookies.get('token') || ''}`}
                          className="text-green-500 text-xs hover:underline"
                        >
                          导出
                        </a>
                      )}
                      <button onClick={() => handleDeleteDoc(doc.id)} className="text-red-500 text-xs hover:underline">
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(extractResults.length > 0 || extractResult) && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-semibold text-blue-900">提炼结果{extractResults.length > 1 ? `（${extractResults.length} 个模型）` : ''}</h3>
                <div className="flex gap-2 flex-wrap">
                  <select value={extractMode} onChange={(e) => setExtractMode(e.target.value as 'single' | 'all')} className="px-2 py-1 border border-gray-300 rounded text-xs bg-white">
                    <option value="all">全部模型</option>
                    <option value="single">单模型</option>
                  </select>
                  {extractMode === 'single' && (
                    <select value={extractModel} onChange={(e) => setExtractModel(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs bg-white">
                      <option value="deepseek">DeepSeek</option>
                      <option value="glm">智谱GLM</option>
                      <option value="qwen">通义千问</option>
                    </select>
                  )}
                  <select value={extractType} onChange={(e) => setExtractType(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs bg-white">
                    <option value="summary">要点总结</option>
                    <option value="equipment">设备提取</option>
                    <option value="construction">工程量提取</option>
                  </select>
                </div>
              </div>

              {extractResult && (
                <div className="text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto mb-4">
                  {extractResult}
                </div>
              )}

              {extractResults.length > 0 && (
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {extractResults.map((r, i) => (
                    <div key={i} className={`border rounded-xl overflow-hidden ${r.success ? 'border-gray-200' : 'border-red-200'}`}>
                      <div className={`px-3 py-2 text-sm font-medium text-white flex items-center justify-between ${r.success ? 'bg-blue-600' : 'bg-red-500'}`}>
                        <span>{r.modelName} {r.success ? '✅' : '❌'}</span>
                        {r.success && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(r.result || '');
                              setToast('已复制到剪贴板');
                            }}
                            className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                          >
                            📋 复制
                          </button>
                        )}
                      </div>
                      <div className="px-4 py-3 bg-white text-sm text-gray-800 whitespace-pre-wrap max-h-80 overflow-y-auto">
                        {r.success ? r.result : `❌ ${r.error}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {extracting && <p className="text-sm text-blue-600 mt-3">提炼中...（{extractMode === 'all' ? '3个模型同时工作' : '1个模型工作'}）</p>}
            </div>
          )}
        </div>
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}
    </main>
  );
}
