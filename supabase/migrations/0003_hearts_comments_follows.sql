-- 마일스톤별 하이파이브를 로드맵 전체에 대한 하트로 바꾼다. milestone_reactions는
-- 더 이상 안 쓰므로 정책까지 통째로 지우고 로드맵 단위의 새 테이블로 대체한다.
drop table if exists public.milestone_reactions;

create table public.roadmap_reactions (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (roadmap_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.roadmap_reactions enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

-- 하트/댓글은 milestone_reactions 때와 같은 패턴: 공개 로드맵이면 누구나 읽고,
-- 주인은 비공개로 돌려도 자기 것은 계속 읽을 수 있다(OR로 합쳐짐).
create policy "roadmap_reactions_public_read" on public.roadmap_reactions
  for select using (
    exists (select 1 from public.roadmaps r where r.id = roadmap_reactions.roadmap_id and r.is_public = true)
  );

create policy "roadmap_reactions_owner_read" on public.roadmap_reactions
  for select using (
    exists (select 1 from public.roadmaps r where r.id = roadmap_reactions.roadmap_id and r.user_id = auth.uid())
  );

create policy "roadmap_reactions_insert_own" on public.roadmap_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.roadmaps r where r.id = roadmap_reactions.roadmap_id and r.is_public = true)
  );

create policy "roadmap_reactions_delete_own" on public.roadmap_reactions
  for delete using (auth.uid() = user_id);

create policy "comments_public_read" on public.comments
  for select using (
    exists (select 1 from public.roadmaps r where r.id = comments.roadmap_id and r.is_public = true)
  );

create policy "comments_owner_read" on public.comments
  for select using (
    exists (select 1 from public.roadmaps r where r.id = comments.roadmap_id and r.user_id = auth.uid())
  );

create policy "comments_insert_own" on public.comments
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.roadmaps r where r.id = comments.roadmap_id and r.is_public = true)
  );

create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = user_id);

-- 팔로우 목록은 본인(팔로우한 사람) 것만 읽을 수 있다 — "내가 누구를 팔로우하는지"는
-- 리더보드 계산에 필요하지만, 남의 팔로우 목록을 공개할 필요는 없다(YAGNI).
create policy "follows_owner_read" on public.follows
  for select using (auth.uid() = follower_id);

create policy "follows_insert_own" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "follows_delete_own" on public.follows
  for delete using (auth.uid() = follower_id);
