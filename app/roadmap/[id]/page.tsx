'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { getRoadmap, deleteRoadmap } from '../../../lib/roadmaps';
import { listMilestones, createMilestone } from '../../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../../lib/progress';
import type { Roadmap, Milestone } from '../../../types/models';

export default function RoadmapDetailPage() {
  const userId = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDue, setNewMilestoneDue] = useState('');

  async function load() {
    if (!id) return;
    setRoadmap(await getRoadmap(supabase, id));
    setMilestones(await listMilestones(supabase, id));
  }

  useEffect(() => {
    if (!userId || !id) return;
    load();
  }, [userId, id]);

  async function handleAddMilestone() {
    if (!id || !newMilestoneTitle || !newMilestoneDue) return;
    // order_index는 그냥 끝 번호만 매기면 된다 - listMilestones가 due_date로
    // 정렬해서 돌려주므로, 이 마일스톤의 마감일이 기존 것보다 이르더라도
    // 타임라인에서는 알아서 올바른 위치에 보인다.
    await createMilestone(supabase, {
      roadmap_id: id,
      title: newMilestoneTitle,
      due_date: newMilestoneDue,
      order_index: milestones.length,
    });
    // 완료 처리됐던 로드맵에 마일스톤을 새로 추가하면 다시 진행 중으로 되돌린다
    if (roadmap?.status === 'completed') {
      await supabase.from('roadmaps').update({ status: 'active' }).eq('id', id);
    }
    setNewMilestoneTitle('');
    setNewMilestoneDue('');
    await load();
  }

  async function handleDeleteRoadmap() {
    if (!id) return;
    if (!confirm('이 로드맵과 모든 마일스톤을 삭제할까요? 되돌릴 수 없어요.')) return;
    await deleteRoadmap(supabase, id);
    router.replace('/');
  }

  if (!roadmap) return null;
  const progress = calculateProgress(milestones);
  const now = new Date();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{roadmap.title}</h1>
        <button className="text-sm text-red-600 underline" onClick={handleDeleteRoadmap}>
          로드맵 삭제
        </button>
      </div>
      <p className="text-sm text-gray-600">
        전체 진행률 {progress.percent}% ({progress.completedCount}/{progress.totalCount})
      </p>

      <div className="mt-4 rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">마일스톤 추가</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-lg border p-3"
            placeholder="마일스톤 제목"
            value={newMilestoneTitle}
            onChange={(e) => setNewMilestoneTitle(e.target.value)}
          />
          <input
            className="rounded-lg border p-3"
            type="date"
            value={newMilestoneDue}
            onChange={(e) => setNewMilestoneDue(e.target.value)}
          />
          <button className="rounded-lg border px-4 py-2" onClick={handleAddMilestone}>
            + 추가
          </button>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {milestones.map((milestone) => {
          const status = milestoneStatus(milestone, now);
          return (
            <li key={milestone.id}>
              <Link href={`/milestone/${milestone.id}`} className="block rounded-xl border p-3">
                <p className="font-medium">{milestone.title}</p>
                <p className={status === 'overdue' ? 'text-red-600' : 'text-gray-500'}>
                  {milestone.due_date} · {status}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
