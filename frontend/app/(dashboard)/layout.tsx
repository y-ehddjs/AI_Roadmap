'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

const NAV_LINKS = [
  { href: '/', label: '홈' },
  { href: '/dashboard', label: '대시보드' },
  { href: '/coaching', label: 'AI 코칭' },
  { href: '/settings', label: '설정' },
  { href: '/community', label: '커뮤니티' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? 'font-semibold text-orange-600' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
