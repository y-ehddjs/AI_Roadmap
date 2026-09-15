'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listCommunityRoadmaps, CommunityEntry } from '../../../lib/community';
import { getLeaderboard, LeaderboardEntry } from '../../../lib/leaderboard';

export default function CommunityPage() {
  const userId = useRequireAuth();
  const [view, setView] = useState<'feed' | 'leaderboard'>('feed');
  const [sortBy, setSortBy] = useState<'today' | 'total'>('today');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!userId || view !== 'feed') return;
    listCommunityRoadmaps(supabase, sortBy, search || undefined).then(setEntries);
  }, [userId, view, sortBy, search]);

  useEffect(() => {
    if (!userId || view !== 'leaderboard') return;
    getLeaderboard(supabase, userId as string).then(setLeaderboardEntries);
  }, [userId, view]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">커뮤니티</h1>
      <div className="mt-4 flex gap-2 border-b pb-2">
        <button
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'feed' ? 'bg-orange-500 text-white' : 'border'}`}
          onClick={() => setView('feed')}
        >
          피드
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'leaderboard' ? 'bg-orange-500 text-white' : 'border'}`}
          onClick={() => setView('leaderboard')}
        >
          리더보드
        </button>
      </div>

      {view === 'feed' ? (
        <>
          <div className="mt-4 flex gap-2">
            <button
              className={`rounded-lg px-3 py-2 text-sm ${sortBy === 'today' ? 'bg-orange-500 text-white' : 'border'}`}
              onClick={() => setSortBy('today')}
            >
              오늘 하트순
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm ${sortBy === 'total' ? 'bg-orange-500 text-white' : 'border'}`}
              onClick={() => setSortBy('total')}
            >
              추천순
            </button>
          </div>
          <input
            className="mt-3 w-full rounded-lg border p-3"
            placeholder="닉네임으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {entries.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">공개된 로드맵이 아직 없어요.</p>
          )}
          <ul className="mt-4 space-y-2">
            {entries.map((entry) => (
              <li key={entry.roadmapId}>
                <Link href={`/r/${entry.roadmapId}`} className="block rounded-xl border p-3">
                  <p className="font-medium">{entry.title}</p>
                  <p className="text-sm text-gray-600">
                    {entry.ownerName} · 하트 {entry.heartCount}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-gray-500">
            내가 팔로우하는 사람들(과 나) 중 리더보드에 표시하기로 한 사람들의 순위예요 — 받은 하트 수와 진행률로 매겨요
          </p>
          {leaderboardEntries.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">
              아직 팔로우한 사람이 없거나, 리더보드에 표시하기로 한 사람이 없어요.
            </p>
          )}
          <ol className="mt-4 space-y-2">
            {leaderboardEntries.map((entry, index) => (
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
        </>
      )}
    </div>
  );
}
