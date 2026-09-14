'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listCommunityRoadmaps, CommunityEntry } from '../../../lib/community';

export default function CommunityPage() {
  const userId = useRequireAuth();
  const [sortBy, setSortBy] = useState<'today' | 'total'>('today');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<CommunityEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    listCommunityRoadmaps(supabase, sortBy, search || undefined).then(setEntries);
  }, [userId, sortBy, search]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">커뮤니티</h1>
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
    </div>
  );
}
