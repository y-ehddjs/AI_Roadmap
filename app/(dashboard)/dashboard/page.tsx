'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listRoadmaps } from '../../../lib/roadmaps';
import { listMilestones } from '../../../lib/milestones';
import { summarizeDashboard, DashboardSummary } from '../../../lib/dashboard';

export default function DashboardPage() {
  const userId = useRequireAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const roadmaps = await listRoadmaps(supabase, userId as string);
      const entries = await Promise.all(
        roadmaps.map(async (roadmap) => ({ roadmap, milestones: await listMilestones(supabase, roadmap.id) }))
      );
      setSummary(summarizeDashboard(entries));
    }
    load();
  }, [userId]);

  if (!summary) return null;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">진행률 대시보드</h1>
      <p className="mt-1 text-lg font-semibold text-orange-600">전체 {summary.overallPercent}%</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summary.roadmaps.map((item) => (
          <div key={item.roadmap.id} className="rounded-xl border p-3">
            <p className="font-medium">{item.roadmap.title}</p>
            <p className="text-sm text-gray-600">
              {item.progress.percent}% ({item.progress.completedCount}/{item.progress.totalCount})
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
