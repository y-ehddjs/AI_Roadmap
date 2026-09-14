import type { SupabaseClient } from '@supabase/supabase-js';

export async function hasReacted(client: SupabaseClient, roadmapId: string, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from('roadmap_reactions')
    .select('id')
    .eq('roadmap_id', roadmapId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function getReactionCount(client: SupabaseClient, roadmapId: string): Promise<number> {
  const { count, error } = await client
    .from('roadmap_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('roadmap_id', roadmapId);
  if (error) throw error;
  return count ?? 0;
}

export async function toggleReaction(client: SupabaseClient, roadmapId: string, userId: string): Promise<boolean> {
  const already = await hasReacted(client, roadmapId, userId);
  if (already) {
    const { error } = await client
      .from('roadmap_reactions')
      .delete()
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from('roadmap_reactions').insert({ roadmap_id: roadmapId, user_id: userId });
  if (error) throw error;
  return true;
}
