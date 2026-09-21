-- "지금 확인하기"를 눌렀을 때 마감을 놓친 마일스톤이 하나도 없으면 지금까지는
-- 조용히 아무 메시지도 안 남겼다. 이제 그 경우에도 진행 상황 기반 코칭
-- (trigger_type='status')을 보내므로, 기존에 'delay' 하나만 허용하던 체크
-- 제약을 완화해야 한다.
alter table public.coaching_messages drop constraint coaching_messages_trigger_type_check;
alter table public.coaching_messages add constraint coaching_messages_trigger_type_check
  check (trigger_type in ('delay', 'status'));
