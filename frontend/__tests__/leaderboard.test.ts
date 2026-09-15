import { getLeaderboard } from '../lib/leaderboard';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('ranks followed users (and self) by hearts + progress, highest first', async () => {
  const client = makeFakeClient([
    { data: [{ followee_id: 'u2' }], error: null }, // viewer(u1)가 팔로우하는 사람들
    {
      data: [
        { user_id: 'u1', display_name: '동언' },
        { user_id: 'u2', display_name: '민수' },
      ],
      error: null,
    }, // profiles where user_id in (u1, u2) and show_on_leaderboard = true
    { data: [{ id: 'r1' }], error: null }, // u1의 공개 로드맵
    { data: null, error: null, count: 2 }, // u1 로드맵들의 하트 합
    { data: [{ roadmap_id: 'r1', status: 'done' }, { roadmap_id: 'r1', status: 'pending' }], error: null }, // u1 마일스톤 -> 진행률 50%
    { data: [{ id: 'r2' }], error: null }, // u2의 공개 로드맵
    { data: null, error: null, count: 5 }, // u2 로드맵들의 하트 합
    { data: [{ roadmap_id: 'r2', status: 'done' }], error: null }, // u2 마일스톤 -> 진행률 100%
  ]);
  const result = await getLeaderboard(client, 'u1');
  expect(result).toEqual([
    { displayName: '민수', heartCount: 5, progressPercent: 100, score: 105 },
    { displayName: '동언', heartCount: 2, progressPercent: 50, score: 52 },
  ]);
});

test('progressPercent is milestone-count-weighted across roadmaps, not a per-roadmap average', async () => {
  // 1개 로드맵(마일스톤 1개, 완료)과 9개 로드맵(마일스톤 9개, 전부 미완료)을 가진
  // 사용자: 로드맵별 퍼센트를 그냥 평균내면 (100%+0%)/2=50%가 되지만, 실제로는
  // 완료한 마일스톤이 10개 중 1개뿐이므로 10%가 맞다 (lib/dashboard.ts의
  // summarizeDashboard와 같은 마일스톤 개수 가중 평균).
  const client = makeFakeClient([
    { data: [], error: null }, // 팔로우 없음
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null },
    { data: [{ id: 'r1' }, { id: 'r2' }], error: null }, // u1의 공개 로드맵 2개
    { data: null, error: null, count: 0 }, // 하트 없음
    {
      data: [
        { roadmap_id: 'r1', status: 'done' },
        { roadmap_id: 'r2', status: 'pending' },
        { roadmap_id: 'r2', status: 'pending' },
        { roadmap_id: 'r2', status: 'pending' },
        { roadmap_id: 'r2', status: 'pending' },
        { roadmap_id: 'r2', status: 'pending' },
        { roadmap_id: 'r2', status: 'pending' },
        { roadmap_id: 'r2', status: 'pending' },
        { roadmap_id: 'r2', status: 'pending' },
        { roadmap_id: 'r2', status: 'pending' },
      ],
      error: null,
    },
  ]);
  const result = await getLeaderboard(client, 'u1');
  expect(result).toEqual([{ displayName: '동언', heartCount: 0, progressPercent: 10, score: 10 }]);
});

test('returns an empty array when nobody (self or followed) opted into the leaderboard', async () => {
  const client = makeFakeClient([
    { data: [], error: null }, // 팔로우 없음
    { data: [], error: null }, // profiles: 아무도 opt-in 안 함
  ]);
  expect(await getLeaderboard(client, 'u1')).toEqual([]);
});
