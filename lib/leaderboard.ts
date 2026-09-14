import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStreak } from './streak';

export interface LeaderboardEntry {
  displayName: string;
  streak: number;
}

export async function getLeaderboard(client: SupabaseClient, today: Date): Promise<LeaderboardEntry[]> {
  const { data: profiles, error } = await client
    .from('profiles')
    .select('user_id, display_name')
    .eq('show_on_leaderboard', true);
  if (error) throw error;

  const entries = await Promise.all(
    (profiles ?? []).map(async (p: { user_id: string; display_name: string }) => {
      const { data: checkins, error: checkinError } = await client
        .from('habit_checkins')
        .select('checkin_date')
        .eq('user_id', p.user_id);
      if (checkinError) throw checkinError;
      const streak = computeStreak((checkins ?? []).map((c: { checkin_date: string }) => c.checkin_date), today);
      return { displayName: p.display_name, streak };
    })
  );

  return entries.sort((a, b) => b.streak - a.streak);
}
