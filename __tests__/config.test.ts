import { getSupabaseConfig } from '../lib/config';

test('returns url and anonKey when both are present', () => {
  const result = getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' });
  expect(result).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon-key' });
});

test('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
  expect(() => getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' })).toThrow('NEXT_PUBLIC_SUPABASE_URL');
});

test('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
  expect(() => getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
});
