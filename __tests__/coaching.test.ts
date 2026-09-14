import { listMessages, markRead } from '../lib/coaching';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('listMessages returns rows ordered by newest first, flattened with the roadmap title', async () => {
  const rows = [
    { id: 'c2', roadmap_id: 'r2', message: '두 번째', created_at: '2026-09-07T00:00:00Z', read_at: null, roadmaps: { title: '정보처리기사 자격증' } },
    { id: 'c1', roadmap_id: 'r1', message: '첫 번째', created_at: '2026-09-06T00:00:00Z', read_at: null, roadmaps: { title: '10km 마라톤 완주하기' } },
  ];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listMessages(client, 'u1');
  expect(result).toEqual([
    { id: 'c2', roadmap_id: 'r2', message: '두 번째', created_at: '2026-09-07T00:00:00Z', read_at: null, roadmap_title: '정보처리기사 자격증' },
    { id: 'c1', roadmap_id: 'r1', message: '첫 번째', created_at: '2026-09-06T00:00:00Z', read_at: null, roadmap_title: '10km 마라톤 완주하기' },
  ]);
});

test('listMessages returns an empty array when data is null', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  expect(await listMessages(client, 'u1')).toEqual([]);
});

test('markRead updates read_at and throws on error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('update failed') }]);
  await expect(markRead(client, 'c1')).rejects.toThrow('update failed');
});
