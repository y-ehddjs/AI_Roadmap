import type { SupabaseClient } from '@supabase/supabase-js';
import type { Comment } from '../types/models';

export async function listComments(client: SupabaseClient, roadmapId: string): Promise<Comment[]> {
  const { data, error } = await client
    .from('comments')
    .select('*')
    .eq('roadmap_id', roadmapId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addComment(
  client: SupabaseClient,
  roadmapId: string,
  userId: string,
  body: string
): Promise<Comment> {
  const { data, error } = await client
    .from('comments')
    .insert({ roadmap_id: roadmapId, user_id: userId, body })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(client: SupabaseClient, commentId: string): Promise<void> {
  const { error } = await client.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}
