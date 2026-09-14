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
