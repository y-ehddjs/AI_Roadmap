'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listMessages, markRead, CoachingMessageWithRoadmap } from '../../../lib/coaching';

export default function CoachingInboxPage() {
  const userId = useRequireAuth();
  const [messages, setMessages] = useState<CoachingMessageWithRoadmap[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setMessages(await listMessages(supabase, userId as string));
    }
    load();
  }, [userId]);

  async function handleOpen(message: CoachingMessageWithRoadmap) {
    if (message.read_at) return;
    await markRead(supabase, message.id);
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, read_at: new Date().toISOString() } : m)));
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">AI 코칭</h1>
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
