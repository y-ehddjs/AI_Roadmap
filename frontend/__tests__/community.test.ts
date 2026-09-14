import { listCommunityRoadmaps } from '../lib/community';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('lists public roadmaps with owner nickname and high-five count', async () => {
  const client = makeFakeClient([
    { data: [{ id: 'r1', title: '10km 마라톤', user_id: 'u1' }], error: null }, // public roadmaps
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null }, // owner profiles
    { data: [{ id: 'm1' }, { id: 'm2' }], error: null }, // r1의 마일스톤 id 목록
    { data: null, error: null, count: 5 }, // r1의 하이파이브 개수
  ]);
  const result = await listCommunityRoadmaps(client, 'total');
  expect(result).toEqual([{ roadmapId: 'r1', title: '10km 마라톤', ownerName: '동언', highFiveCount: 5 }]);
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

test('returns 0 high-fives for a roadmap with no milestones, without querying reactions', async () => {
  const client = makeFakeClient([
    { data: [{ id: 'r1', title: '빈 로드맵', user_id: 'u1' }], error: null },
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null },
    { data: [], error: null }, // 마일스톤 없음
  ]);
  const result = await listCommunityRoadmaps(client, 'total');
  expect(result).toEqual([{ roadmapId: 'r1', title: '빈 로드맵', ownerName: '동언', highFiveCount: 0 }]);
  expect(client.from).toHaveBeenCalledTimes(3);
});
