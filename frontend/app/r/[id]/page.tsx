'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getPublicRoadmap } from '../../../lib/roadmaps';
import { listPublicMilestones } from '../../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../../lib/progress';
import { computeNodePositions, computeTimelinePath } from '../../../lib/timeline';
import { hasReacted, getReactionCount, toggleReaction } from '../../../lib/reactions';
import { getProfile } from '../../../lib/profiles';
import { isFollowing, follow, unfollow } from '../../../lib/follows';
import { listComments, addComment, deleteComment } from '../../../lib/comments';
import type { Roadmap, Milestone, Comment } from '../../../types/models';

type PublicRoadmap = Pick<Roadmap, 'id' | 'title' | 'user_id'>;
type PublicMilestone = Pick<Milestone, 'id' | 'title' | 'due_date' | 'order_index' | 'status'>;

export default function PublicRoadmapPage() {
  const { id } = useParams<{ id: string }>();
  const [roadmap, setRoadmap] = useState<PublicRoadmap | null>(null);
  const [milestones, setMilestones] = useState<PublicMilestone[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string>('');
  const [heartCount, setHeartCount] = useState(0);
  const [reacted, setReacted] = useState(false);
  const [following, setFollowing] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [heartInFlight, setHeartInFlight] = useState(false);
  const [followInFlight, setFollowInFlight] = useState(false);
  const [commentInFlight, setCommentInFlight] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPublicRoadmap(supabase, id)
      .then(async (r) => {
        setRoadmap(r);
        setMilestones(await listPublicMilestones(supabase, id));
        const profile = await getProfile(supabase, r.user_id);
        setOwnerName(profile.display_name);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!roadmap) return;
    getReactionCount(supabase, roadmap.id).then(setHeartCount);
    listComments(supabase, roadmap.id).then(setComments);
  }, [roadmap]);

  useEffect(() => {
    if (!roadmap || !userId) return;
    hasReacted(supabase, roadmap.id, userId).then(setReacted);
    if (userId !== roadmap.user_id) {
      isFollowing(supabase, userId, roadmap.user_id).then(setFollowing);
    }
  }, [roadmap, userId]);

  async function handleHeart() {
    if (!roadmap || !userId || heartInFlight) return;
    setHeartInFlight(true);
    try {
      const nowReacted = await toggleReaction(supabase, roadmap.id, userId);
      setReacted(nowReacted);
      setHeartCount((prev) => prev + (nowReacted ? 1 : -1));
    } catch {
      // 연타로 두 요청이 동시에 나가면 유니크 제약 충돌(409) 등으로 실패할 수
      // 있다 - 화면 상태는 이미 서버와 어긋났을 수 있으니 실제 값으로 다시 맞춘다.
      getReactionCount(supabase, roadmap.id).then(setHeartCount);
      hasReacted(supabase, roadmap.id, userId).then(setReacted);
    } finally {
      setHeartInFlight(false);
    }
  }

  async function handleToggleFollow() {
    if (!roadmap || !userId || followInFlight) return;
    setFollowInFlight(true);
    try {
      if (following) {
        await unfollow(supabase, userId, roadmap.user_id);
        setFollowing(false);
      } else {
        await follow(supabase, userId, roadmap.user_id);
        setFollowing(true);
      }
    } catch {
      isFollowing(supabase, userId, roadmap.user_id).then(setFollowing);
    } finally {
      setFollowInFlight(false);
    }
  }

  async function handleAddComment() {
    if (!roadmap || !userId || !commentBody.trim() || commentInFlight) return;
    setCommentInFlight(true);
    try {
      const created = await addComment(supabase, roadmap.id, userId, commentBody.trim());
      setComments((prev) => [...prev, created]);
      setCommentBody('');
    } catch {
      // 등록 실패 시 입력한 내용은 그대로 남겨서 다시 시도할 수 있게 한다.
    } finally {
      setCommentInFlight(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteComment(supabase, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      // 삭제 실패(네트워크 오류 등) 시 목록은 그대로 두고 사용자가 다시 시도할 수 있게 한다.
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-ink-dim">
        찾을 수 없거나 비공개인 로드맵이에요.
      </div>
    );
  }
  if (!roadmap) return null;

  const progress = calculateProgress(milestones);
  const now = new Date();
  const positions = computeNodePositions(milestones.length);
  const pathHeight = 40 + milestones.length * 140 + 100;
  const isOwner = userId === roadmap.user_id;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex flex-col items-center gap-2">
        <span className="rounded-full border-2 border-neon-purple px-2.5 py-1 text-[9px] font-bold tracking-wide text-neon-purple">
          공개 로드맵 · 읽기 전용
        </span>
        <h1 className="text-center text-sm text-ink">{roadmap.title}</h1>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-neon-purple bg-panel text-[10px] font-bold text-neon-purple">
            {ownerName.slice(0, 1)}
          </span>
          <span className="text-xs text-ink-dim">{ownerName}</span>
        </div>
        {!isOwner && userId && (
          <button
            className={`rounded-full border-2 border-border px-3 py-1 text-[10px] font-bold disabled:opacity-50 ${
              following ? 'bg-panel text-ink-dim' : 'bg-neon-pink text-border shadow-[2px_2px_0_var(--color-border)]'
            }`}
            onClick={handleToggleFollow}
            disabled={followInFlight}
          >
            {following ? '팔로잉' : '팔로우'}
          </button>
        )}
      </div>

      <div className="mt-2.5 rounded-2xl border-2 border-border bg-panel p-3.5 shadow-[4px_4px_0_var(--color-border)]">
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

      <button
        className={`mt-2.5 flex items-center gap-1.5 rounded-full border-2 border-neon-pink px-3 py-2 text-xs font-bold shadow-[3px_3px_0_var(--color-border)] disabled:opacity-60 ${
          reacted ? 'bg-neon-pink text-border' : 'bg-panel text-ink'
        }`}
        onClick={handleHeart}
        disabled={!userId || heartInFlight}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={reacted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
        {heartCount}
      </button>

      <div className="relative mt-6" style={{ height: pathHeight }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${pathHeight}`} preserveAspectRatio="none" style={{ zIndex: 0 }}>
          <path
            d={computeTimelinePath(positions)}
            fill="none"
            stroke="var(--color-neon-pink)"
            strokeOpacity={0.4}
            strokeWidth={1}
            strokeLinecap="round"
            strokeDasharray="0.6 3.5"
          />
        </svg>
        {milestones.map((milestone, index) => {
          const pos = positions[index];
          const status = milestoneStatus(milestone, now);
          return (
            <div
              key={milestone.id}
              className="absolute z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-center"
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
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t-2 border-border pt-4">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h2 className="text-xs font-bold text-ink">댓글 {comments.length}</h2>
        </div>
        {comments.length === 0 && <p className="mt-2 text-xs text-ink-dim">아직 댓글이 없어요.</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {comments.map((comment) => (
            <li key={comment.id} className="flex items-start justify-between gap-2 rounded-lg border-2 border-border bg-panel p-2.5 text-xs">
              <span className="text-ink">{comment.body}</span>
              {userId === comment.user_id && (
                <button
                  className="shrink-0 text-ink-dim"
                  onClick={() => handleDeleteComment(comment.id)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
        {userId && (
          <div className="mt-3 flex gap-1.5">
            <input
              className="min-w-0 flex-1 rounded-lg border-2 border-border bg-field p-2 text-xs text-ink"
              placeholder="댓글을 남겨보세요"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button
              className="shrink-0 rounded-lg border-2 border-border bg-neon-pink px-3 py-2 text-xs font-bold text-border shadow-[2px_2px_0_var(--color-border)] disabled:opacity-50"
              onClick={handleAddComment}
              disabled={!commentBody.trim() || commentInFlight}
            >
              등록
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
