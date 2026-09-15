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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const roadmaps = await listRoadmaps(supabase, userId as string);
      const entries = await Promise.all(
        roadmaps.map(async (roadmap) => ({ roadmap, milestones: await listMilestones(supabase, roadmap.id) }))
      );
      setSummary(summarizeDashboard(entries));
    }
    load().catch(() => setError('대시보드를 불러오지 못했어요.'));
  }, [userId]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="font-display text-sm text-neon-cyan drop-shadow-[0_0_8px_rgba(46,230,255,0.5)]">진행률 대시보드</h1>
        <p className="mt-2 text-xs text-neon-pink">{error}</p>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="font-display text-sm text-neon-cyan drop-shadow-[0_0_8px_rgba(46,230,255,0.5)]">진행률 대시보드</h1>
        <p className="mt-2 text-xs text-ink-dim">불러오는 중...</p>
      </div>
    );
  }

  const totalMilestones = summary.roadmaps.reduce((sum, r) => sum + r.progress.totalCount, 0);
  const completedMilestones = summary.roadmaps.reduce((sum, r) => sum + r.progress.completedCount, 0);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-sm text-neon-cyan drop-shadow-[0_0_8px_rgba(46,230,255,0.5)]">진행률 대시보드</h1>

      <div className="mt-3 flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-panel p-5 text-center shadow-[5px_5px_0_var(--color-border)]">
        <span className="text-[10px] text-ink-dim">전체 진행률</span>
        <span className="font-display text-3xl text-neon-yellow drop-shadow-[0_0_14px_rgba(255,233,63,0.6)]">
          {summary.overallPercent}%
        </span>
        <span className="text-[10px] text-ink-dim">
          마일스톤 {totalMilestones}개 중 {completedMilestones}개 완료
        </span>
      </div>

      {summary.roadmaps.length === 0 ? (
        <p className="mt-4 text-xs text-ink-dim">아직 로드맵이 없어요. 홈에서 새 로드맵을 만들어보세요.</p>
      ) : (
        <p className="mb-2 mt-5 text-[10px] font-bold tracking-wide text-ink-dim">로드맵별 진행률</p>
      )}
      <div className="flex flex-col gap-3">
        {summary.roadmaps.map((item) => (
          <div
            key={item.roadmap.id}
            className={`flex flex-col gap-2 rounded-xl border-2 border-border bg-panel p-3.5 shadow-[3px_3px_0_var(--color-border)] ${
              item.roadmap.status === 'completed' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">{item.roadmap.title}</span>
              <span className={`text-xs font-bold ${item.progress.percent === 100 ? 'text-neon-yellow' : 'text-neon-cyan'}`}>
                {item.progress.percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border-2 border-border bg-field">
              <div
                className={`h-full ${item.progress.percent === 100 ? 'bg-neon-yellow' : 'bg-neon-cyan'}`}
                style={{ width: `${item.progress.percent}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-dim">
              {item.roadmap.status === 'completed' ? '완료됨 · ' : ''}
              {item.progress.totalCount}개 중 {item.progress.completedCount}개
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
