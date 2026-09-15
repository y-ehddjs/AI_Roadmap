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
  const [submitting, setSubmitting] = useState(false);

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
    if (!userId || !title || submitting) return;
    setSubmitting(true);
    try {
      const roadmap = await createRoadmap(supabase, userId, { title, source: 'manual' });
      await Promise.all(
        draftMilestones.map((m, index) =>
          createMilestone(supabase, { roadmap_id: roadmap.id, title: m.title, due_date: m.due_date, order_index: index })
        )
      );
      router.replace(`/roadmap/${roadmap.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAiSubmit() {
    if (!userId || !title || submitting) return;
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'ai') {
      handleAiSubmit();
    } else {
      handleSubmit();
    }
  }

  return (
    <form className="mx-auto max-w-xl space-y-5 p-6" onSubmit={handleFormSubmit}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-border bg-panel shadow-[3px_3px_0_var(--color-border)]"
          onClick={() => router.back()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neon-cyan)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="font-display text-sm text-neon-cyan drop-shadow-[0_0_8px_rgba(46,230,255,0.5)]">새 로드맵</h1>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold tracking-wide text-ink-dim">만드는 방식</span>
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-border p-3 text-xs font-bold ${
              mode === 'ai'
                ? 'bg-neon-pink text-border shadow-[3px_3px_0_var(--color-border)]'
                : 'bg-panel text-ink-dim'
            }`}
            onClick={() => setMode('ai')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.6 4.9L18 9l-4.4 1.1L12 15l-1.6-4.9L6 9l4.4-1.1z" />
            </svg>
            AI가 만들어줘
          </button>
          <button
            type="button"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-border p-3 text-xs font-bold ${
              mode === 'manual'
                ? 'bg-neon-pink text-border shadow-[3px_3px_0_var(--color-border)]'
                : 'bg-panel text-ink-dim'
            }`}
            onClick={() => setMode('manual')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
            직접 만들래
          </button>
        </div>
      </div>

      {aiError && <p className="text-xs text-neon-pink">{aiError}</p>}

      {mode === 'ai' ? (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-border bg-panel p-4 shadow-[5px_5px_0_var(--color-border)]">
          <div className="flex items-center gap-2 rounded-lg border-2 border-neon-purple bg-neon-purple/10 px-3 py-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-neon-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.6 4.9L18 9l-4.4 1.1L12 15l-1.6-4.9L6 9l4.4-1.1z" />
            </svg>
            <span className="text-[10px] leading-relaxed text-neon-purple">AI가 마일스톤과 마감일을 자동으로 제안해요</span>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-ink-dim">목표를 알려주세요</label>
            <input
              className="w-full rounded-lg border-2 border-border bg-field p-3 text-xs text-ink"
              placeholder="예: 3개월 안에 10km 마라톤 완주하기"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-ink-dim">추가 설명 (선택)</label>
            <textarea
              className="w-full rounded-lg border-2 border-border bg-field p-2.5 text-xs leading-relaxed text-ink"
              placeholder="현재 체력 수준, 주당 가능한 시간 등을 적어주면 더 정확한 로드맵을 만들어줘요"
              rows={4}
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border-2 border-border bg-neon-pink p-3 font-display text-[11px] text-border shadow-[4px_4px_0_var(--color-border)] disabled:opacity-50"
            disabled={!title || submitting}
          >
            AI로 만들기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-ink-dim">목표를 알려주세요</label>
            <input
              className="w-full rounded-lg border-2 border-border bg-field p-3 text-xs text-ink"
              placeholder="예: 3개월 안에 10km 마라톤 완주하기"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3.5 rounded-2xl border-2 border-border bg-panel p-4 shadow-[5px_5px_0_var(--color-border)]">
            <span className="text-[10px] font-bold tracking-wide text-ink-dim">마일스톤 추가</span>
            <div className="flex gap-1.5">
              <input
                className="min-w-0 flex-1 rounded-lg border-2 border-border bg-field p-2.5 text-xs text-ink"
                placeholder="마일스톤 제목"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
              />
              <input
                className="w-[100px] rounded-lg border-2 border-border bg-field p-2.5 text-xs text-ink"
                type="date"
                value={milestoneDue}
                onChange={(e) => setMilestoneDue(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="rounded-lg border-2 border-neon-cyan bg-field p-2.5 text-xs font-bold text-neon-cyan disabled:opacity-50"
              onClick={addDraftMilestone}
              disabled={!milestoneTitle || !milestoneDue}
            >
              + 추가
            </button>
            {draftMilestones.length > 0 && (
              <ul className="flex flex-col gap-2.5 border-t-2 border-dashed border-border pt-3">
                {draftMilestones.map((m, index) => (
                  <li key={`${m.title}-${index}`} className="flex items-center gap-2.5">
                    <span className="font-display w-4 shrink-0 text-[9px] text-neon-cyan">{String(index + 1).padStart(2, '0')}</span>
                    <span className="flex-1 text-xs font-bold text-ink">{m.title}</span>
                    <span className="text-[9px] text-ink-dim">{m.due_date}</span>
                    <button type="button" onClick={() => removeDraftMilestone(index)} className="shrink-0 text-ink-dim">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="submit"
              className="mt-1 rounded-xl border-2 border-border bg-neon-pink p-3 font-display text-[11px] text-border shadow-[4px_4px_0_var(--color-border)] disabled:opacity-50"
              disabled={!title || submitting}
            >
              로드맵 만들기
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
