import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoachingMessage } from '../types/models';

export interface CoachingMessageWithRoadmap extends CoachingMessage {
  roadmap_title: string;
}

export async function listMessages(client: SupabaseClient, userId: string): Promise<CoachingMessageWithRoadmap[]> {
  const { data, error } = await client
    .from('coaching_messages')
    .select('*, roadmaps(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const { roadmaps, ...rest } = row;
    return { ...rest, roadmap_title: roadmaps?.title ?? '' } as CoachingMessageWithRoadmap;
  });
}

export async function markRead(client: SupabaseClient, messageId: string): Promise<void> {
  const { error } = await client
    .from('coaching_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}
