'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { createRoadmap } from '../../../lib/roadmaps';
import { createMilestone } from '../../../lib/milestones';

interface DraftMilestone {
  title: string;
  due_date: string;
}

export default function CreateRoadmapPage() {
  const userId = useRequireAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDue, setMilestoneDue] = useState('');
  const [draftMilestones, setDraftMilestones] = useState<DraftMilestone[]>([]);

  function addDraftMilestone() {
    if (!milestoneTitle || !milestoneDue) return;
    setDraftMilestones([...draftMilestones, { title: milestoneTitle, due_date: milestoneDue }]);
    setMilestoneTitle('');
    setMilestoneDue('');
  }

  async function handleSubmit() {
    if (!userId || !title) return;
    const roadmap = await createRoadmap(supabase, userId, { title, source: 'manual' });
    await Promise.all(
      draftMilestones.map((m, index) =>
        createMilestone(supabase, { roadmap_id: roadmap.id, title: m.title, due_date: m.due_date, order_index: index })
      )
    );
    router.replace(`/roadmap/${roadmap.id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-bold">새 로드맵 만들기</h1>
      <input
        className="w-full rounded-lg border p-3"
        placeholder="목표를 알려주세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="rounded-xl border p-4">
        <p className="mb-2 font-medium">마일스톤 추가</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-lg border p-3"
            placeholder="마일스톤 제목"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
          />
          <input
            className="rounded-lg border p-3"
            type="date"
            value={milestoneDue}
            onChange={(e) => setMilestoneDue(e.target.value)}
          />
          <button className="rounded-lg border px-4 py-2" onClick={addDraftMilestone}>
            + 추가
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {draftMilestones.map((m, index) => (
            <li key={`${m.title}-${index}`}>- {m.title} ({m.due_date})</li>
          ))}
        </ul>
      </div>
      <button className="w-full rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleSubmit}>
        로드맵 만들기
      </button>
    </div>
  );
}
