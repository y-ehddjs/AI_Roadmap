create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  show_on_leaderboard boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.roadmaps add column if not exists is_public boolean not null default false;

create table if not exists public.milestone_reactions (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (milestone_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.milestone_reactions enable row level security;

-- 리더보드/공개 화면에서 다른 사람의 닉네임을 보여줘야 하므로 표시 이름은
-- 누구나 읽을 수 있게 하고, 쓰기는 본인 것만 허용한다.
create policy "profiles_read_all" on public.profiles
  for select using (true);

create policy "profiles_owner_insert" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "profiles_owner_update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 기존 roadmaps_owner/milestones_owner 정책(Task 2)은 그대로 두고, is_public인
-- 로드맵/마일스톤을 "누구나"(로그인 여부 무관) 읽을 수 있는 정책을 추가한다.
-- Postgres RLS는 같은 명령어에 대한 여러 정책을 OR로 합치므로 소유자든
-- 공개 열람이든 둘 중 하나만 만족하면 통과한다.
create policy "roadmaps_public_read" on public.roadmaps
  for select using (is_public = true);

create policy "milestones_public_read" on public.milestones
  for select using (
    exists (select 1 from public.roadmaps r where r.id = milestones.roadmap_id and r.is_public = true)
  );

-- 하이파이브는 공개 로드맵의 마일스톤에만, 로그인한 사용자가 자기 이름으로만
-- 남기거나 지울 수 있다.
create policy "milestone_reactions_public_read" on public.milestone_reactions
  for select using (
    exists (
      select 1 from public.milestones m
      join public.roadmaps r on r.id = m.roadmap_id
      where m.id = milestone_reactions.milestone_id and r.is_public = true
    )
  );

-- 위 정책은 is_public = true일 때만 통과한다. 로드맵 주인이 나중에 다시
-- 비공개로 돌리면 이 정책만으로는 주인조차 자신이 받은 하이파이브를 조회할
-- 방법이 없어지므로, "공개 여부와 무관하게 로드맵 주인은 자기 것을 읽을 수
-- 있다"는 정책을 별도로 추가한다(RLS는 여러 정책을 OR로 합친다).
create policy "milestone_reactions_owner_read" on public.milestone_reactions
  for select using (
    exists (
      select 1 from public.milestones m
      join public.roadmaps r on r.id = m.roadmap_id
      where m.id = milestone_reactions.milestone_id and r.user_id = auth.uid()
    )
  );

create policy "milestone_reactions_insert_own" on public.milestone_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.milestones m
      join public.roadmaps r on r.id = m.roadmap_id
      where m.id = milestone_reactions.milestone_id and r.is_public = true
    )
  );

create policy "milestone_reactions_delete_own" on public.milestone_reactions
  for delete using (auth.uid() = user_id);

-- Task 2의 handle_new_user()에 프로필 기본 행 생성을 추가한다(트리거 자체는
-- 그대로 두고 함수 본문만 교체 — CREATE TRIGGER를 다시 할 필요는 없다).
-- 닉네임 기본값은 이메일의 "@" 앞부분.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.notification_settings (user_id, reminder_enabled, reminder_time)
  values (new.id, true, '09:00')
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, display_name, show_on_leaderboard)
  values (new.id, split_part(new.email, '@', 1), false)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
