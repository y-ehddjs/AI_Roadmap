'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getPublicRoadmap } from '../../../lib/roadmaps';
import { listPublicMilestones } from '../../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../../lib/progress';
import { computeNodePositions } from '../../../lib/timeline';
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
    if (userId) hasReacted(supabase, roadmap.id, userId).then(setReacted);
    listComments(supabase, roadmap.id).then(setComments);
  }, [roadmap, userId]);

  useEffect(() => {
    if (!roadmap || !userId || userId === roadmap.user_id) return;
    isFollowing(supabase, userId, roadmap.user_id).then(setFollowing);
  }, [roadmap, userId]);

  async function handleHeart() {
    if (!roadmap || !userId) return;
    const nowReacted = await toggleReaction(supabase, roadmap.id, userId);
    setReacted(nowReacted);
    setHeartCount((prev) => prev + (nowReacted ? 1 : -1));
  }

  async function handleToggleFollow() {
    if (!roadmap || !userId) return;
    if (following) {
      await unfollow(supabase, userId, roadmap.user_id);
      setFollowing(false);
    } else {
      await follow(supabase, userId, roadmap.user_id);
      setFollowing(true);
    }
  }

  async function handleAddComment() {
    if (!roadmap || !userId || !commentBody.trim()) return;
    const created = await addComment(supabase, roadmap.id, userId, commentBody.trim());
    setComments((prev) => [...prev, created]);
    setCommentBody('');
  }

  async function handleDeleteComment(commentId: string) {
    await deleteComment(supabase, commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-gray-600">
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
      <h1 className="text-xl font-bold">{roadmap.title}</h1>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-sm text-gray-600">{ownerName}</p>
        {!isOwner && userId && (
          <button
            className={`rounded-full border px-3 py-1 text-xs ${
              following ? 'bg-gray-100 text-gray-700' : 'bg-orange-500 text-white'
            }`}
            onClick={handleToggleFollow}
          >
            {following ? '팔로잉' : '팔로우'}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-600">
        전체 진행률 {progress.percent}% ({progress.completedCount}/{progress.totalCount})
      </p>
      <button
        className={`mt-2 flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm ${
          reacted ? 'bg-rose-500 text-white' : 'bg-white text-gray-600'
        } ${!userId ? 'opacity-60' : ''}`}
        onClick={handleHeart}
        disabled={!userId}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={reacted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
        {heartCount}
      </button>

      <div className="relative mt-6" style={{ height: pathHeight }}>
        {milestones.map((milestone, index) => {
          const pos = positions[index];
          const status = milestoneStatus(milestone, now);
          return (
            <div
              key={milestone.id}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-1 text-center"
              style={{ left: `${pos.xPercent * 100}%`, top: pos.y }}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full font-semibold text-white ${
                  status === 'done' ? 'bg-green-500' : status === 'overdue' ? 'bg-red-500' : 'bg-gray-200 !text-gray-700'
                }`}
              >
                {index + 1}
              </div>
              <span className="text-sm font-medium">{milestone.title}</span>
              <span className="text-xs text-gray-500">{milestone.due_date}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t pt-4">
        <h2 className="text-sm font-semibold">댓글 {comments.length}</h2>
        <ul className="mt-2 space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-2 text-sm">
              <span>{comment.body}</span>
              {userId === comment.user_id && (
                <button className="shrink-0 text-xs text-gray-400 hover:text-red-600" onClick={() => handleDeleteComment(comment.id)}>
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
        {userId && (
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-lg border p-2 text-sm"
              placeholder="댓글을 남겨보세요"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button className="rounded-lg bg-orange-500 px-3 py-2 text-sm text-white" onClick={handleAddComment}>
              등록
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
