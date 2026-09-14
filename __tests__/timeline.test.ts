import { computeNodePositions } from '../lib/timeline';

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
