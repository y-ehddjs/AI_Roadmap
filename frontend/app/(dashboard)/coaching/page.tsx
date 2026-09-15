'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listMessages, markRead, CoachingMessageWithRoadmap } from '../../../lib/coaching';

export default function CoachingInboxPage() {
  const userId = useRequireAuth();
  const [messages, setMessages] = useState<CoachingMessageWithRoadmap[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setMessages(await listMessages(supabase, userId as string));
      setLoaded(true);
    }
    load().catch(() => setError('코칭 메시지를 불러오지 못했어요.'));
  }, [userId]);

  async function handleOpen(message: CoachingMessageWithRoadmap) {
    if (message.read_at) return;
    try {
      await markRead(supabase, message.id);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, read_at: new Date().toISOString() } : m)));
    } catch {
      // 읽음 처리 실패 시 다음에 다시 눌러 재시도할 수 있도록 상태는 그대로 둔다.
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">AI 코칭</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {loaded && messages.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">아직 코칭 메시지가 없어요.</p>
      )}
      <ul className="mt-4 space-y-2">
        {messages.map((item) => (
          <li key={item.id}>
            <button
              className={`w-full rounded-xl border p-3 text-left ${item.read_at ? 'opacity-60' : ''}`}
              onClick={() => handleOpen(item)}
            >
              <p>{item.message}</p>
              <p className="text-xs text-gray-500">
                {item.created_at} · {item.roadmap_title}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
