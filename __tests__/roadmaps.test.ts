import { createRoadmap, listRoadmaps, getRoadmap, deleteRoadmap } from '../lib/roadmaps';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('createRoadmap inserts and returns the created row', async () => {
  const fakeRow = { id: '1', user_id: 'u1', title: 'Test', description: null, source: 'manual', status: 'active', created_at: 'now' };
  const client = makeFakeClient([{ data: fakeRow, error: null }]);
  const result = await createRoadmap(client, 'u1', { title: 'Test', source: 'manual' });
  expect(result).toEqual(fakeRow);
  expect(client.from).toHaveBeenCalledWith('roadmaps');
});

test('createRoadmap throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('insert failed') }]);
  await expect(createRoadmap(client, 'u1', { title: 'Test', source: 'manual' })).rejects.toThrow('insert failed');
});

test('listRoadmaps returns rows from the query', async () => {
  const rows = [{ id: '1' }, { id: '2' }];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listRoadmaps(client, 'u1');
  expect(result).toEqual(rows);
});

test('listRoadmaps returns an empty array when data is null', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  const result = await listRoadmaps(client, 'u1');
  expect(result).toEqual([]);
});

test('getRoadmap returns a single row', async () => {
  const row = { id: '1', title: 'Test' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await getRoadmap(client, '1');
  expect(result).toEqual(row);
});

test('deleteRoadmap deletes by id', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await deleteRoadmap(client, '1');
  expect(client.from).toHaveBeenCalledWith('roadmaps');
});

test('deleteRoadmap throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('delete failed') }]);
  await expect(deleteRoadmap(client, '1')).rejects.toThrow('delete failed');
});
