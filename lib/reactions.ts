import type { SupabaseClient } from '@supabase/supabase-js';

export async function hasReacted(client: SupabaseClient, milestoneId: string, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from('milestone_reactions')
    .select('id')
    .eq('milestone_id', milestoneId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function getReactionCount(client: SupabaseClient, milestoneId: string): Promise<number> {
  const { count, error } = await client
    .from('milestone_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('milestone_id', milestoneId);
  if (error) throw error;
  return count ?? 0;
}

export async function toggleReaction(client: SupabaseClient, milestoneId: string, userId: string): Promise<boolean> {
  const already = await hasReacted(client, milestoneId, userId);
  if (already) {
    const { error } = await client
      .from('milestone_reactions')
      .delete()
      .eq('milestone_id', milestoneId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from('milestone_reactions').insert({ milestone_id: milestoneId, user_id: userId });
  if (error) throw error;
  return true;
}
