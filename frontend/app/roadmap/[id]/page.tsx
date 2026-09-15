'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { getRoadmap, deleteRoadmap, setRoadmapPublic, reactivateRoadmap } from '../../../lib/roadmaps';
import { listMilestones, createMilestone } from '../../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../../lib/progress';
import { computeNodePositions } from '../../../lib/timeline';
import type { Roadmap, Milestone } from '../../../types/models';

export default function RoadmapDetailPage() {
  const userId = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDue, setNewMilestoneDue] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setRoadmap(await getRoadmap(supabase, id));
    setMilestones(await listMilestones(supabase, id));
  }

  useEffect(() => {
    if (!userId || !id) return;
    load().catch(() => setNotFound(true));
  }, [userId, id]);

  async function handleAddMilestone() {
    if (!id || !newMilestoneTitle || !newMilestoneDue || addingMilestone) return;
    setAddingMilestone(true);
    try {
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
        await reactivateRoadmap(supabase, id);
      }
      setNewMilestoneTitle('');
      setNewMilestoneDue('');
      await load();
    } finally {
      setAddingMilestone(false);
    }
  }

  async function handleDeleteRoadmap() {
    if (!id || deleting) return;
    if (!confirm('이 로드맵과 모든 마일스톤을 삭제할까요? 되돌릴 수 없어요.')) return;
    setDeleting(true);
    try {
      await deleteRoadmap(supabase, id);
      router.replace('/');
    } catch {
      setError('로드맵 삭제에 실패했어요. 다시 시도해주세요.');
      setDeleting(false);
    }
  }

  const [linkCopied, setLinkCopied] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  async function handleTogglePublic(checked: boolean) {
    if (!id) return;
    await setRoadmapPublic(supabase, id, checked);
    await load();
  }

  async function handleCopyLink() {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${id}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // 클립보드 접근이 브라우저 정책으로 막혔을 수 있다 - 조용히 실패하는
      // 대신 사용자가 직접 복사할 수 있게 입력창에 포커스를 주고 텍스트를 선택한다.
      linkInputRef.current?.focus();
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-ink-dim">
        찾을 수 없거나 접근 권한이 없는 로드맵이에요.
      </div>
    );
  }
  if (!roadmap) return null;
  const progress = calculateProgress(milestones);
  const now = new Date();
  const positions = computeNodePositions(milestones.length);
  const pathHeight = 40 + milestones.length * 140 + 100;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-sm text-ink">{roadmap.title}</h1>
          <span className="text-[9px] font-bold text-neon-purple">{roadmap.source === 'ai' ? 'AI 생성' : '직접 입력'}</span>
        </div>
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-neon-red bg-panel shadow-[3px_3px_0_var(--color-border)] disabled:opacity-50"
          onClick={handleDeleteRoadmap}
          disabled={deleting}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neon-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-neon-pink">{error}</p>}

      <div className="mt-3 rounded-2xl border-2 border-border bg-panel p-3.5 shadow-[3px_3px_0_var(--color-border)] text-xs">
        {roadmap.is_public ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-bold text-neon-cyan">커뮤니티에 게시물로 등록됨</span>
              <button className="text-[10px] text-ink-dim underline" onClick={() => handleTogglePublic(false)}>
                등록 취소
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <input
                ref={linkInputRef}
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${id}`}
                className="min-w-0 flex-1 rounded-md border-2 border-border bg-field p-1.5 text-[9px] text-ink-dim"
                onFocus={(e) => e.target.select()}
              />
              <button
                className="shrink-0 rounded-md border-2 border-border bg-neon-cyan px-2.5 py-1.5 text-[9px] font-bold text-border shadow-[2px_2px_0_var(--color-border)]"
                onClick={handleCopyLink}
              >
                {linkCopied ? '복사됨' : '복사'}
              </button>
            </div>
          </>
        ) : (
          <button
            className="w-full rounded-lg border-2 border-border bg-neon-pink py-2 font-bold text-border shadow-[3px_3px_0_var(--color-border)]"
            onClick={() => handleTogglePublic(true)}
          >
            커뮤니티에 게시물로 등록하기
          </button>
        )}
      </div>

      <div className="mt-3 rounded-2xl border-2 border-border bg-panel p-3.5 shadow-[4px_4px_0_var(--color-border)]">
        <div className="flex justify-between text-[10px] text-ink-dim">
          <span>전체 진행률</span>
          <span className="font-bold text-neon-cyan">{progress.percent}%</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border-2 border-border bg-field">
          <div className="h-full bg-neon-cyan shadow-[0_0_8px_var(--color-neon-cyan)]" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="mt-1.5 block text-[9px] text-ink-dim">
          {progress.totalCount}개 마일스톤 중 {progress.completedCount}개 완료
        </span>
      </div>

      <div className="mt-3 rounded-2xl border-2 border-border bg-panel p-3.5 shadow-[3px_3px_0_var(--color-border)]">
        <p className="mb-2 text-[10px] font-bold text-ink-dim">+ 마일스톤 추가</p>
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-md border-2 border-border bg-field p-2 text-xs text-ink"
            placeholder="제목"
            value={newMilestoneTitle}
            onChange={(e) => setNewMilestoneTitle(e.target.value)}
          />
          <input
            className="rounded-md border-2 border-border bg-field p-2 text-xs text-ink sm:w-[110px]"
            type="date"
            value={newMilestoneDue}
            onChange={(e) => setNewMilestoneDue(e.target.value)}
          />
          <button
            className="shrink-0 rounded-md border-2 border-border bg-neon-cyan px-3 py-2 text-xs font-bold text-border shadow-[2px_2px_0_var(--color-border)] disabled:opacity-50"
            onClick={handleAddMilestone}
            disabled={!newMilestoneTitle || !newMilestoneDue || addingMilestone}
          >
            추가
          </button>
        </div>
      </div>

      <ul className="mt-4 space-y-2 sm:hidden">
        {milestones.map((milestone) => {
          const status = milestoneStatus(milestone, now);
          return (
            <li key={milestone.id}>
              <Link href={`/milestone/${milestone.id}`} className="block rounded-xl border-2 border-border bg-panel p-3 shadow-[3px_3px_0_var(--color-border)]">
                <p className="text-xs font-bold text-ink">{milestone.title}</p>
                <p className={`text-[10px] ${status === 'overdue' ? 'text-neon-red' : 'text-ink-dim'}`}>
                  {milestone.due_date} · {status}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="relative mt-6 hidden sm:block" style={{ height: pathHeight }}>
        {milestones.map((milestone, index) => {
          const pos = positions[index];
          const status = milestoneStatus(milestone, now);
          return (
            <Link
              key={milestone.id}
              href={`/milestone/${milestone.id}`}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-1 text-center"
              style={{ left: `${pos.xPercent * 100}%`, top: pos.y }}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-border font-display text-xs shadow-[3px_3px_0_var(--color-border)] ${
                  status === 'done'
                    ? 'bg-panel text-neon-cyan shadow-[3px_3px_0_var(--color-border),0_0_14px_rgba(46,230,255,0.6)]'
                    : status === 'overdue'
                      ? 'bg-neon-pink text-border shadow-[4px_4px_0_var(--color-border),0_0_20px_rgba(255,46,143,0.7)]'
                      : 'bg-panel text-ink-dim'
                }`}
              >
                {status === 'done' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l4 4L19 6" />
                  </svg>
                ) : (
                  String(index + 1).padStart(2, '0')
                )}
              </div>
              <span className="text-xs font-bold text-ink">{milestone.title}</span>
              <span className="text-[10px] text-ink-dim">{milestone.due_date}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
