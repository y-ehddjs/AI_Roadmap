# API 명세서

이 문서는 목표 로드맵 앱이 실제로 호출하는 엔드포인트를 현재 코드 기준으로 정리한
것이다. 두 종류로 나뉜다:

1. **Supabase REST (PostgREST)** — 테이블마다 자동으로 열리는 `{SUPABASE_URL}/rest/v1/<테이블명>`.
   대부분의 화면이 여기에 해당하고, `frontend/lib/*.ts`가 이 요청들을 감싸고 있다.
2. **FastAPI 백엔드** — API 키를 브라우저로 못 내보내는 세 지점(로드맵 생성, 코칭
   지연 감지, 리마인더 발송)만 `backend/`가 직접 구현한다. 기준 URL은
   `{BACKEND_URL}`.

## 공통 사항

- 인증 화면과 공개 로드맵 보기(`/r/[id]`)의 비로그인 접근을 빼면, 모든
  `/rest/v1/*` 요청에는 `Authorization: Bearer <사용자 세션 JWT>` +
  `apikey: <anon key>` 헤더가 실려야 한다. 실제 접근 제어는 이 헤더가 아니라
  각 테이블의 RLS(Row Level Security) 정책이 한다.
- PostgREST는 "없음"에 404를 쓰지 않는다: 조회(GET)는 매칭되는 행이 0개여도
  200 + 빈 배열이다. `.single()`을 붙인 조회만 행이 정확히 1개가 아니면 406
  (에러 코드 `PGRST116`)을 낸다. `.maybeSingle()`은 0개일 때 이 406을 삼키고
  200 + `data: null`을 대신 돌려준다.
- 쓰기(POST/PATCH/DELETE)는 `.select()`를 안 붙이면 `Prefer: return=minimal`이라
  성공해도 본문 없이 201(생성)/204(수정·삭제)만 온다. `.select().single()`을
  붙이면 `Prefer: return=representation`으로 바뀌어 갱신된 행이 본문에 실린다.
- RLS 정책을 만족 못 하는 행(내 것이 아닌 로드맵 수정 시도 등)은 403이 아니라
  애초에 "안 보이는" 셈이라 0 rows affected로 조용히 끝난다.
- 세션 토큰이 없거나 만료되면 401.

---

## 1. 인증 (`lib/auth.ts` · `lib/useAuth.ts`)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `/auth/v1/signup` | 회원가입 (`supabase.auth.signUp`) | `{ email, password }` | `{ user, session }` — 성공 시 트리거가 `notification_settings`/`profiles` 기본 행 자동 생성 | 200, 422(이미 가입된 이메일), 400(형식 오류) |
| POST | `/auth/v1/token?grant_type=password` | 로그인 (`signInWithPassword`) | `{ email, password }` | `{ access_token, refresh_token, user }` | 200, 400(이메일/비밀번호 불일치) |
| POST | `/auth/v1/logout` | 로그아웃 (`signOut`) | 없음 | 없음 | 204, 401 |
| GET | `/auth/v1/user` | 세션 확인 (`getUser`) | 없음 | `{ user }` (비로그인 시 `user: null`) | 200 |

## 2. 로드맵 (`lib/roadmaps.ts`, `roadmaps` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `/rest/v1/roadmaps` | `createRoadmap` — 수동 입력 생성 | `{ user_id, title, description, source: 'ai'\|'manual', status: 'active' }` | `Roadmap` 단일 행 | 201 |
| GET | `/rest/v1/roadmaps?select=*&user_id=eq.{userId}&order=created_at.desc` | `listRoadmaps` — 홈 리스트 | 없음 | `Roadmap[]` | 200 |
| GET | `/rest/v1/roadmaps?select=*&id=eq.{roadmapId}` | `getRoadmap` — 상세 진입 | 없음 | `Roadmap` 단일 행 | 200, 406(없거나 남의 것) |
| PATCH | `/rest/v1/roadmaps?id=eq.{roadmapId}` | `completeRoadmapIfAllDone` — 마일스톤 전부 완료 시 자동 완료 처리 | `{ status: 'completed' }` | 없음 | 204 |
| PATCH | `/rest/v1/roadmaps?id=eq.{roadmapId}` | `setRoadmapPublic` — 공개/비공개 전환 | `{ is_public: boolean }` | 없음 | 204 |
| DELETE | `/rest/v1/roadmaps?id=eq.{roadmapId}` | `deleteRoadmap` (`on delete cascade`로 마일스톤/하트/댓글도 함께 삭제) | 없음 | 없음 | 204 |
| GET | `/rest/v1/roadmaps?select=id,title,user_id&id=eq.{roadmapId}` | `getPublicRoadmap` — 공개 로드맵 보기(`/r/[id]`, 비로그인 가능). `description` 등 개인 정보 컬럼은 select하지 않음. `user_id`는 소유자 표시/팔로우 버튼에 필요해서 포함 | 없음 | `{ id, title, user_id }` | 200, 406(비공개거나 없는 id) |
| PATCH | `/rest/v1/roadmaps?id=eq.{roadmapId}` | `reactivateRoadmap` — 완료 처리됐던 로드맵에 마일스톤을 새로 추가하면 다시 진행 중으로 되돌림 | `{ status: 'active' }` | 없음 | 204 |

