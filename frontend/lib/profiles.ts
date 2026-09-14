import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../types/models';

export async function getProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client.from('profiles').select('*').eq('user_id', userId).single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  client: SupabaseClient,
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'show_on_leaderboard'>>
): Promise<Profile> {
  const { data, error } = await client.from('profiles').update(patch).eq('user_id', userId).select().single();
  if (error) throw error;
  return data as Profile;
}
