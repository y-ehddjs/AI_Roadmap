import { listComments, addComment, deleteComment } from '../lib/comments';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('listComments returns rows ordered oldest first', async () => {
  const rows = [
    { id: 'c1', roadmap_id: 'r1', user_id: 'u1', body: '화이팅!', created_at: '2026-09-01T00:00:00Z' },
    { id: 'c2', roadmap_id: 'r1', user_id: 'u2', body: '멋져요', created_at: '2026-09-02T00:00:00Z' },
  ];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listComments(client, 'r1');
  expect(result).toEqual(rows);
});

test('listComments returns an empty array when data is null', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  expect(await listComments(client, 'r1')).toEqual([]);
});

test('addComment inserts and returns the created row', async () => {
  const row = { id: 'c1', roadmap_id: 'r1', user_id: 'u1', body: '화이팅!', created_at: '2026-09-01T00:00:00Z' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await addComment(client, 'r1', 'u1', '화이팅!');
  expect(result).toEqual(row);
});

test('deleteComment deletes by id', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await deleteComment(client, 'c1');
  expect(client.from).toHaveBeenCalledWith('comments');
});
