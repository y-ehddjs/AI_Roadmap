import type { SupabaseClient } from '@supabase/supabase-js';
import type { Milestone } from '../types/models';

export async function createMilestone(
  client: SupabaseClient,
  input: { roadmap_id: string; title: string; description?: string; due_date: string; order_index: number }
): Promise<Milestone> {
  const { data, error } = await client
    .from('milestones')
    .insert({
      roadmap_id: input.roadmap_id,
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date,
      order_index: input.order_index,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Milestone;
}

export async function listMilestones(client: SupabaseClient, roadmapId: string): Promise<Milestone[]> {
  // due_date는 실제 정렬 기준, order_index는 같은 날짜인 마일스톤들 사이의
  // 입력 순서를 지키기 위한 동점 처리용 보조 키다. 이렇게 하면 나중에 마일스톤을
  // 추가하거나(Task 9) 수동으로 여러 개를 한 번에 만들 때(Task 8) 입력 순서와
  // 무관하게 타임라인이 항상 날짜순으로 보인다 — order_index를 매번 다시
  // 계산해서 맞출 필요가 없다.
  const { data, error } = await client
    .from('milestones')
    .select('*')
    .eq('roadmap_id', roadmapId)
    .order('due_date', { ascending: true })
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Milestone[];
}

export async function updateMilestone(
  client: SupabaseClient,
  milestoneId: string,
  patch: Partial<Pick<Milestone, 'title' | 'description' | 'due_date' | 'status' | 'completed_at'>>
): Promise<Milestone> {
  const { data, error } = await client.from('milestones').update(patch).eq('id', milestoneId).select().single();
  if (error) throw error;
  return data as Milestone;
}

export async function deleteMilestone(client: SupabaseClient, milestoneId: string): Promise<void> {
  const { error } = await client.from('milestones').delete().eq('id', milestoneId);
  if (error) throw error;
}

// 공개 화면 전용 — description(개인 메모)과 roadmap_id는 select하지 않는다.
export async function listPublicMilestones(
  client: SupabaseClient,
  roadmapId: string
): Promise<Pick<Milestone, 'id' | 'title' | 'due_date' | 'order_index' | 'status'>[]> {
  const { data, error } = await client
    .from('milestones')
    .select('id, title, due_date, order_index, status')
    .eq('roadmap_id', roadmapId)
    .order('due_date', { ascending: true })
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Pick<Milestone, 'id' | 'title' | 'due_date' | 'order_index' | 'status'>[];
}
