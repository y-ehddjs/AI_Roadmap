import { getProfile, updateProfile } from '../lib/profiles';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('getProfile returns the row for a user', async () => {
  const row = { id: 'p1', user_id: 'u1', display_name: 'yoon', show_on_leaderboard: false };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await getProfile(client, 'u1');
  expect(result).toEqual(row);
});

test('updateProfile applies a partial patch and returns the updated row', async () => {
  const row = { id: 'p1', user_id: 'u1', display_name: '새닉네임', show_on_leaderboard: true };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await updateProfile(client, 'u1', { display_name: '새닉네임', show_on_leaderboard: true });
  expect(result).toEqual(row);
});

test('updateProfile throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('update failed') }]);
  await expect(updateProfile(client, 'u1', { display_name: 'x' })).rejects.toThrow('update failed');
});
