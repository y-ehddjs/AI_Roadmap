export type RoadmapSource = 'ai' | 'manual';
export type RoadmapStatus = 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'pending' | 'done' | 'overdue';

export interface Roadmap {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  source: RoadmapSource;
  status: RoadmapStatus;
  is_public: boolean;
  created_at: string;
}

export interface Milestone {
  id: string;
  roadmap_id: string;
  title: string;
  description: string | null;
  due_date: string;
  order_index: number;
  status: MilestoneStatus;
  completed_at: string | null;
}

export interface HabitCheckin {
  id: string;
  user_id: string;
  checkin_date: string;
  streak_count: number;
}

export interface CoachingMessage {
  id: string;
  user_id: string;
  roadmap_id: string;
  trigger_type: 'delay';
  message: string;
  created_at: string;
  read_at: string | null;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  reminder_enabled: boolean;
  reminder_time: string;
  push_subscription: PushSubscriptionData | null;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  show_on_leaderboard: boolean;
  created_at: string;
}

export interface MilestoneReaction {
  id: string;
  milestone_id: string;
  user_id: string;
  created_at: string;
}
