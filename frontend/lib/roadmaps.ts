import type { SupabaseClient } from '@supabase/supabase-js';
import type { Roadmap, RoadmapSource } from '../types/models';
import { listMilestones } from './milestones';

export async function createRoadmap(
  client: SupabaseClient,
  userId: string,
  input: { title: string; description?: string; source: RoadmapSource }
): Promise<Roadmap> {
  const { data, error } = await client
    .from('roadmaps')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      source: input.source,
      status: 'active',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Roadmap;
}

export async function listRoadmaps(client: SupabaseClient, userId: string): Promise<Roadmap[]> {
  const { data, error } = await client
    .from('roadmaps')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Roadmap[];
}

export async function getRoadmap(client: SupabaseClient, roadmapId: string): Promise<Roadmap> {
  const { data, error } = await client.from('roadmaps').select('*').eq('id', roadmapId).single();
  if (error) throw error;
  return data as Roadmap;
}

export async function deleteRoadmap(client: SupabaseClient, roadmapId: string): Promise<void> {
  const { error } = await client.from('roadmaps').delete().eq('id', roadmapId);
  if (error) throw error;
}

export async function completeRoadmapIfAllDone(client: SupabaseClient, roadmapId: string): Promise<void> {
  const milestones = await listMilestones(client, roadmapId);
  const allDone = milestones.length > 0 && milestones.every((m) => m.status === 'done');
  if (!allDone) return;
  const { error } = await client.from('roadmaps').update({ status: 'completed' }).eq('id', roadmapId);
  if (error) throw error;
}

export async function setRoadmapPublic(client: SupabaseClient, roadmapId: string, isPublic: boolean): Promise<void> {
  const { error } = await client.from('roadmaps').update({ is_public: isPublic }).eq('id', roadmapId);
  if (error) throw error;
}

// 공개 화면 전용 — description/user_id 등 개인 정보가 담긴 컬럼은 아예
// select하지 않는다. UI가 안 그린다고 안전한 게 아니라, 네트워크 응답에
// 애초에 안 실려야 안전하다.
export async function getPublicRoadmap(client: SupabaseClient, roadmapId: string): Promise<Pick<Roadmap, 'id' | 'title'>> {
  const { data, error } = await client.from('roadmaps').select('id, title').eq('id', roadmapId).single();
  if (error) throw error;
  return data as Pick<Roadmap, 'id' | 'title'>;
}
