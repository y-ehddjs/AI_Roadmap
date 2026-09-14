import { createRoadmap, listRoadmaps, getRoadmap, deleteRoadmap, completeRoadmapIfAllDone, setRoadmapPublic, getPublicRoadmap } from '../lib/roadmaps';
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

test('completeRoadmapIfAllDone marks the roadmap completed when every milestone is done', async () => {
  const client = makeFakeClient([
    { data: [{ status: 'done' }, { status: 'done' }], error: null }, // listMilestones
    { data: null, error: null }, // update
  ]);
  await completeRoadmapIfAllDone(client, 'r1');
  expect(client.from).toHaveBeenCalledWith('roadmaps');
});

test('completeRoadmapIfAllDone does nothing when a milestone is still pending', async () => {
  const client = makeFakeClient([
    { data: [{ status: 'done' }, { status: 'pending' }], error: null }, // listMilestones
  ]);
  await completeRoadmapIfAllDone(client, 'r1');
  expect(client.from).toHaveBeenCalledTimes(1); // only the listMilestones call
});

test('completeRoadmapIfAllDone does nothing for a roadmap with no milestones', async () => {
  const client = makeFakeClient([{ data: [], error: null }]);
  await completeRoadmapIfAllDone(client, 'r1');
  expect(client.from).toHaveBeenCalledTimes(1);
});

test('setRoadmapPublic updates the is_public flag', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await setRoadmapPublic(client, 'r1', true);
  expect(client.from).toHaveBeenCalledWith('roadmaps');
});

test('getPublicRoadmap returns id, title, and user_id', async () => {
  const row = { id: 'r1', title: 'Test', user_id: 'u1' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await getPublicRoadmap(client, 'r1');
  expect(result).toEqual(row);
});
