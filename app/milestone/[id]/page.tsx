'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { updateMilestone, deleteMilestone } from '../../../lib/milestones';
import { completeRoadmapIfAllDone } from '../../../lib/roadmaps';
import type { Milestone } from '../../../types/models';

export default function MilestoneDetailPage() {
  const userId = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!userId || !id) return;
    async function load() {
      const { data } = await supabase.from('milestones').select('*').eq('id', id).single();
      const row = data as Milestone;
      setMilestone(row);
      setDescription(row?.description ?? '');
      setDueDate(row?.due_date ?? '');
    }
    load();
  }, [userId, id]);

  if (!milestone) return null;

  async function toggleDone(checked: boolean) {
    if (!milestone) return;
    const updated = await updateMilestone(supabase, milestone.id, {
      status: checked ? 'done' : 'pending',
      completed_at: checked ? new Date().toISOString() : null,
    });
    setMilestone(updated);
    if (checked) {
      await completeRoadmapIfAllDone(supabase, milestone.roadmap_id);
    }
  }

  async function saveEdits() {
    if (!milestone) return;
    await updateMilestone(supabase, milestone.id, { description, due_date: dueDate });
    // App Router는 뒤로 이동 시 이전 화면을 캐시에서 그대로 보여줄 수 있어서,
    // 방금 바뀐 마감일/지연 상태가 안 보일 수 있다 - 뒤로 가기 전에 캐시를 무효화한다.
    router.refresh();
    router.back();
  }

  async function handleDelete() {
    if (!milestone) return;
    if (!confirm('이 마일스톤을 삭제할까요?')) return;
    const roadmapId = milestone.roadmap_id;
    await deleteMilestone(supabase, milestone.id);
    router.replace(`/roadmap/${roadmapId}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{milestone.title}</h1>
        <button className="text-sm text-red-600 underline" onClick={handleDelete}>
          삭제
        </button>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={milestone.status === 'done'} onChange={(e) => toggleDone(e.target.checked)} />
        완료
      </label>
      <div>
        <p className="mb-1 text-sm font-medium">메모</p>
        <textarea
          className="w-full rounded-lg border p-3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">마감일</p>
        <input className="rounded-lg border p-3" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <button className="rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white" onClick={saveEdits}>
        저장
      </button>
    </div>
  );
}
