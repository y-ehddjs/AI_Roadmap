export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (typeof anonKey !== 'string' || anonKey.length === 0) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}