## 3. 마일스톤 (`lib/milestones.ts`, `milestones` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `/rest/v1/milestones` | `createMilestone` | `{ roadmap_id, title, description, due_date, order_index, status: 'pending' }` | `Milestone` 단일 행 | 201 |
| GET | `/rest/v1/milestones?select=*&roadmap_id=eq.{roadmapId}&order=due_date.asc&order=order_index.asc` | `listMilestones` — 로드맵 상세 타임라인 | 없음 | `Milestone[]` | 200 |
| GET | `/rest/v1/milestones?select=*&id=eq.{id}` | `getMilestone` — 마일스톤 상세 진입 | 없음 | `Milestone` 단일 행 | 200, 406(없거나 남의 것 — 화면은 "찾을 수 없거나 접근 권한이 없는 마일스톤이에요" 문구로 처리) |
| PATCH | `/rest/v1/milestones?id=eq.{milestoneId}` | `updateMilestone` — 체크/메모/마감일 수정 | `Partial<{ title, description, due_date, status, completed_at }>` | `Milestone` 단일 행 | 200 |
| DELETE | `/rest/v1/milestones?id=eq.{milestoneId}` | `deleteMilestone` | 없음 | 없음 | 204 |
| GET | `/rest/v1/milestones?select=id,title,due_date,order_index,status&roadmap_id=eq.{roadmapId}&order=due_date.asc&order=order_index.asc` | `listPublicMilestones` — 공개 로드맵 보기 | 없음 | `Pick<Milestone,'id'\|'title'\|'due_date'\|'order_index'\|'status'>[]` | 200 |

## 4. 체크인 · 스트릭 (`lib/checkins.ts` · `lib/streak.ts`, `habit_checkins` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `/rest/v1/habit_checkins?on_conflict=user_id,checkin_date` (`Prefer: resolution=ignore-duplicates`) | `recordCheckin` 1단계 — 오늘 날짜로 upsert | `{ user_id, checkin_date, streak_count: 0 }` | 없음 | 201 |
| GET | `/rest/v1/habit_checkins?select=checkin_date&user_id=eq.{userId}` | `recordCheckin`/`getTodayStreak` — 체크인 날짜 조회 후 `computeStreak`로 연속일 계산 | 없음 | `{ checkin_date }[]` | 200 |
| PATCH | `/rest/v1/habit_checkins?user_id=eq.{userId}&checkin_date=eq.{today}` | `recordCheckin` 2단계 — 계산한 연속일 반영 | `{ streak_count }` | 없음 | 204 |

## 5. 알림 설정 (`notification_settings` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/notification_settings?select=reminder_enabled,reminder_time&user_id=eq.{userId}` | 설정 페이지 진입 시 현재 값 로드 | 없음 | `{ reminder_enabled, reminder_time }` | 200, 406 |
| POST | `/rest/v1/notification_settings?on_conflict=user_id` (`Prefer: resolution=merge-duplicates,return=minimal`) | 알림 on/off, 알림 시간 변경, 구독 갱신 — 모두 부분 upsert | `{ user_id, reminder_enabled?, reminder_time?, push_subscription? }` | 없음 | 201 |

## 6. 프로필 (`lib/profiles.ts`, `profiles` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/profiles?select=*&user_id=eq.{userId}` | `getProfile` | 없음 | `Profile` 단일 행 | 200, 406 |
| PATCH | `/rest/v1/profiles?user_id=eq.{userId}` | `updateProfile` — 닉네임, "리더보드에 표시" 토글 | `Partial<{ display_name, show_on_leaderboard }>` | `Profile` 단일 행 | 200 |

## 7. AI 코칭 메시지 (`lib/coaching.ts`, `coaching_messages` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/coaching_messages?select=*,roadmaps(title)&user_id=eq.{userId}&order=created_at.desc` | `listMessages` — 메시지함 목록 (`roadmap_id`가 FK라 `roadmaps(title)`로 한 번에 조인) | 없음 | `CoachingMessageWithRoadmap[]` | 200 |
| PATCH | `/rest/v1/coaching_messages?id=eq.{messageId}` | `markRead` | `{ read_at: <ISO 시각> }` | 없음 | 204 |

