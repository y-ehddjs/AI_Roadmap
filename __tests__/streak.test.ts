import { computeStreak } from '../lib/streak';

test('counts consecutive days ending today', () => {
  const checkins = ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'];
  expect(computeStreak(checkins, new Date('2026-09-07'))).toBe(4);
});

test('still counts the streak when today has not checked in yet but yesterday did', () => {
  const checkins = ['2026-09-05', '2026-09-06'];
  expect(computeStreak(checkins, new Date('2026-09-07'))).toBe(2);
});

test('resets to 0 when the most recent check-in is more than a day old', () => {
  const checkins = ['2026-09-01', '2026-09-02'];
  expect(computeStreak(checkins, new Date('2026-09-07'))).toBe(0);
});

test('ignores a gap earlier in the history once a break occurred', () => {
  const checkins = ['2026-09-01', '2026-09-05', '2026-09-06', '2026-09-07'];
  expect(computeStreak(checkins, new Date('2026-09-07'))).toBe(3);
});

test('returns 0 for no check-ins', () => {
  expect(computeStreak([], new Date('2026-09-07'))).toBe(0);
});
