'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'PUSH_SUBSCRIPTION_CHANGED') return;
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        supabase
          .from('notification_settings')
          .upsert(
            { user_id: data.user.id, push_subscription: event.data.subscription },
            { onConflict: 'user_id' }
          );
      });
    }
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div>
      <nav className="flex gap-4 border-b p-4 text-sm">
        <Link href="/">홈</Link>
        <Link href="/dashboard">대시보드</Link>
        <Link href="/coaching">AI 코칭</Link>
        <Link href="/settings">설정</Link>
        <Link href="/community">커뮤니티</Link>
      </nav>
      {children}
    </div>
  );
}
