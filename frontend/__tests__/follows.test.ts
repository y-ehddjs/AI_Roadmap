import { isFollowing, follow, unfollow, listFollowedUserIds } from '../lib/follows';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('isFollowing returns true when a row exists', async () => {
  const client = makeFakeClient([{ data: { id: 'f1' }, error: null }]);
  expect(await isFollowing(client, 'u1', 'u2')).toBe(true);
});

test('isFollowing returns false when no row exists', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  expect(await isFollowing(client, 'u1', 'u2')).toBe(false);
});

test('follow inserts a follows row', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await follow(client, 'u1', 'u2');
  expect(client.from).toHaveBeenCalledWith('follows');
});

test('unfollow deletes the matching follows row', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await unfollow(client, 'u1', 'u2');
  expect(client.from).toHaveBeenCalledWith('follows');
});

test('listFollowedUserIds returns the followee ids', async () => {
  const rows = [{ followee_id: 'u2' }, { followee_id: 'u3' }];
  const client = makeFakeClient([{ data: rows, error: null }]);
  expect(await listFollowedUserIds(client, 'u1')).toEqual(['u2', 'u3']);
});

test('listFollowedUserIds returns an empty array when data is null', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  expect(await listFollowedUserIds(client, 'u1')).toEqual([]);
});
