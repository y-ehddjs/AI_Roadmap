import { getLeaderboard } from '../lib/leaderboard';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('ranks profiles by streak, highest first', async () => {
  const client = makeFakeClient([
    {
      data: [
        { user_id: 'u1', display_name: '동언' },
        { user_id: 'u2', display_name: '민수' },
      ],
      error: null,
    }, // profiles where show_on_leaderboard = true
    { data: [{ checkin_date: '2026-09-07' }], error: null }, // u1 checkins -> streak 1
    {
      data: [
        { checkin_date: '2026-09-05' },
        { checkin_date: '2026-09-06' },
        { checkin_date: '2026-09-07' },
      ],
      error: null,
    }, // u2 checkins -> streak 3
  ]);
  const result = await getLeaderboard(client, new Date('2026-09-07'));
  expect(result).toEqual([
    { displayName: '민수', streak: 3 },
    { displayName: '동언', streak: 1 },
  ]);
});

test('returns an empty array when nobody opted into the leaderboard', async () => {
  const client = makeFakeClient([{ data: [], error: null }]);
  expect(await getLeaderboard(client, new Date('2026-09-07'))).toEqual([]);
});
