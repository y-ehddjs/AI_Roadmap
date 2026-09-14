'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRequireAuth } from '../../lib/useAuth';
import { listRoadmaps } from '../../lib/roadmaps';
import { listMilestones } from '../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../lib/progress';
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
    load();
  }, [userId]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">내 목표</h1>
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
