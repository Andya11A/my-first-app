"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface DocContent {
  id: number;
  title: string;
  docType: string;
  content: string;
  chunkCount: number;
  originalFilePath?: string | null;
  extractResults?: string | null;
}

interface ExplainResult {
  explanation: string;
  relatedDocs: { docTitle: string; chunkTitle: string; preview: string }[];
}

interface Note {
  id: number;
  docId: number;
  selectedText: string;
  noteContent: string;
  createdByName: string;
  createdAt: string;
}

export default function DocViewerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const docId = searchParams.get('docId');

  const [doc, setDoc] = useState<DocContent | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [autoExplain, setAutoExplain] = useState(true);
  const [viewMode, setViewMode] = useState<'text' | 'original'>('text');
  const [showTab, setShowTab] = useState<'explain' | 'notes' | 'extract'>('explain');
  const [editingNote, setEditingNote] = useState<{ id: number; content: string } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [extractResults, setExtractResults] = useState<{ modelName: string; success: boolean; result?: string }[]>([]);

  const fetchDoc = useCallback(async () => {
    if (!docId) return;
    const token = Cookies.get('token');
    const res = await fetch(`/api/assistant/knowledge?id=${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      setDoc(data.data);
      if (data.data.extractResults) {
        try {
          setExtractResults(JSON.parse(data.data.extractResults));
        } catch {
          setExtractResults([]);
        }
      }
    }
  }, [docId]);

  const fetchNotes = useCallback(async () => {
    if (!docId) return;
    const token = Cookies.get('token');
    const res = await fetch(`/api/assistant/notes?docId=${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setNotes(data.data);
  }, [docId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchDoc();
      fetchNotes();
    }
  }, [authLoading, user, router, fetchDoc, fetchNotes]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleExplainWithText = async (text: string) => {
    setExplaining(true);
    setExplainResult(null);
    setShowTab('explain');

    const token = Cookies.get('token');
    const res = await fetch('/api/assistant/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ selectedText: text, docId: Number(docId) }),
    });

    const data = await res.json();
    if (data.success) {
      setExplainResult(data.data);
    } else {
      setExplainResult({
        explanation: `❌ ${data.error || '查询失败'}`,
        relatedDocs: [],
      });
    }
    setExplaining(false);
  };

  const handleTextSelect = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';
    if (text && text.length >= 2) {
      setSelectedText(text);
      if (autoExplain) {
        handleExplainWithText(text);
      }
    }
  };

  const handleDoubleClick = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';
    if (text && text.length >= 2) {
      setSelectedText(text);
      handleExplainWithText(text);
    }
  };

  const handleAddNote = async () => {
    if (!selectedText || !noteText.trim()) return;

    const token = Cookies.get('token');
    const res = await fetch('/api/assistant/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        docId: Number(docId),
        selectedText,
        noteContent: noteText.trim(),
      }),
    });

    const data = await res.json();
    if (data.success) {
      setNoteText('');
      setShowNoteInput(false);
      fetchNotes();
      setShowTab('notes');
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote({ id: note.id, content: note.noteContent });
  };

  const handleSaveEditNote = async () => {
    if (!editingNote || !editingNote.content.trim()) return;
    const token = Cookies.get('token');
    await fetch('/api/assistant/notes', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: editingNote.id, noteContent: editingNote.content }),
    });
    setEditingNote(null);
    fetchNotes();
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('删除这条笔记？')) return;
    const token = Cookies.get('token');
    await fetch(`/api/assistant/notes?id=${noteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchNotes();
  };

  const handleOpenNoteInput = () => {
    if (!selectedText) return;
    setShowNoteInput(true);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{doc?.title || '文档查看'}</h1>
          <p className="text-gray-500 text-sm mt-1">{doc?.docType} · {doc?.chunkCount} 片段</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setViewMode('text')}
            className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'text' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            文字内容
          </button>
          {doc?.originalFilePath && (
            <button
              onClick={() => setViewMode('original')}
              className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'original' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              原始文件
            </button>
          )}
          <button
            onClick={() => setAutoExplain(!autoExplain)}
            className={`px-4 py-2 rounded-lg text-sm ${autoExplain ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-white border border-gray-200 text-gray-500'}`}
          >
            自动解释：{autoExplain ? '开' : '关'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm"
          >
            ← 返回
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {viewMode === 'text' ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div
                className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto"
                onMouseUp={handleTextSelect}
                onDoubleClick={handleDoubleClick}
              >
                {doc?.content || '加载中...'}
              </div>
              {selectedText && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">已选中：</p>
                  <p className="text-sm text-gray-800 mb-3">「{selectedText}」</p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleExplainWithText(selectedText)}
                      disabled={explaining}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-300"
                    >
                      {explaining ? '查询中...' : '查解释'}
                    </button>
                    <button
                      onClick={handleOpenNoteInput}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
                    >
                      📝 记笔记
                    </button>
                  </div>

                  {showNoteInput && (
                    <div className="mt-3">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="写下你的笔记..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleAddNote}
                          disabled={!noteText.trim()}
                          className="px-4 py-1.5 bg-yellow-500 text-white rounded-lg text-sm disabled:bg-yellow-200"
                        >
                          保存笔记
                        </button>
                        <button
                          onClick={() => setShowNoteInput(false)}
                          className="px-4 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <iframe
                src={doc?.originalFilePath || ''}
                className="w-full h-[600px]"
                title="原始文件"
              />
            </div>
          )}
        </div>

        {/* 右侧面板 */}
        <div className="space-y-4">
          {/* Tab切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowTab('explain')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm ${showTab === 'explain' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              AI解释
            </button>
            <button
              onClick={() => setShowTab('notes')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm ${showTab === 'notes' ? 'bg-yellow-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              笔记({notes.length})
            </button>
            <button
              onClick={() => setShowTab('extract')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm ${showTab === 'extract' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              提炼结果
            </button>
          </div>

          {showTab === 'explain' && (
            <div className="bg-white rounded-xl border border-blue-200 p-5">
              <h3 className="font-semibold text-blue-900 mb-3">AI 解释</h3>
              {explaining ? (
                <p className="text-sm text-gray-500">查询中...</p>
              ) : explainResult ? (
                <>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap mb-4">{explainResult.explanation}</p>
                  {explainResult.relatedDocs.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">相关知识库资料：</p>
                      <div className="space-y-2">
                        {explainResult.relatedDocs.map((r, i) => (
                          <div key={i} className="border-b border-gray-100 pb-2">
                            <p className="text-sm font-medium text-gray-800">《{r.docTitle}》</p>
                            <p className="text-xs text-gray-500 mt-1">{r.preview}...</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">
                  {autoExplain ? '选中文中文字自动解释' : '选中文字后点「查解释」'}
                </p>
              )}
            </div>
          )}

          {showTab === 'notes' && (
            <div className="bg-white rounded-xl border border-yellow-200 p-5">
              <h3 className="font-semibold text-yellow-800 mb-3">我的笔记</h3>
              {notes.length === 0 ? (
                <p className="text-sm text-gray-400">暂无笔记，选中文字后点「记笔记」</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notes.map((note) => (
                    <div key={note.id} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">原文：{note.selectedText}</p>
                      {editingNote?.id === note.id ? (
                        <div>
                          <textarea
                            value={editingNote.content}
                            onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-2"
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={handleSaveEditNote} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs">保存</button>
                            <button onClick={() => setEditingNote(null)} className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs">取消</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 mt-2">{note.noteContent}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400">
                          {note.createdByName} · {new Date(note.createdAt).toLocaleString('zh-CN')}
                        </p>
                        <div className="flex gap-3">
                          <button onClick={() => handleEditNote(note)} className="text-blue-500 text-xs hover:underline">
                            编辑
                          </button>
                          <button onClick={() => handleDeleteNote(note.id)} className="text-red-500 text-xs hover:underline">
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showTab === 'extract' && (
            <div className="bg-white rounded-xl border border-purple-200 p-5">
              <h3 className="font-semibold text-purple-800 mb-3">提炼结果</h3>
              {extractResults.length === 0 ? (
                <p className="text-sm text-gray-400">该文档还没有提炼结果，去知识库点「提炼」</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {extractResults.map((r, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className={`px-3 py-1.5 text-xs font-medium text-white ${r.success ? 'bg-purple-600' : 'bg-red-500'}`}>
                        {r.modelName} {r.success ? '✅' : '❌'}
                      </div>
                      {r.success && r.result && (
                        <div className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {r.result}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
