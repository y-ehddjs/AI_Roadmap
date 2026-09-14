import { listCommunityRoadmaps } from '../lib/community';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('lists public roadmaps with owner nickname and heart count', async () => {
  const client = makeFakeClient([
    { data: [{ id: 'r1', title: '10km 마라톤', user_id: 'u1' }], error: null }, // public roadmaps
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null }, // owner profiles
    { data: null, error: null, count: 5 }, // r1의 하트 개수
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

test('returns 0 hearts for a roadmap with no reactions', async () => {
  const client = makeFakeClient([
    { data: [{ id: 'r1', title: '빈 로드맵', user_id: 'u1' }], error: null },
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null },
    { data: null, error: null, count: 0 },
  ]);
  const result = await listCommunityRoadmaps(client, 'total');
  expect(result).toEqual([{ roadmapId: 'r1', title: '빈 로드맵', ownerName: '동언', heartCount: 0 }]);
  expect(client.from).toHaveBeenCalledTimes(3);
});
