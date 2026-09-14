'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { getLeaderboard, LeaderboardEntry } from '../../../lib/leaderboard';

export default function LeaderboardPage() {
  const userId = useRequireAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    getLeaderboard(supabase, userId as string).then(setEntries);
  }, [userId]);

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">리더보드</h1>
      <p className="mb-4 text-sm text-gray-500">
        내가 팔로우하는 사람들(과 나) 중 리더보드에 표시하기로 한 사람들의 순위예요 — 받은 하트 수와 진행률로 매겨요
      </p>
      {entries.length === 0 && (
        <p className="text-sm text-gray-500">아직 팔로우한 사람이 없거나, 리더보드에 표시하기로 한 사람이 없어요.</p>
      )}
      <ol className="space-y-2">
        {entries.map((entry, index) => (
          <li key={entry.displayName} className="flex items-center justify-between rounded-xl border p-3">
            <span className="font-medium">
              {index + 1}. {entry.displayName}
            </span>
            <span className="text-sm text-gray-600">
              하트 {entry.heartCount} · 진행률 {entry.progressPercent}%
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
