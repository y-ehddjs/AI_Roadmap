import { hasReacted, getReactionCount, toggleReaction } from '../lib/reactions';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('hasReacted returns true when a row exists', async () => {
  const client = makeFakeClient([{ data: { id: 'x1' }, error: null }]);
  expect(await hasReacted(client, 'r1', 'u1')).toBe(true);
});

test('hasReacted returns false when no row exists', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  expect(await hasReacted(client, 'r1', 'u1')).toBe(false);
});

test('getReactionCount returns the count', async () => {
  const client = makeFakeClient([{ data: null, error: null, count: 3 }]);
  expect(await getReactionCount(client, 'r1')).toBe(3);
});

test('toggleReaction inserts and returns true when not yet reacted', async () => {
  const client = makeFakeClient([
    { data: null, error: null }, // hasReacted -> false
    { data: null, error: null }, // insert
  ]);
  expect(await toggleReaction(client, 'r1', 'u1')).toBe(true);
});

test('toggleReaction deletes and returns false when already reacted', async () => {
  const client = makeFakeClient([
    { data: { id: 'x1' }, error: null }, // hasReacted -> true
    { data: null, error: null }, // delete
  ]);
  expect(await toggleReaction(client, 'r1', 'u1')).toBe(false);
});
