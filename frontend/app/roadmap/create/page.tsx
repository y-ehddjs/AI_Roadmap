'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { createRoadmap } from '../../../lib/roadmaps';
import { createMilestone } from '../../../lib/milestones';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL as string;

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
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [aiDescription, setAiDescription] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  function addDraftMilestone() {
    if (!milestoneTitle || !milestoneDue) return;
    setDraftMilestones([...draftMilestones, { title: milestoneTitle, due_date: milestoneDue }]);
    setMilestoneTitle('');
    setMilestoneDue('');
  }

  function removeDraftMilestone(index: number) {
    setDraftMilestones(draftMilestones.filter((_, i) => i !== index));
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

  async function handleAiSubmit() {
    if (!userId || !title) return;
    try {
      const response = await fetch(`${BACKEND_URL}/generate-roadmap`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId, title, description: aiDescription }),
      });
      if (!response.ok) throw new Error('AI request failed');
      const data = await response.json();
      router.replace(`/roadmap/${data.roadmap_id}`);
    } catch {
      setAiError('AI 생성에 실패했어요. 직접 입력으로 만들어주세요.');
      setMode('manual');
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-bold">새 로드맵 만들기</h1>
      <div className="flex gap-2">
        <button
          className={`flex-1 rounded-lg p-3 font-semibold ${mode === 'ai' ? 'bg-orange-500 text-white' : 'border'}`}
          onClick={() => setMode('ai')}
        >
          AI가 만들어줘
        </button>
        <button
          className={`flex-1 rounded-lg p-3 font-semibold ${mode === 'manual' ? 'bg-orange-500 text-white' : 'border'}`}
          onClick={() => setMode('manual')}
        >
          직접 만들래
        </button>
      </div>
      {aiError && <p className="text-sm text-red-600">{aiError}</p>}
      {mode === 'ai' ? (
        <div className="space-y-3 rounded-xl border p-4">
          <input className="w-full rounded-lg border p-3" placeholder="목표를 알려주세요" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="w-full rounded-lg border p-3"
            placeholder="추가 설명 (선택)"
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
          />
          <button className="w-full rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleAiSubmit}>
            AI로 로드맵 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
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
                <li key={`${m.title}-${index}`} className="flex items-center justify-between gap-2">
                  <span>- {m.title} ({m.due_date})</span>
                  <button className="text-xs text-red-600" onClick={() => removeDraftMilestone(index)}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
            <button className="mt-3 w-full rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleSubmit}>
              로드맵 만들기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
