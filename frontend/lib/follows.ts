import type { SupabaseClient } from '@supabase/supabase-js';

export async function isFollowing(client: SupabaseClient, followerId: string, followeeId: string): Promise<boolean> {
  const { data, error } = await client
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function follow(client: SupabaseClient, followerId: string, followeeId: string): Promise<void> {
  const { error } = await client.from('follows').insert({ follower_id: followerId, followee_id: followeeId });
  if (error) throw error;
}

export async function unfollow(client: SupabaseClient, followerId: string, followeeId: string): Promise<void> {
  const { error } = await client
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) throw error;
}

export async function listFollowedUserIds(client: SupabaseClient, followerId: string): Promise<string[]> {
  const { data, error } = await client.from('follows').select('followee_id').eq('follower_id', followerId);
  if (error) throw error;
  return (data ?? []).map((row: { followee_id: string }) => row.followee_id);
}
