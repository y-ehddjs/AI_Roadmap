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
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-base text-neon-cyan drop-shadow-[0_0_10px_rgba(46,230,255,0.6)]">내 목표</h1>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-md border-2 border-border bg-neon-yellow px-2 py-1 text-[10px] font-bold text-border shadow-[3px_3px_0_var(--color-border)]">
            {streak}일 연속
          </span>
          <button
            className="flex items-center gap-1 rounded-md border-2 border-neon-cyan bg-panel px-2 py-1 text-[10px] font-bold text-neon-cyan shadow-[2px_2px_0_var(--color-border)] disabled:opacity-50"
            onClick={handleCheckin}
            disabled={checkedInToday || checkinInFlight}
          >
            {checkedInToday ? '체크인 완료' : '체크인'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-neon-pink">{error}</p>}
      <p className="mb-4 mt-1 text-xs text-ink-dim">{rows.length}개 진행 중 (완료된 로드맵은 대시보드에서 확인)</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.roadmap.id}
            className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-panel p-4 shadow-[5px_5px_0_var(--color-border)]"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-bold text-ink">{row.roadmap.title}</h2>
              <span className="shrink-0 rounded-md border-2 border-border bg-neon-purple px-1.5 py-0.5 text-[9px] font-bold text-border">
                {row.roadmap.source === 'ai' ? 'AI' : '직접입력'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-2.5 overflow-hidden rounded-full border-2 border-border bg-field">
                <div className="h-full bg-neon-cyan shadow-[0_0_8px_var(--color-neon-cyan)]" style={{ width: `${row.progress.percent}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-ink-dim">
                <span>{row.progress.percent}% 완료</span>
                <span>
                  {row.progress.totalCount}개 중 {row.progress.completedCount}개
                </span>
              </div>
            </div>
            {row.nextMilestone && (
              <p className={`border-t-2 border-dashed border-border pt-2 text-xs ${row.nextIsOverdue ? 'text-neon-red' : 'text-neon-yellow'}`}>
                다음: {row.nextMilestone.title} · {row.nextMilestone.due_date}
              </p>
            )}
            <Link className="text-xs text-neon-cyan underline" href={`/roadmap/${row.roadmap.id}`}>
              상세 보기
            </Link>
          </div>
        ))}
      </div>
      <Link
        href="/roadmap/create"
        className="mt-6 flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-neon-pink p-3 font-display text-xs text-border shadow-[4px_4px_0_var(--color-border)]"
      >
        + 새 로드맵
      </Link>
    </div>
  );
}