메시지 생성(INSERT)은 화면이 직접 하지 않는다 — FastAPI `check-coaching` 스케줄
작업이 서버 사이드(service role)로만 써넣는다.

## 8. 하트 리액션 (`lib/reactions.ts`, `roadmap_reactions` 테이블)

로드맵 전체에 대한 반응이며(과거의 마일스톤별 "하이파이브"를 대체), 유저·로드맵당
1개로 유니크 제약이 걸려 있다.

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/roadmap_reactions?select=id&roadmap_id=eq.{roadmapId}&user_id=eq.{userId}` | `hasReacted` (`.maybeSingle()`) | 없음 | `{ id } \| null` | 200 |
| HEAD | `/rest/v1/roadmap_reactions?select=id&roadmap_id=eq.{roadmapId}` (`Prefer: count=exact`) | `getReactionCount` (개수는 `Content-Range` 헤더) | 없음 | 없음 | 200 |
| POST | `/rest/v1/roadmap_reactions` | `toggleReaction` — 하트 추가 | `{ roadmap_id, user_id }` | 없음 | 201, 409(동시 클릭으로 유니크 제약 충돌) |
| DELETE | `/rest/v1/roadmap_reactions?roadmap_id=eq.{roadmapId}&user_id=eq.{userId}` | `toggleReaction` — 하트 취소 | 없음 | 없음 | 204 |

## 9. 댓글 (`lib/comments.ts`, `comments` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/comments?select=*&roadmap_id=eq.{roadmapId}&order=created_at.asc` | `listComments` | 없음 | `Comment[]` | 200 |
| POST | `/rest/v1/comments` (`Prefer: return=representation`) | `addComment` | `{ roadmap_id, user_id, body }` | `Comment` 단일 행 | 201 |
| DELETE | `/rest/v1/comments?id=eq.{commentId}` | `deleteComment` — 공개 로드맵 보기 화면에서 내가 쓴 댓글에만 "삭제" 버튼 노출 | 없음 | 없음 | 204 |

## 10. 팔로우 (`lib/follows.ts`, `follows` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/follows?select=id&follower_id=eq.{followerId}&followee_id=eq.{followeeId}` | `isFollowing` (`.maybeSingle()`) | 없음 | `{ id } \| null` | 200 |
| POST | `/rest/v1/follows` | `follow` | `{ follower_id, followee_id }` | 없음 | 201, 409(이미 팔로우 중), 400(자기 자신 — `check` 제약) |
| DELETE | `/rest/v1/follows?follower_id=eq.{followerId}&followee_id=eq.{followeeId}` | `unfollow` | 없음 | 없음 | 204 |
| GET | `/rest/v1/follows?select=followee_id&follower_id=eq.{followerId}` | `listFollowedUserIds` — 리더보드 대상자 계산용 | 없음 | `{ followee_id }[]` | 200 |

RLS: `follows`는 팔로우한 사람(`follower`) 본인만 자기 팔로우 목록을 읽을 수
있다 — 다른 사람이 나를 팔로우하는지는 조회할 수 없다(YAGNI).

## 11. 리더보드 (`lib/leaderboard.ts` — `follows`/`profiles`/`roadmaps`/`roadmap_reactions`/`milestones` 복합 조회)

전체 공개 순위가 아니라 "나 + 내가 팔로우한 사람" 안에서만 경쟁하며, 순위는
"받은 하트 총합 + 평균 진행률(%)"을 단순 합산한 점수로 정렬한다. `getLeaderboard(client, viewerUserId)` 호출 시:

| 단계 | 메서드 | 경로 | 용도 | 응답 |
|---|---|---|---|---|
| 1 | GET | `/rest/v1/follows?select=followee_id&follower_id=eq.{viewerUserId}` | 팔로우한 사람 id 목록 | `{ followee_id }[]` |
| 2 | GET | `/rest/v1/profiles?select=user_id,display_name&user_id=in.({viewerUserId, ...followedIds})&show_on_leaderboard=eq.true` | 대상(나+팔로우한 사람) 중 리더보드 표시를 켠 사람만 | `{ user_id, display_name }[]` |
| 3a | GET | `/rest/v1/roadmaps?select=id&user_id=eq.{targetUserId}&is_public=eq.true` | (대상자별로 반복) 공개 로드맵 id 목록 | `{ id }[]` |
| 3b | HEAD | `/rest/v1/roadmap_reactions?select=id&roadmap_id=in.({roadmapIds})` (`count=exact`) | 받은 하트 총합 | (Content-Range) |
| 3c | GET | `/rest/v1/milestones?select=roadmap_id,status&roadmap_id=in.({roadmapIds})` | 로드맵별 진행률 계산 후 평균 | `{ roadmap_id, status }[]` |

