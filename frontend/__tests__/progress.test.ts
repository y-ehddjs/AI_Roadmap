import { milestoneStatus, calculateProgress } from '../lib/progress';

describe('milestoneStatus', () => {
  test('returns done when the milestone is marked done regardless of due date', () => {
    expect(milestoneStatus({ status: 'done', due_date: '2020-01-01' }, new Date('2026-01-01'))).toBe('done');
  });

  test('returns overdue when due_date is in the past and not done', () => {
    expect(milestoneStatus({ status: 'pending', due_date: '2026-01-01' }, new Date('2026-02-01'))).toBe('overdue');
  });

  test('returns pending when due_date is in the future', () => {
    expect(milestoneStatus({ status: 'pending', due_date: '2026-03-01' }, new Date('2026-01-01'))).toBe('pending');
  });
});

describe('calculateProgress', () => {
  test('returns 0 percent for an empty milestone list', () => {
    expect(calculateProgress([])).toEqual({ percent: 0, completedCount: 0, totalCount: 0 });
  });

  test('rounds the percentage of completed milestones', () => {
    const milestones = [{ status: 'done' }, { status: 'done' }, { status: 'pending' }] as { status: 'done' | 'pending' }[];
    expect(calculateProgress(milestones)).toEqual({ percent: 67, completedCount: 2, totalCount: 3 });
  });
});
