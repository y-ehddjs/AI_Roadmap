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
  const [checking, setChecking] = useState(false);

  async function load() {
    if (!userId) return;
    setMessages(await listMessages(supabase, userId as string));
    setLoaded(true);
  }

  useEffect(() => {
    load().catch(() => setError('코칭 메시지를 불러오지 못했어요.'));
  }, [userId]);

  async function handleCheckNow() {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch('/api/check-coaching', { method: 'POST' });
      if (!response.ok) throw new Error('check-coaching failed');
      await load();
    } catch {
      setError('코칭 확인에 실패했어요. 다시 시도해주세요.');
    } finally {
      setChecking(false);
    }
  }

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
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-sm text-neon-purple drop-shadow-[0_0_8px_rgba(185,139,255,0.5)]">AI 코칭</h1>
        <button
          className="shrink-0 rounded-lg border-2 border-neon-purple bg-panel px-3 py-1.5 text-[10px] font-bold text-neon-purple shadow-[2px_2px_0_var(--color-border)] disabled:opacity-50"
          onClick={handleCheckNow}
          disabled={checking}
        >
          {checking ? '확인 중...' : '지금 확인하기'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-neon-pink">{error}</p>}
      {loaded && messages.length === 0 && <p className="mt-4 text-xs text-ink-dim">아직 코칭 메시지가 없어요.</p>}
      <ul className="mt-4 flex flex-col gap-2.5">
        {messages.map((item) => (
          <li key={item.id}>
            <button
              className={`w-full rounded-xl border-2 p-3 text-left shadow-[3px_3px_0_var(--color-border)] ${
                item.read_at ? 'border-border bg-panel opacity-60' : 'border-neon-purple bg-panel'
              }`}
              onClick={() => handleOpen(item)}
            >
              <p className="text-xs leading-relaxed text-ink">{item.message}</p>
              <p className="mt-1.5 text-[10px] text-ink-dim">
                {item.created_at} · {item.roadmap_title}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
