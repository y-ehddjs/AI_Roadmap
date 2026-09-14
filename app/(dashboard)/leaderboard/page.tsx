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
    getLeaderboard(supabase, new Date()).then(setEntries);
  }, [userId]);

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">리더보드</h1>
      <p className="mb-4 text-sm text-gray-500">리더보드에 표시하기로 한 사용자들의 스트릭 순위예요</p>
      <ol className="space-y-2">
        {entries.map((entry, index) => (
          <li key={entry.displayName} className="flex items-center justify-between rounded-xl border p-3">
            <span className="font-medium">
              {index + 1}. {entry.displayName}
            </span>
            <span className="text-sm text-gray-600">{entry.streak}일 연속</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
