import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStreak } from './streak';

export async function recordCheckin(client: SupabaseClient, userId: string, today: Date): Promise<number> {
  const todayStr = today.toISOString().slice(0, 10);
  const { error: insertError } = await client
    .from('habit_checkins')
    .upsert({ user_id: userId, checkin_date: todayStr, streak_count: 0 }, { onConflict: 'user_id,checkin_date', ignoreDuplicates: true });
  if (insertError) throw insertError;

  const { data, error } = await client.from('habit_checkins').select('checkin_date').eq('user_id', userId);
  if (error) throw error;

  const streak = computeStreak((data ?? []).map((row: { checkin_date: string }) => row.checkin_date), today);

  const { error: updateError } = await client
    .from('habit_checkins')
    .update({ streak_count: streak })
    .eq('user_id', userId)
    .eq('checkin_date', todayStr);
  if (updateError) throw updateError;

  return streak;
}

export async function getTodayStreak(client: SupabaseClient, userId: string, today: Date): Promise<number> {
  const { data, error } = await client.from('habit_checkins').select('checkin_date').eq('user_id', userId);
  if (error) throw error;
  return computeStreak((data ?? []).map((row: { checkin_date: string }) => row.checkin_date), today);
}

export async function hasCheckedInToday(client: SupabaseClient, userId: string, today: Date): Promise<boolean> {
  const todayStr = today.toISOString().slice(0, 10);
  const { data, error } = await client
    .from('habit_checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('checkin_date', todayStr)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
