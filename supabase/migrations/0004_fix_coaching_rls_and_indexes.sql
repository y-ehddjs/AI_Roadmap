-- coaching_messages_owner이 `for all`이라 아무 로그인 유저나 자기 user_id로
-- 가짜 "AI 코칭" 메시지를 직접 INSERT하거나 진짜 메시지를 DELETE할 수 있었다.
-- 클라이언트가 실제로 필요한 건 자기 메시지 조회 + 읽음 처리(read_at 갱신)뿐 —
-- 생성은 서비스 롤(check-coaching 스케줄 작업)만 해야 하고, 서비스 롤은 RLS를
-- 아예 우회하므로 이 변경으로 영향받지 않는다.
drop policy "coaching_messages_owner" on public.coaching_messages;

create policy "coaching_messages_owner_read" on public.coaching_messages
  for select using (auth.uid() = user_id);

create policy "coaching_messages_owner_update" on public.coaching_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 아래 컬럼들은 매 요청마다 eq()/in()으로 필터링되고(각 lib 함수) RLS 정책의
-- exists() 서브쿼리에서도 조인 키로 쓰이는데, 지금까지 기본 키(PK) 말고는
-- 인덱스가 하나도 없었다.
create index if not exists roadmaps_user_id_idx on public.roadmaps (user_id);
create index if not exists milestones_roadmap_id_idx on public.milestones (roadmap_id);
create index if not exists roadmap_reactions_roadmap_id_idx on public.roadmap_reactions (roadmap_id);
create index if not exists comments_roadmap_id_idx on public.comments (roadmap_id);
create index if not exists coaching_messages_user_id_idx on public.coaching_messages (user_id);
create index if not exists coaching_messages_roadmap_id_idx on public.coaching_messages (roadmap_id);
