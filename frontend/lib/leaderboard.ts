import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateProgress } from './progress';
import { listFollowedUserIds } from './follows';
import type { MilestoneStatus } from '../types/models';

export interface LeaderboardEntry {
  displayName: string;
  heartCount: number;
  progressPercent: number;
  score: number;
}

async function computeUserStats(
  client: SupabaseClient,
  userId: string
): Promise<{ heartCount: number; progressPercent: number }> {
  const { data: roadmaps, error: roadmapsError } = await client
    .from('roadmaps')
    .select('id')
    .eq('user_id', userId)
    .eq('is_public', true);
  if (roadmapsError) throw roadmapsError;
  const roadmapIds = (roadmaps ?? []).map((r: { id: string }) => r.id);
  if (roadmapIds.length === 0) return { heartCount: 0, progressPercent: 0 };

  const { count: heartCount, error: heartsError } = await client
    .from('roadmap_reactions')
    .select('id', { count: 'exact', head: true })
    .in('roadmap_id', roadmapIds);
  if (heartsError) throw heartsError;

  const { data: milestones, error: milestonesError } = await client
    .from('milestones')
    .select('roadmap_id, status')
    .in('roadmap_id', roadmapIds);
  if (milestonesError) throw milestonesError;

  const milestonesByRoadmap = new Map<string, { status: MilestoneStatus }[]>();
  for (const m of (milestones ?? []) as { roadmap_id: string; status: MilestoneStatus }[]) {
    const list = milestonesByRoadmap.get(m.roadmap_id) ?? [];
    list.push({ status: m.status });
    milestonesByRoadmap.set(m.roadmap_id, list);
  }
  const percents = roadmapIds.map((id) => calculateProgress(milestonesByRoadmap.get(id) ?? []).percent);
  const progressPercent = Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length);

  return { heartCount: heartCount ?? 0, progressPercent };
}

export async function getLeaderboard(client: SupabaseClient, viewerUserId: string): Promise<LeaderboardEntry[]> {
  const followedIds = await listFollowedUserIds(client, viewerUserId);
  const userIds = [...new Set([viewerUserId, ...followedIds])];

  const { data: profiles, error } = await client
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)
    .eq('show_on_leaderboard', true);
  if (error) throw error;
  if (!profiles || profiles.length === 0) return [];

  // 순서를 예측 가능하게 유지하려고(그리고 테스트가 순차 호출을 기대하므로)
  // Promise.all 대신 한 명씩 순서대로 조회한다.
  const entries: LeaderboardEntry[] = [];
  for (const p of profiles as { user_id: string; display_name: string }[]) {
    const { heartCount, progressPercent } = await computeUserStats(client, p.user_id);
    entries.push({
      displayName: p.display_name,
      heartCount,
      progressPercent,
      score: heartCount + progressPercent,
    });
  }

  return entries.sort((a, b) => b.score - a.score);
}
