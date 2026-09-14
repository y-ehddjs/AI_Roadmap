import type { Milestone, MilestoneStatus } from '../types/models';

export function milestoneStatus(
  milestone: Pick<Milestone, 'status' | 'due_date'>,
  now: Date
): MilestoneStatus {
  if (milestone.status === 'done') return 'done';
  const due = new Date(milestone.due_date);
  return due.getTime() < now.getTime() ? 'overdue' : 'pending';
}

export interface ProgressSummary {
  percent: number;
  completedCount: number;
  totalCount: number;
}

export function calculateProgress(milestones: Pick<Milestone, 'status'>[]): ProgressSummary {
  const totalCount = milestones.length;
  const completedCount = milestones.filter((m) => m.status === 'done').length;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  return { percent, completedCount, totalCount };
}
