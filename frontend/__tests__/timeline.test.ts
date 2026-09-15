import { computeNodePositions, computeTimelinePath } from '../lib/timeline';

test('alternates left and right starting with left', () => {
  const positions = computeNodePositions(4);
  expect(positions.map((p) => p.side)).toEqual(['left', 'right', 'left', 'right']);
});

test('increases y by a fixed row height per node', () => {
  const positions = computeNodePositions(3);
  expect(positions[1].y - positions[0].y).toBe(140);
  expect(positions[2].y - positions[1].y).toBe(140);
});

test('uses a fixed horizontal percent for each side so the layout scales with container width', () => {
  const positions = computeNodePositions(2);
  expect(positions[0].xPercent).toBeCloseTo(0.15);
  expect(positions[1].xPercent).toBeCloseTo(0.75);
});

test('returns an empty array for zero milestones', () => {
  expect(computeNodePositions(0)).toEqual([]);
});

test('computeTimelinePath draws a zigzag S-curve through every node, in xPercent*100/y units', () => {
  const positions = computeNodePositions(3);
  const path = computeTimelinePath(positions);
  // 시작점(M)은 첫 번째 노드, 이후 각 구간은 큐빅 베지어(C)로 다음 노드까지 이어진다.
  expect(path).toBe(
    'M15,40 C15,110 75,110 75,180 C75,250 15,250 15,320'
  );
});

test('computeTimelinePath returns an empty string for 0 or 1 nodes (nothing to connect)', () => {
  expect(computeTimelinePath(computeNodePositions(0))).toBe('');
  expect(computeTimelinePath(computeNodePositions(1))).toBe('');
});
