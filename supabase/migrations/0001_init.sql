create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  source text not null check (source in ('ai', 'manual')),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  order_index integer not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'overdue')),
  completed_at timestamptz
);

create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  streak_count integer not null default 1,
  unique (user_id, checkin_date)
);

create table if not exists public.coaching_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  trigger_type text not null check (trigger_type = 'delay'),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  reminder_enabled boolean not null default true,
  reminder_time time not null default '09:00',
  push_subscription jsonb
);

alter table public.roadmaps enable row level security;
alter table public.milestones enable row level security;
alter table public.habit_checkins enable row level security;
alter table public.coaching_messages enable row level security;
alter table public.notification_settings enable row level security;

create policy "roadmaps_owner" on public.roadmaps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "milestones_owner" on public.milestones
  for all using (
    exists (select 1 from public.roadmaps r where r.id = milestones.roadmap_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.roadmaps r where r.id = milestones.roadmap_id and r.user_id = auth.uid())
  );

create policy "habit_checkins_owner" on public.habit_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "coaching_messages_owner" on public.coaching_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notification_settings_owner" on public.notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 가입 직후에는 세션이 없어 클라이언트가 RLS를 통과해 notification_settings를
-- 만들 수 없으므로(설정 화면에 한 번도 안 들어가면 리마인더 기본값이 영영
-- 적용 안 됨), auth.users에 새 행이 생기면 서버 사이드에서 기본 행을 만든다.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.notification_settings (user_id, reminder_enabled, reminder_time)
  values (new.id, true, '09:00')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