`roadmaps`/`profiles`는 서로 직접 FK로 안 묶여 있어 PostgREST가 자동 조인을 못
해준다 — `user_id`를 키 삼아 여러 번 나눠 조회한 뒤 클라이언트에서 직접 합친다.

## 12. 커뮤니티 (`lib/community.ts` — `roadmaps`/`profiles`/`roadmap_reactions` 복합 조회)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/profiles?select=user_id&display_name=ilike.*{검색어}*` | `listCommunityRoadmaps` — 닉네임 검색 시에만 먼저 호출, 매칭되는 사람이 없으면 바로 빈 배열 반환 | 없음 | `{ user_id }[]` | 200 |
| GET | `/rest/v1/roadmaps?select=id,title,user_id&is_public=eq.true` (검색어가 있으면 `&user_id=in.({위 목록})` 추가) | `listCommunityRoadmaps` — 공개 로드맵 목록 | 없음 | `{ id, title, user_id }[]` | 200 |
| GET | `/rest/v1/profiles?select=user_id,display_name&user_id=in.({로드맵 소유자 id 목록})` | 목록에 표시할 소유자 닉네임 조회 | 없음 | `{ user_id, display_name }[]` | 200 |
| GET | `/rest/v1/roadmap_reactions?select=roadmap_id&roadmap_id=in.({공개 로드맵 id 목록})` ("오늘 하트순" 정렬이면 `&created_at=gte.{오늘 자정 ISO}` 추가) | `countHeartsByRoadmap` — 모든 공개 로드맵의 하트 행을 한 번에 가져와 클라이언트에서 `roadmap_id`별로 센다 | 없음 | `{ roadmap_id }[]` | 200 |

(과거에는 로드맵마다 개별 HEAD 카운트 쿼리를 날렸다(N+1) — 로드맵 개수만큼
왕복이 늘어나는 구조였다. 리더보드의 하트 합산 로직과 같은 패턴으로,
`in()` 한 번에 가져와 세는 방식으로 단순화했다. 그 이전에는 로드맵 →
마일스톤 id 목록 → `milestone_reactions` 순으로 두 단계를 거쳤으나, 하트가
로드맵 단위로 바뀌면서 그 중간 단계는 이미 없어졌었다.)

## 13. FastAPI 백엔드 (AI/알림 전용 커스텀 엔드포인트, `backend/`)

이 세 엔드포인트만 Supabase PostgREST가 아니라 `backend/`의 FastAPI 앱이 직접
구현한다. 기준 URL은 `{BACKEND_URL}` — 로컬 개발은 `http://localhost:8000`.
`/generate-roadmap`만 프론트엔드가 브라우저에서 직접 호출하고(CORS 허용 있음),
나머지 둘은 APScheduler가 내부적으로 주기 호출하며 `/internal/*` 경로는 수동
테스트용이라 프론트엔드는 호출하지 않는다.

| 메서드 | 경로 | 트리거 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `{BACKEND_URL}/generate-roadmap` | 로드맵 생성 화면의 AI 모드(프론트엔드가 `fetch`로 직접 호출) | `{ user_id, title, description? }` | `{ roadmap_id }` | 200, 502(Gemini 호출/파싱 실패), 500(DB insert 실패 — 실패 시 방금 만든 로드맵도 롤백 삭제) |
| POST | `{BACKEND_URL}/internal/check-coaching` | 코칭 메시지 생성원 — 평소 APScheduler가 매일 09:00 실행, 이 경로는 수동 테스트용 | 없음 | `{ processed: <처리한 지연 마일스톤 수> }` | 200, 500 |
| POST | `{BACKEND_URL}/internal/send-reminders` | 마감일 임박/체크인 유도 Web Push 발송원 — 평소 APScheduler가 15분마다 실행, 이 경로는 수동 테스트용 | 없음 | `{ sent: <발송한 알림 수> }` | 200, 500 |
| GET | `{BACKEND_URL}/health` | 헬스체크 | 없음 | `{ status: "ok" }` | 200 |

두 스케줄 작업(`check-coaching`, `send-reminders`)은 화면이 직접 호출하지 않고
FastAPI 앱 안에 등록된 APScheduler(`CronTrigger(hour=9, minute=0)` /
`IntervalTrigger(minutes=15)`)가 프로세스 내부에서만 실행한다.
