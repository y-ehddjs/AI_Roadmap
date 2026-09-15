import { listCommunityRoadmaps } from '../lib/community';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('lists public roadmaps with owner nickname and heart count', async () => {
  const client = makeFakeClient([
    { data: [{ id: 'r1', title: '10km 마라톤', user_id: 'u1' }], error: null }, // public roadmaps
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null }, // owner profiles
    {
      data: [
        { roadmap_id: 'r1' },
        { roadmap_id: 'r1' },
        { roadmap_id: 'r1' },
        { roadmap_id: 'r1' },
        { roadmap_id: 'r1' },
      ],
      error: null,
    }, // r1의 하트 행들 (한 번의 in() 조회)
  ]);
  const result = await listCommunityRoadmaps(client, 'total');
  expect(result).toEqual([{ roadmapId: 'r1', title: '10km 마라톤', ownerName: '동언', heartCount: 5 }]);
});

test('returns an empty array when there are no public roadmaps', async () => {
  const client = makeFakeClient([{ data: [], error: null }]);
  expect(await listCommunityRoadmaps(client, 'total')).toEqual([]);
});

test('skips the roadmap query entirely when a name search matches nobody', async () => {
  const client = makeFakeClient([{ data: [], error: null }]); // profiles search -> no match
  const result = await listCommunityRoadmaps(client, 'total', '존재안함');
  expect(result).toEqual([]);
  expect(client.from).toHaveBeenCalledTimes(1);
});

test('returns 0 hearts for a roadmap with no reactions, in exactly 3 calls total', async () => {
  const client = makeFakeClient([
    { data: [{ id: 'r1', title: '빈 로드맵', user_id: 'u1' }], error: null },
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null },
    { data: [], error: null },
  ]);
  const result = await listCommunityRoadmaps(client, 'total');
  expect(result).toEqual([{ roadmapId: 'r1', title: '빈 로드맵', ownerName: '동언', heartCount: 0 }]);
  expect(client.from).toHaveBeenCalledTimes(3);
});

test('counts hearts per-roadmap in a single query even with multiple public roadmaps (no N+1)', async () => {
  const client = makeFakeClient([
    {
      data: [
        { id: 'r1', title: '로드맵1', user_id: 'u1' },
        { id: 'r2', title: '로드맵2', user_id: 'u2' },
      ],
      error: null,
    },
    {
      data: [
        { user_id: 'u1', display_name: '동언' },
        { user_id: 'u2', display_name: '민수' },
      ],
      error: null,
    },
    { data: [{ roadmap_id: 'r1' }, { roadmap_id: 'r2' }, { roadmap_id: 'r2' }], error: null },
  ]);
  const result = await listCommunityRoadmaps(client, 'total');
  expect(result).toEqual([
    { roadmapId: 'r2', title: '로드맵2', ownerName: '민수', heartCount: 2 },
    { roadmapId: 'r1', title: '로드맵1', ownerName: '동언', heartCount: 1 },
  ]);
  // roadmaps + profiles + 하트 한 번의 in() 조회 = 3번, 로드맵 개수와 무관
  expect(client.from).toHaveBeenCalledTimes(3);
});
