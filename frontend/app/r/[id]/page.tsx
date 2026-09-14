'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getPublicRoadmap } from '../../../lib/roadmaps';
import { listPublicMilestones } from '../../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../../lib/progress';
import { computeNodePositions } from '../../../lib/timeline';
import { hasReacted, getReactionCount, toggleReaction } from '../../../lib/reactions';
import type { Roadmap, Milestone } from '../../../types/models';

type PublicRoadmap = Pick<Roadmap, 'id' | 'title'>;
type PublicMilestone = Pick<Milestone, 'id' | 'title' | 'due_date' | 'order_index' | 'status'>;

export default function PublicRoadmapPage() {
  const { id } = useParams<{ id: string }>();
  const [roadmap, setRoadmap] = useState<PublicRoadmap | null>(null);
  const [milestones, setMilestones] = useState<PublicMilestone[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, { count: number; reacted: boolean }>>({});

  useEffect(() => {
    if (!id) return;
    getPublicRoadmap(supabase, id)
      .then(async (r) => {
        setRoadmap(r);
        setMilestones(await listPublicMilestones(supabase, id));
      })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (milestones.length === 0) return;
    Promise.all(
      milestones.map(async (m) => ({
        id: m.id,
        count: await getReactionCount(supabase, m.id),
        reacted: userId ? await hasReacted(supabase, m.id, userId) : false,
      }))
    ).then((results) => {
      setReactions(Object.fromEntries(results.map((r) => [r.id, { count: r.count, reacted: r.reacted }])));
    });
  }, [milestones, userId]);

  async function handleHighFive(milestoneId: string) {
    if (!userId) return;
    const nowReacted = await toggleReaction(supabase, milestoneId, userId);
    setReactions((prev) => ({
      ...prev,
      [milestoneId]: { count: (prev[milestoneId]?.count ?? 0) + (nowReacted ? 1 : -1), reacted: nowReacted },
    }));
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

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">{roadmap.title}</h1>
      <p className="text-sm text-gray-600">
        전체 진행률 {progress.percent}% ({progress.completedCount}/{progress.totalCount})
      </p>
      <div className="relative mt-4" style={{ height: pathHeight }}>
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
              {userId ? (
                <button
                  className={`mt-1 flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                    reactions[milestone.id]?.reacted ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'
                  }`}
                  onClick={() => handleHighFive(milestone.id)}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  {reactions[milestone.id]?.count ?? 0}
                </button>
              ) : (
                <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  {reactions[milestone.id]?.count ?? 0}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
