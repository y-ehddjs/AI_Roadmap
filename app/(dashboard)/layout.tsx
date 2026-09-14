import Link from 'next/link';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 border-b p-4 text-sm">
        <Link href="/">홈</Link>
        <Link href="/dashboard">대시보드</Link>
        <Link href="/coaching">AI 코칭</Link>
        <Link href="/settings">설정</Link>
      </nav>
      {children}
    </div>
  );
}
