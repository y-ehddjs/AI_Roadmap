'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listCommunityRoadmaps, CommunityEntry } from '../../../lib/community';
import { getLeaderboard, LeaderboardEntry } from '../../../lib/leaderboard';

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" className={className}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

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
      <h1 className="font-display text-sm text-neon-pink drop-shadow-[0_0_8px_rgba(255,46,143,0.5)]">커뮤니티</h1>
      <p className="mt-1.5 text-[10px] text-ink-dim">공개된 로드맵을 둘러보고 하트를 보내보세요</p>

      <div className="mt-3 flex gap-2 border-b-2 border-border pb-3">
        <button
          className={`flex-1 rounded-lg border-2 border-border p-2 text-[10px] font-bold ${
            view === 'feed' ? 'bg-neon-pink text-border shadow-[3px_3px_0_var(--color-border)]' : 'bg-panel text-ink-dim'
          }`}
          onClick={() => setView('feed')}
        >
          피드
        </button>
        <button
          className={`flex-1 rounded-lg border-2 border-border p-2 text-[10px] font-bold ${
            view === 'leaderboard' ? 'bg-neon-pink text-border shadow-[3px_3px_0_var(--color-border)]' : 'bg-panel text-ink-dim'
          }`}
          onClick={() => setView('leaderboard')}
        >
          리더보드
        </button>
      </div>

      {view === 'feed' ? (
        <>
          <div className="mt-3 flex gap-2">
            <button
              className={`flex-1 rounded-lg border-2 border-border p-2 text-xs font-bold ${
                sortBy === 'today' ? 'bg-neon-pink text-border shadow-[3px_3px_0_var(--color-border)]' : 'bg-panel text-ink-dim'
              }`}
              onClick={() => setSortBy('today')}
            >
              오늘 하트순
            </button>
            <button
              className={`flex-1 rounded-lg border-2 border-border p-2 text-xs font-bold ${
                sortBy === 'total' ? 'bg-neon-pink text-border shadow-[3px_3px_0_var(--color-border)]' : 'bg-panel text-ink-dim'
              }`}
              onClick={() => setSortBy('total')}
            >
              추천순
            </button>
          </div>
          <input
            className="mt-2.5 w-full rounded-lg border-2 border-border bg-field p-2.5 text-xs text-ink"
            placeholder="닉네임으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {entries.length === 0 && <p className="mt-4 text-xs text-ink-dim">공개된 로드맵이 아직 없어요.</p>}
          <ul className="mt-3.5 flex flex-col gap-2.5">
            {entries.map((entry, index) => (
              <li key={entry.roadmapId}>
                <Link
                  href={`/r/${entry.roadmapId}`}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 ${
                    index === 0
                      ? 'border-neon-pink bg-panel shadow-[4px_4px_0_var(--color-border)]'
                      : 'border-border bg-panel shadow-[3px_3px_0_var(--color-border)]'
                  }`}
                >
                  <span className={`font-display shrink-0 text-sm ${index === 0 ? 'text-neon-pink' : 'text-ink-dim'}`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">{entry.title}</p>
                    <p className="mt-0.5 text-[10px] text-ink-dim">{entry.ownerName}</p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full border-2 border-border px-2 py-1 text-[10px] font-bold ${
                      index === 0 ? 'bg-neon-pink text-border' : 'bg-panel text-ink'
                    }`}
                  >
                    <HeartIcon />
                    {entry.heartCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-dim">
            내가 팔로우하는 사람들(과 나) 중 리더보드에 표시하기로 한 사람들의 순위예요 — 받은 하트 수와 진행률로 매겨요
          </p>
          {leaderboardEntries.length === 0 && (
            <p className="mt-4 text-xs text-ink-dim">아직 팔로우한 사람이 없거나, 리더보드에 표시하기로 한 사람이 없어요.</p>
          )}
          <ol className="mt-3.5 flex flex-col gap-2.5">
            {leaderboardEntries.map((entry, index) => (
              <li
                key={entry.displayName}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 ${
                  index === 0
                    ? 'border-neon-yellow bg-panel shadow-[4px_4px_0_var(--color-border)]'
                    : 'border-border bg-panel shadow-[3px_3px_0_var(--color-border)]'
                }`}
              >
                <span className={`font-display shrink-0 text-sm ${index === 0 ? 'text-neon-yellow' : 'text-ink-dim'}`}>
                  {index + 1}
                </span>
                <span className="flex-1 text-xs font-bold text-ink">{entry.displayName}</span>
                <span className={`flex shrink-0 items-center gap-1 text-[10px] font-bold ${index === 0 ? 'text-neon-yellow' : 'text-neon-cyan'}`}>
                  <HeartIcon />
                  {entry.heartCount} · {entry.progressPercent}%
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
