import { createMilestone, listMilestones, updateMilestone, deleteMilestone } from '../lib/milestones';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('createMilestone inserts and returns the created row', async () => {
  const row = { id: 'm1', roadmap_id: 'r1', title: '1km 완주', due_date: '2026-10-01', order_index: 0, status: 'pending' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await createMilestone(client, { roadmap_id: 'r1', title: '1km 완주', due_date: '2026-10-01', order_index: 0 });
  expect(result).toEqual(row);
});

test('listMilestones returns rows from the query (real ordering is verified by Supabase, not this fake client)', async () => {
  const rows = [{ id: 'm1', order_index: 0 }, { id: 'm2', order_index: 1 }];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listMilestones(client, 'r1');
  expect(result).toEqual(rows);
});

test('updateMilestone applies a partial patch and returns the updated row', async () => {
  const row = { id: 'm1', status: 'done', completed_at: '2026-09-07T00:00:00Z' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await updateMilestone(client, 'm1', { status: 'done', completed_at: '2026-09-07T00:00:00Z' });
  expect(result).toEqual(row);
});

test('updateMilestone throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('update failed') }]);
  await expect(updateMilestone(client, 'm1', { status: 'done' })).rejects.toThrow('update failed');
});

test('deleteMilestone deletes by id', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await deleteMilestone(client, 'm1');
  expect(client.from).toHaveBeenCalledWith('milestones');
});

test('deleteMilestone throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('delete failed') }]);
  await expect(deleteMilestone(client, 'm1')).rejects.toThrow('delete failed');
});
