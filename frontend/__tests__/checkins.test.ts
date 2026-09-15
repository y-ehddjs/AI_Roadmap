import { recordCheckin, getTodayStreak, hasCheckedInToday } from '../lib/checkins';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('recordCheckin upserts today, recomputes streak, and stores it', async () => {
  const client = makeFakeClient([
    { data: null, error: null },
    { data: [{ checkin_date: '2026-09-06' }, { checkin_date: '2026-09-07' }], error: null },
    { data: null, error: null },
  ]);
  const streak = await recordCheckin(client, 'u1', new Date('2026-09-07'));
  expect(streak).toBe(2);
});

test('getTodayStreak computes the streak without writing', async () => {
  const client = makeFakeClient([{ data: [{ checkin_date: '2026-09-07' }], error: null }]);
  const streak = await getTodayStreak(client, 'u1', new Date('2026-09-07'));
  expect(streak).toBe(1);
});

test('hasCheckedInToday returns true when a row exists for today', async () => {
  const client = makeFakeClient([{ data: { id: 'c1' }, error: null }]);
  expect(await hasCheckedInToday(client, 'u1', new Date('2026-09-07'))).toBe(true);
});

test('hasCheckedInToday returns false when no row exists for today', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  expect(await hasCheckedInToday(client, 'u1', new Date('2026-09-07'))).toBe(false);
});
