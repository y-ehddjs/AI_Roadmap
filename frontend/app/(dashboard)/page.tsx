'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRequireAuth } from '../../lib/useAuth';
import { listRoadmaps } from '../../lib/roadmaps';
import { listMilestones } from '../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../lib/progress';
import { recordCheckin, getTodayStreak, hasCheckedInToday } from '../../lib/checkins';
import type { Roadmap, Milestone } from '../../types/models';

interface RoadmapRow {
  roadmap: Roadmap;
  progress: ReturnType<typeof calculateProgress>;
  nextMilestone: Milestone | null;
  nextIsOverdue: boolean;
}

export default function HomePage() {
  const userId = useRequireAuth();
  const [rows, setRows] = useState<RoadmapRow[]>([]);
  const [streak, setStreak] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [checkinInFlight, setCheckinInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    async function loadStreak() {
      const today = new Date();
      const [currentStreak, alreadyCheckedIn] = await Promise.all([
        getTodayStreak(supabase, userId as string, today),
        hasCheckedInToday(supabase, userId as string, today),
      ]);
      setStreak(currentStreak);
      setCheckedInToday(alreadyCheckedIn);
    }
    loadStreak().catch(() => setError('스트릭 정보를 불러오지 못했어요.'));
  }, [userId]);

  async function handleCheckin() {
    if (!userId || checkedInToday || checkinInFlight) return;
    setCheckinInFlight(true);
    try {
      setStreak(await recordCheckin(supabase, userId, new Date()));
      setCheckedInToday(true);
    } catch {
      setError('체크인에 실패했어요. 다시 시도해주세요.');
    } finally {
      setCheckinInFlight(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const roadmaps = await listRoadmaps(supabase, userId as string);
      const activeRoadmaps = roadmaps.filter((r) => r.status === 'active');
      const now = new Date();
      const withProgress = await Promise.all(
        activeRoadmaps.map(async (roadmap) => {
          const milestones = await listMilestones(supabase, roadmap.id);
          const progress = calculateProgress(milestones);
          const upcoming = milestones
            .filter((m) => m.status !== 'done')
            .sort((a, b) => a.order_index - b.order_index)[0];
          return {
            roadmap,
            progress,
            nextMilestone: upcoming ?? null,
            nextIsOverdue: upcoming ? milestoneStatus(upcoming, now) === 'overdue' : false,
          };
        })
      );
      setRows(withProgress);
    }
    load().catch(() => setError('로드맵 목록을 불러오지 못했어요.'));
  }, [userId]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 목표</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">{streak}일 연속</span>
          <button
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
            onClick={handleCheckin}
            disabled={checkedInToday || checkinInFlight}
          >
            {checkedInToday ? '오늘 체크인 완료' : '오늘 체크인'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mb-4 text-sm text-gray-500">{rows.length}개 진행 중 (완료된 로드맵은 대시보드에서 확인)</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.roadmap.id} className="rounded-2xl border p-4">
            <h2 className="font-semibold">{row.roadmap.title}</h2>
            <p className="text-sm text-gray-600">
              {row.progress.percent}% 완료 ({row.progress.completedCount}/{row.progress.totalCount})
            </p>
            {row.nextMilestone && (
              <p className={`text-sm ${row.nextIsOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                다음: {row.nextMilestone.title} · {row.nextMilestone.due_date}
              </p>
            )}
            <Link className="mt-2 inline-block text-orange-600 underline" href={`/roadmap/${row.roadmap.id}`}>
              상세 보기
            </Link>
          </div>
        ))}
      </div>
      <Link
        href="/roadmap/create"
        className="mt-6 inline-block rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white"
      >
        + 새 로드맵 만들기
      </Link>
    </div>
  );
}
