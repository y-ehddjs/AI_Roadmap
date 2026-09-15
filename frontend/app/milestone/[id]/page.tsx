'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { getMilestone, updateMilestone, deleteMilestone } from '../../../lib/milestones';
import { completeRoadmapIfAllDone } from '../../../lib/roadmaps';
import { recordCheckin } from '../../../lib/checkins';
import type { Milestone } from '../../../types/models';

export default function MilestoneDetailPage() {
  const userId = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId || !id) return;
    getMilestone(supabase, id)
      .then((row) => {
        setMilestone(row);
        setDescription(row.description ?? '');
        setDueDate(row.due_date ?? '');
      })
      .catch(() => setNotFound(true));
  }, [userId, id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-ink-dim">
        찾을 수 없거나 접근 권한이 없는 마일스톤이에요.
      </div>
    );
  }
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
      if (userId) {
        await recordCheckin(supabase, userId, new Date());
      }
    }
  }

  async function saveEdits() {
    if (!milestone) return;
    await updateMilestone(supabase, milestone.id, { description, due_date: dueDate });
    router.refresh();
    router.back();
  }

  async function handleDelete() {
    if (!milestone) return;
    if (!confirm('이 마일스톤을 삭제할까요?')) return;
    const roadmapId = milestone.roadmap_id;
    await deleteMilestone(supabase, milestone.id);
    await completeRoadmapIfAllDone(supabase, roadmapId);
    router.replace(`/roadmap/${roadmapId}`);
  }

  const done = milestone.status === 'done';

  return (
    <div className="mx-auto max-w-xl space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-sm font-bold text-ink">{milestone.title}</h1>
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-neon-red bg-panel shadow-[3px_3px_0_var(--color-border)]"
          onClick={handleDelete}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neon-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-2xl border-2 border-border p-4 shadow-[4px_4px_0_var(--color-border)] ${
          done ? 'bg-neon-cyan/10' : 'bg-panel'
        }`}
        onClick={() => toggleDone(!done)}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-border ${
            done ? 'bg-neon-cyan text-border shadow-[0_0_10px_rgba(46,230,255,0.6)]' : 'bg-field text-ink-dim'
          }`}
        >
          {done && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l4 4L19 6" />
            </svg>
          )}
        </span>
        <span className="text-xs font-bold text-ink">완료로 표시</span>
      </button>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-ink-dim">메모</p>
        <textarea
          className="w-full rounded-lg border-2 border-border bg-field p-3 text-xs leading-relaxed text-ink"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-ink-dim">마감일</p>
        <input
          className="rounded-lg border-2 border-border bg-field p-3 text-xs text-ink"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <button
        className="w-full rounded-xl border-2 border-border bg-neon-pink p-3 font-display text-xs text-border shadow-[4px_4px_0_var(--color-border)]"
        onClick={saveEdits}
      >
        저장
      </button>
    </div>
  );
}
