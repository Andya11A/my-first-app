"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";

interface MessageItem {
  id: number;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function MessagesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const res = await fetch("/api/messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages);
        setUnreadCount(data.data.unreadCount);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchMessages();
    }
  }, [authLoading, user, router, fetchMessages]);

  const handleMarkRead = async (id?: number) => {
    const token = Cookies.get("token");
    if (!token) return;
    await fetch("/api/messages", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(id ? { id } : { markAll: true }),
    });
    fetchMessages();
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">消息中心</h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => handleMarkRead()}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
          >
            全部标为已读
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">暂无消息</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              onClick={() => !m.isRead && handleMarkRead(m.id)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-colors ${
                m.isRead ? 'border-gray-200' : 'border-blue-300 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {m.title}
                    {!m.isRead && (
                      <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </p>
                  <p className="text-gray-600 text-sm mt-1">{m.content}</p>
                  <p className="text-gray-400 text-xs mt-2">
                    {new Date(m.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
