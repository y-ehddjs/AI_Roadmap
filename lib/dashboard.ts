import { calculateProgress } from './progress';
import type { ProgressSummary } from './progress';
import type { Milestone, Roadmap } from '../types/models';

export interface RoadmapProgress {
  roadmap: Roadmap;
  progress: ProgressSummary;
}

export interface DashboardSummary {
  roadmaps: RoadmapProgress[];
  overallPercent: number;
}

export function summarizeDashboard(entries: { roadmap: Roadmap; milestones: Milestone[] }[]): DashboardSummary {
  const roadmaps = entries.map((e) => ({ roadmap: e.roadmap, progress: calculateProgress(e.milestones) }));
  const totalCompleted = roadmaps.reduce((sum, r) => sum + r.progress.completedCount, 0);
  const totalMilestones = roadmaps.reduce((sum, r) => sum + r.progress.totalCount, 0);
  const overallPercent = totalMilestones === 0 ? 0 : Math.round((totalCompleted / totalMilestones) * 100);
  return { roadmaps, overallPercent };
}
