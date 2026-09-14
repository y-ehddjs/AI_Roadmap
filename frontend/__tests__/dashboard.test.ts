import { summarizeDashboard } from '../lib/dashboard';

test('computes overall percent across all roadmaps', () => {
  const entries = [
    { roadmap: { id: 'r1', title: 'A' } as any, milestones: [{ status: 'done' }, { status: 'pending' }] as any },
    { roadmap: { id: 'r2', title: 'B' } as any, milestones: [{ status: 'done' }, { status: 'done' }] as any },
  ];
  const result = summarizeDashboard(entries);
  expect(result.overallPercent).toBe(75);
  expect(result.roadmaps).toHaveLength(2);
});

test('returns 0 overall percent when there are no milestones anywhere', () => {
  const entries = [{ roadmap: { id: 'r1' } as any, milestones: [] }];
  expect(summarizeDashboard(entries).overallPercent).toBe(0);
});
