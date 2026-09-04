"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface SearchResult {
  source: string;
  sourceName: string;
  title: string;
  url: string;
  snippet: string;
}

interface SearchResponse {
  success: boolean;
  error?: string;
  data?: {
    keyword: string;
    resultCount: number;
    results: SearchResult[];
  };
}

const SOURCE_OPTIONS = [
  { value: 'all', label: '全部来源' },
  { value: 'standard', label: '国家标准' },
  { value: 'bid', label: '招标采购' },
  { value: 'tech', label: '学术文献' },
  { value: 'general', label: '综合搜索' },
];

const SOURCE_COLORS: Record<string, string> = {
  standard: 'bg-blue-100 text-blue-700',
  bid: 'bg-green-100 text-green-700',
  tech: 'bg-purple-100 text-purple-700',
  general: 'bg-gray-100 text-gray-600',
};

export default function KnowledgePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [source, setSource] = useState('all');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const history = localStorage.getItem('knowledgeSearchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleSearch = async () => {
    if (!keyword.trim()) {
      setError('请输入搜索关键词');
      return;
    }

    setLoading(true);
    setError('');

    const token = Cookies.get('token');
    const params = new URLSearchParams({
      keyword: keyword.trim(),
      source,
    });

    try {
      const res = await fetch(`/api/knowledge-search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: SearchResponse = await res.json();
      if (data.success) {
        setResult(data);

        // 保存搜索历史
        const newHistory = [keyword.trim(), ...searchHistory.filter((h) => h !== keyword.trim())].slice(0, 10);
        setSearchHistory(newHistory);
        localStorage.setItem('knowledgeSearchHistory', JSON.stringify(newHistory));
      } else {
        setError(data.error || '检索失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识检索</h1>
          <p className="text-gray-500 text-sm mt-1">
            搜索国家标准、招标采购、学术文献，为设计提供依据
          </p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
        >
          返回首页
        </button>
      </div>

      {/* 搜索区 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="如：PCR实验室 换气次数 / 生物安全实验室 压差 / 实验室 招标"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg"
          >
            {loading ? '检索中...' : '检索'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSource(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                source === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* 搜索历史 */}
      {searchHistory.length > 0 && !result && (
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">搜索历史</p>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  setKeyword(item);
                  handleSearch();
                }}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-gray-200"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {result?.success && result.data && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            找到 {result.data.resultCount} 个检索入口（点击跳转到对应网站查看详细内容）
          </p>

          <div className="space-y-3">
            {result.data.results.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[item.source] || 'bg-gray-100 text-gray-600'}`}>
                        {item.sourceName}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{item.snippet}</p>
                  </div>
                  <span className="text-gray-300 text-xl">→</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
