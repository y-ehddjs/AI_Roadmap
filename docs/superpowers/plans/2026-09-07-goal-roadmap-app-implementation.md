# 목표 로드맵 앱 Implementation Plan (반응형 웹)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여러 목표(로드맵)를 세우고, 마일스톤을 타임라인으로 관리하며, AI가 로드맵을
제안하고 지연 시 자동으로 코칭 메시지를 보내는 반응형 웹 앱의 MVP를 만든다.

**Architecture:** Next.js(App Router) 클라이언트가 Supabase(Postgres + Auth)에 직접
CRUD 쿼리를 날린다. API 키를 클라이언트에 못 내보내는 세 지점(로드맵 생성, 코칭 지연
감지, 리마인더 발송)만 별도의 FastAPI(Python) 백엔드가 맡아 Gemini API와 Web Push를
서버 사이드에서 호출한다 — 5주차에 프론트엔드/백엔드를 각각 도커 컨테이너로 분리하는
과제 요구사항 때문에 (원래 계획이던 Supabase Edge Function 대신) 이 세 지점을 우리가
직접 띄우는 FastAPI 컨테이너로 옮긴 것이며, 그 외 화면은 전부 그대로 Supabase 직접
접근 구조를 유지한다(YAGNI). 화면은 Tailwind CSS의 반응형 브레이크포인트로
모바일/데스크톱 브라우저 모두를 지원한다.

**Tech Stack:** Next.js(React + TypeScript, App Router) + Tailwind CSS,
@supabase/supabase-js, FastAPI(Python) + `supabase-py`(service role) + Google Gemini
API + APScheduler(주기 작업) + `pywebpush`, Jest(next/jest preset, 프론트엔드 코드),
pytest(백엔드 코드).

**Spec:** `docs/superpowers/specs/2026-09-07-goal-roadmap-app-design.md`

## Global Constraints

- 플랫폼: 반응형 웹 (Next.js) — 별도 앱스토어 배포 없음, 브라우저로 접근
- 백엔드: 대부분의 CRUD는 Next.js 클라이언트가 Supabase(Postgres + Auth + Realtime)의
  REST(PostgREST)에 직접 접근 — 커스텀 서버 없음. AI/알림 관련 세 지점(로드맵 생성,
  코칭 지연 감지, 리마인더 발송)만 `backend/`의 FastAPI(Python) 앱이 맡고, Supabase에는
  service role 키로 접근해 RLS를 우회한다. 이 세 곳 외로 백엔드 범위를 넓히지 않는다
- 인증: 이메일/비밀번호만 (소셜 로그인 없음)
- 알림: Web Push API (서비스 워커 + VAPID 키, 발송은 FastAPI 백엔드가 `pywebpush`로)
- AI: Gemini API — 로드맵 생성 + 프로액티브 코칭, 둘 다 FastAPI 백엔드에서 호출.
  코칭 트리거는 마감일 경과(`delay`) 하나만 구현하며 "정체" 판정은 범위 밖(YAGNI)
- 마일스톤은 고정 마감일(달력형)이며, 한 사용자가 여러 로드맵을 동시에 진행 가능
- 습관 스트릭은 로드맵과 무관하게 계정 전체로 통합 집계
- 개인/포트폴리오 MVP 규모 — 핵심 로직(순수 함수, CRUD 계약)은 유닛 테스트로 검증하고
  화면 단위 동작은 수동 확인으로 충분(스펙의 테스트 방침을 따름)

---

## File Structure

```
next.config.js
tailwind.config.ts
jest.config.js
public/
  sw.js                              # Web Push 서비스 워커
app/
  layout.tsx                         # 루트 레이아웃 + globals.css import
  globals.css                        # Tailwind 지시문
  (auth)/
    login/page.tsx                   # 로그인
    signup/page.tsx                  # 회원가입
  (dashboard)/
    layout.tsx                       # 공통 네비게이션(홈/대시보드/코칭/설정)
    page.tsx                         # 홈 - 로드맵 리스트 + 스트릭
    dashboard/page.tsx               # 진행률 대시보드
    coaching/page.tsx                # AI 코칭 메시지함
    settings/page.tsx                # 설정
  roadmap/
    create/page.tsx                  # 로드맵 생성 (수동 입력 + AI 플로우)
    [id]/page.tsx                    # 로드맵 상세 (타임라인, 반응형)
  milestone/
    [id]/page.tsx                    # 마일스톤 상세
lib/
  config.ts                          # getSupabaseConfig (순수 함수)
  supabase.ts                        # Supabase 브라우저 클라이언트
  auth.ts                            # validateEmail/validatePassword
  useAuth.ts                         # useRequireAuth/useRedirectIfAuthed (라우트 가드)
  progress.ts                        # calculateProgress/milestoneStatus (순수 함수)
  roadmaps.ts                        # 로드맵 CRUD + completeRoadmapIfAllDone
  milestones.ts                      # 마일스톤 CRUD
  timeline.ts                        # computeNodePositions (순수 함수, % 좌표)
  streak.ts                          # computeStreak (순수 함수)
  checkins.ts                        # recordCheckin/getTodayStreak
  notifications.ts                   # subscribeToPush + urlBase64ToUint8Array
  dashboard.ts                       # summarizeDashboard (순수 함수)
  coaching.ts                        # listMessages/markRead
types/
  models.ts                          # 전체 테이블 타입
test-utils/
  fakeSupabaseClient.ts               # 테스트용 가짜 Supabase 클라이언트
__tests__/
  config.test.ts
  progress.test.ts
  roadmaps.test.ts
  milestones.test.ts
  timeline.test.ts
  streak.test.ts
  checkins.test.ts
  notifications.test.ts
  dashboard.test.ts
  coaching.test.ts
supabase/
  migrations/
    0001_init.sql                    # 전체 스키마 + RLS
backend/                              # FastAPI 백엔드 — AI/알림 3개 작업 전용, 5주차 도커 컨테이너
  requirements.txt
  Dockerfile
  .dockerignore
  app/
    __init__.py
    main.py                          # FastAPI 앱 + CORS + APScheduler 등록 + /internal/* 수동 트리거
    generate_roadmap_parse.py         # parseRoadmapResponse (순수 함수)
    generate_roadmap.py               # POST /generate-roadmap 라우터
    check_coaching_select.py          # selectOverdueMilestones/buildCoachingPrompt (순수 함수)
    check_coaching.py                 # run_check_coaching (매일 09:00 스케줄)
    send_reminders_schedule.py        # isReminderDue/selectMilestonesDueTomorrow (순수 함수)
    send_reminders.py                 # run_send_reminders (15분마다 스케줄)
  tests/
    __init__.py
    test_generate_roadmap.py
    test_check_coaching.py
    test_send_reminders.py
```

---

## API 엔드포인트 명세

화면(스펙 "화면 구성" 1~11번)이 실제로 부르는 엔드포인트는 두 종류다: (1) Supabase가
테이블마다 자동으로 열어주는 REST — PostgREST, `{SUPABASE_URL}/rest/v1/<테이블명>` —
가 대부분이고, (2) AI 호출처럼 API 키를 서버 밖으로 못 내보내는 세 지점(로드맵 생성,
코칭 지연 감지, 리마인더 발송)만 직접 짠 FastAPI 백엔드, `{BACKEND_URL}/<경로>`
(`backend/`, Task 16/18/19)다. 아래 표는 각 화면이 어떤 엔드포인트를 어떤 요청/응답
모양으로 호출하는지 lib 함수(위 태스크들에서 이미 구현한) 기준으로 정리한 것이다.

**공통 사항**

- 인증 화면(1번)과 9번(공개 로드맵 보기)의 비로그인 접근을 빼면, 모든 `/rest/v1/*`
  요청에는 `Authorization: Bearer <사용자 세션 JWT>` + `apikey: <anon key>` 헤더가
  실려야 한다. 실제 접근 제어는 이 헤더가 아니라 RLS 정책(Task 2/21)이 한다.
- PostgREST는 REST 관용구와 달리 "없음"에 404를 쓰지 않는다: 조회(GET)는 매칭되는
  행이 0개여도 200 + 빈 배열이다. 다만 `.single()`을 붙인 조회는 행이 정확히 1개가
  아니면 406(에러 코드 `PGRST116`)을 낸다 — `.maybeSingle()`은 0개일 때 이 406을
  삼키고 200 + `data: null`로 대신 돌려준다(9번 화면의 `getPublicRoadmap`이 비공개
  로드맵에 대해 에러를 던지는 것도 이 406 때문이다).
- 쓰기(POST/PATCH/DELETE)는 `.select()`를 안 붙이면 기본 `Prefer: return=minimal`이라
  성공해도 본문 없이 201(생성)/204(수정·삭제)만 온다. `.select().single()`을 붙이면
  `Prefer: return=representation`으로 바뀌어 201/200과 함께 갱신된 행이 본문에 실린다.
- RLS 정책을 만족 못 하는 행(내 것이 아닌 로드맵을 수정하려는 시도 등)은 403을
  내는 게 아니라 애초에 "안 보이는" 셈이라 0 rows affected로 조용히 끝난다(에러
  없이 204만 오고 실제로는 아무것도 안 바뀜). 이 앱의 모든 쓰기는 `auth.uid()`
  기준으로 자기 행만 걸도록 짜여 있어 실무에서 이 경로를 탈 일은 없다.
- 세션 토큰이 없거나 만료되면 401.

### 1. 인증 (화면 1: 온보딩/로그인, `lib/auth.ts` · `lib/useAuth.ts`)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `/auth/v1/signup` | 회원가입 (`supabase.auth.signUp`) | `{ email, password }` | `{ user, session }` — 성공 시 `handle_new_user` 트리거가 `notification_settings`/`profiles` 기본 행을 자동 생성 | 200, 422(이미 가입된 이메일), 400(형식 오류) |
| POST | `/auth/v1/token?grant_type=password` | 로그인 (`signInWithPassword`) | `{ email, password }` | `{ access_token, refresh_token, user }` | 200, 400(이메일/비밀번호 불일치) |
| POST | `/auth/v1/logout` | 로그아웃 (`signOut`, 설정 화면) | 없음(Authorization 헤더로 세션 식별) | 없음 | 204, 401 |
| GET | `/auth/v1/user` | 세션 확인 (`getUser` — `useRequireAuth`/`useRedirectIfAuthed`가 마운트 시 호출), 그리고 설정 화면(8번)의 "계정" 카드가 이메일 표시를 위해 별도로 호출 | 없음 | `{ user }` (비로그인 시 `user: null`; `user.email`이 설정 화면에 표시하는 값) | 200 |

### 2. 로드맵 (화면 2/3/4/6, `lib/roadmaps.ts`, `roadmaps` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `/rest/v1/roadmaps` | `createRoadmap` — 로드맵 생성(화면 3, 수동 입력) | `{ user_id, title, description, source: 'ai'\|'manual', status: 'active' }` | `Roadmap` 단일 행 | 201 |
| GET | `/rest/v1/roadmaps?select=*&user_id=eq.{userId}&order=created_at.desc` | `listRoadmaps` — 홈 리스트(화면 2) | 없음 | `Roadmap[]` | 200 |
| GET | `/rest/v1/roadmaps?select=*&id=eq.{roadmapId}` | `getRoadmap` — 상세 진입(화면 4) | 없음 | `Roadmap` 단일 행 | 200, 406(없거나 남의 것) |
| PATCH | `/rest/v1/roadmaps?id=eq.{roadmapId}` | `completeRoadmapIfAllDone` — 마일스톤 전부 완료 시 자동 완료 처리(화면 5) | `{ status: 'completed' }` | 없음 | 204 |
| PATCH | `/rest/v1/roadmaps?id=eq.{roadmapId}` | `setRoadmapPublic` — 공개/비공개 전환(화면 4) | `{ is_public: boolean }` | 없음 | 204 |
| DELETE | `/rest/v1/roadmaps?id=eq.{roadmapId}` | `deleteRoadmap` — 로드맵 삭제(화면 4, `on delete cascade`로 마일스톤도 함께 삭제) | 없음 | 없음 | 204 |
| GET | `/rest/v1/roadmaps?select=id,title&id=eq.{roadmapId}` | `getPublicRoadmap` — 공개 로드맵 보기(화면 9, 비로그인 가능). 개인 정보 컬럼(`description`/`user_id` 등)은 애초에 select하지 않음 | 없음 | `{ id, title }` | 200, 406(비공개거나 없는 id → 화면에서 "찾을 수 없거나 비공개" 문구로 처리) |

### 3. 마일스톤 (화면 4/5/9, `lib/milestones.ts`, `milestones` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `/rest/v1/milestones` | `createMilestone` — 마일스톤 추가(화면 4) | `{ roadmap_id, title, description, due_date, order_index, status: 'pending' }` | `Milestone` 단일 행 | 201 |
| GET | `/rest/v1/milestones?select=*&roadmap_id=eq.{roadmapId}&order=due_date.asc&order=order_index.asc` | `listMilestones` — 로드맵 상세 타임라인(화면 4). 정렬은 `due_date` 우선, `order_index`는 동점 처리용 보조키 | 없음 | `Milestone[]` | 200 |
| GET | `/rest/v1/milestones?select=*&id=eq.{id}` | 마일스톤 상세 진입(화면 5) — 별도 lib 함수 없이 페이지 컴포넌트가 직접 조회 | 없음 | `Milestone` 단일 행 | 200, 406 |
| PATCH | `/rest/v1/milestones?id=eq.{milestoneId}` | `updateMilestone` — 체크/메모/마감일 수정(화면 5) | `Partial<{ title, description, due_date, status, completed_at }>` | `Milestone` 단일 행 | 200 |
| DELETE | `/rest/v1/milestones?id=eq.{milestoneId}` | `deleteMilestone` — 마일스톤 삭제(화면 4/5) | 없음 | 없음 | 204 |
| GET | `/rest/v1/milestones?select=id,title,due_date,order_index,status&roadmap_id=eq.{roadmapId}&order=due_date.asc&order=order_index.asc` | `listPublicMilestones` — 공개 로드맵 보기(화면 9). `description`/`roadmap_id`는 select하지 않음 | 없음 | `Pick<Milestone,'id'\|'title'\|'due_date'\|'order_index'\|'status'>[]` | 200 |

### 4. 체크인 · 스트릭 (화면 2, `lib/checkins.ts` · `lib/streak.ts`, `habit_checkins` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `/rest/v1/habit_checkins?on_conflict=user_id,checkin_date` (`Prefer: resolution=ignore-duplicates`) | `recordCheckin` 1단계 — 오늘 날짜로 upsert(이미 있으면 무시) | `{ user_id, checkin_date, streak_count: 0 }` | 없음 | 201 |
| GET | `/rest/v1/habit_checkins?select=checkin_date&user_id=eq.{userId}` | `recordCheckin`/`getTodayStreak` — 전체 체크인 날짜 조회 후 `computeStreak`로 연속일 계산(홈 화면 스트릭 표시) | 없음 | `{ checkin_date }[]` | 200 |
| PATCH | `/rest/v1/habit_checkins?user_id=eq.{userId}&checkin_date=eq.{today}` | `recordCheckin` 2단계 — 방금 계산한 연속일을 오늘 행에 반영 | `{ streak_count }` | 없음 | 204 |

### 5. 알림 설정 (화면 8, `notification_settings` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/notification_settings?select=reminder_enabled,reminder_time&user_id=eq.{userId}` | 설정 페이지 진입 시 현재 값 로드 — 별도 lib 함수 없이 페이지 컴포넌트가 직접 조회(항상 켜진 상태로 시작하지 않기 위함) | 없음 | `{ reminder_enabled, reminder_time }` | 200, 406 |
| POST | `/rest/v1/notification_settings?on_conflict=user_id` (`Prefer: resolution=merge-duplicates,return=minimal`) | 알림 on/off 토글(`push_subscription` 동봉), 알림 시간 변경, 서비스 워커의 구독 갱신 저장 — 모두 부분 upsert | `{ user_id, reminder_enabled? , reminder_time?, push_subscription? }` (필드는 호출부마다 부분적으로만 채움) | 없음 | 201 |

### 6. 프로필 (화면 8/10/11, `lib/profiles.ts`, `profiles` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/profiles?select=*&user_id=eq.{userId}` | `getProfile` — 설정 화면에 닉네임/리더보드 표시 여부 로드 | 없음 | `Profile` 단일 행 | 200, 406 |
| PATCH | `/rest/v1/profiles?user_id=eq.{userId}` | `updateProfile` — 닉네임 변경, "리더보드에 표시" 토글 | `Partial<{ display_name, show_on_leaderboard }>` | `Profile` 단일 행 | 200 |

### 7. AI 코칭 메시지 (화면 7, `lib/coaching.ts`, `coaching_messages` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/coaching_messages?select=*,roadmaps(title)&user_id=eq.{userId}&order=created_at.desc` | `listMessages` — 코칭 메시지함 목록(각 메시지가 어느 로드맵 건지 제목을 같이 보여줌). `roadmap_id`가 `roadmaps.id`를 직접 참조하는 FK라 PostgREST가 `roadmaps(title)`로 한 번에 묶어준다 | 없음 | `CoachingMessageWithRoadmap[]` (= `CoachingMessage`에서 중첩된 `roadmaps`를 떼어내고 `roadmap_title: string`으로 평탄화) | 200 |
| PATCH | `/rest/v1/coaching_messages?id=eq.{messageId}` | `markRead` — 메시지 클릭 시 읽음 처리 | `{ read_at: <ISO 시각> }` | 없음 | 204 |

메시지 생성(INSERT)은 클라이언트 화면에서 직접 하지 않는다 — 아래 11번 표의
FastAPI `check-coaching` 스케줄 작업이 서버 사이드(service role)로만 써넣는다.

### 8. 하이파이브 리액션 (화면 9, `lib/reactions.ts`, `milestone_reactions` 테이블)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/milestone_reactions?select=id&milestone_id=eq.{milestoneId}&user_id=eq.{userId}` | `hasReacted` — 내가 이미 눌렀는지(`.maybeSingle()`) | 없음 | `{ id } \| null` | 200 |
| HEAD | `/rest/v1/milestone_reactions?select=id&milestone_id=eq.{milestoneId}` (`Prefer: count=exact`) | `getReactionCount` — 마일스톤별 하이파이브 개수(본문 없이 `Content-Range` 헤더로만 개수 전달) | 없음 | 없음(개수는 `Content-Range` 헤더) | 200 |
| POST | `/rest/v1/milestone_reactions` | `toggleReaction` — 안 눌렀던 상태에서 누름 | `{ milestone_id, user_id }` | 없음 | 201, 409(동시 클릭으로 유니크 제약 충돌 시) |
| DELETE | `/rest/v1/milestone_reactions?milestone_id=eq.{milestoneId}&user_id=eq.{userId}` | `toggleReaction` — 이미 눌렀던 상태에서 취소 | 없음 | 없음 | 204 |

### 9. 리더보드 조회 (화면 10, `lib/leaderboard.ts` — `profiles`/`habit_checkins` 복합 조회)

`roadmaps`와 마찬가지로 `profiles`도 `auth.users`만 참조할 뿐 서로 직접 FK로 묶여
있지 않아 PostgREST가 자동으로 조인해주지 못한다 — 두 번 나눠 조회한 뒤
`user_id`를 키 삼아 클라이언트에서 직접 합친다.

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/profiles?select=user_id,display_name&show_on_leaderboard=eq.true` | `getLeaderboard` 1단계 — 표시하기로 한 사용자 목록 | 없음 | `{ user_id, display_name }[]` | 200 |
| GET | `/rest/v1/habit_checkins?select=checkin_date&user_id=eq.{userId}` | `getLeaderboard` 2단계 — 위 각 사용자마다 반복 호출해 `computeStreak`로 연속일 계산 | 없음 | `{ checkin_date }[]` | 200 |

### 10. 커뮤니티 조회 (화면 11, `lib/community.ts` — `roadmaps`/`profiles`/`milestones`/`milestone_reactions` 복합 조회)

| 메서드 | 경로 | 용도 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/rest/v1/profiles?select=user_id&display_name=ilike.*{검색어}*` | `listCommunityRoadmaps` — 닉네임 검색 시에만 먼저 호출, 매칭되는 사람이 없으면 바로 빈 배열 반환(뒤 단계 호출 안 함) | 없음 | `{ user_id }[]` | 200 |
| GET | `/rest/v1/roadmaps?select=id,title,user_id&is_public=eq.true` (검색어가 있으면 `&user_id=in.({위에서 찾은 user_id 목록})` 추가) | `listCommunityRoadmaps` — 공개 로드맵 목록 | 없음 | `{ id, title, user_id }[]` | 200 |
| GET | `/rest/v1/profiles?select=user_id,display_name&user_id=in.({로드맵 소유자 id 목록})` | `listCommunityRoadmaps` — 목록에 표시할 소유자 닉네임 조회 | 없음 | `{ user_id, display_name }[]` | 200 |
| GET | `/rest/v1/milestones?select=id&roadmap_id=eq.{roadmapId}` | `countHighFivesForRoadmap` 1단계 — 로드맵당 마일스톤 id 목록(없으면 하이파이브 조회 없이 바로 0) | 없음 | `{ id }[]` | 200 |
| HEAD | `/rest/v1/milestone_reactions?select=id&milestone_id=in.({위 마일스톤 id 목록})` (`Prefer: count=exact`; "오늘 하이파이브순" 정렬이면 `&created_at=gte.{오늘 자정 ISO}` 추가) | `countHighFivesForRoadmap` 2단계 — 정렬 기준(오늘/누적)에 따른 하이파이브 개수 | 없음 | 없음(개수는 `Content-Range` 헤더) | 200 |

### 11. FastAPI 백엔드 (AI/알림 전용 커스텀 엔드포인트, `backend/`)

이 세 엔드포인트만 Supabase PostgREST가 아니라 `backend/`의 FastAPI 앱이 직접
구현한다(Task 16/18/19). 기준 URL은 `{BACKEND_URL}` — 로컬 개발은
`http://localhost:8000`, 배포 후에는 도커 컨테이너의 주소. `/generate-roadmap`만
프론트엔드가 브라우저에서 직접 호출하고(그래서 FastAPI 쪽에 CORS 허용이 있다),
나머지 둘은 APScheduler가 프로세스 내부에서 주기적으로 호출하며 `/internal/*`
경로는 스케줄을 기다리지 않고 수동으로 테스트하기 위한 것이라 프론트엔드는
호출하지 않는다.

| 메서드 | 경로 | 화면/트리거 | 요청 | 응답 | 상태 코드 |
|---|---|---|---|---|---|
| POST | `{BACKEND_URL}/generate-roadmap` | 화면 3 — AI 로드맵 생성 플로우(프론트엔드가 `fetch`로 직접 호출) | `{ user_id, title, description? }` | `{ roadmap_id }` | 200, 502(Gemini 호출 실패 또는 응답 파싱 실패), 500(DB insert 실패 — 마일스톤 insert 실패 시 방금 만든 로드맵도 롤백 삭제한 뒤 응답) |
| POST | `{BACKEND_URL}/internal/check-coaching` | 화면 7 메시지의 생성원 — 평소엔 APScheduler가 매일 09:00에 내부적으로 실행, 이 경로는 수동 테스트용 | 없음 | `{ processed: <처리한 지연 마일스톤 수> }` | 200, 500(마일스톤 조회 실패) |
| POST | `{BACKEND_URL}/internal/send-reminders` | 마감일 임박/체크인 유도 Web Push 발송원 — 평소엔 APScheduler가 15분마다 내부적으로 실행, 이 경로는 수동 테스트용 | 없음 | `{ sent: <발송한 알림 수> }` | 200, 500(설정 조회 실패) |

두 스케줄 작업은 화면이 직접 호출하는 게 아니라 FastAPI 앱 안에 등록된
APScheduler(`CronTrigger(hour=9, minute=0)` / `IntervalTrigger(minutes=15)`)가
프로세스 내부에서만 실행하며, 응답을 보는 사람도 없다 — 표에 넣은 이유는 이
작업들이 화면 7의 코칭 메시지와 Web Push 알림의 실제 생성원이기 때문이다.

---

### Task 1: Next.js 프로젝트 셋업 + Tailwind + Supabase 클라이언트 설정

**Files:**
- Create: `lib/config.ts`
- Create: `lib/supabase.ts`
- Create: `jest.config.js`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Test: `__tests__/config.test.ts`

**Interfaces:**
- Produces: `getSupabaseConfig(env: Record<string, string | undefined>): { url: string; anonKey: string }`,
  `supabase: SupabaseClient`

- [ ] **Step 1: Next.js 프로젝트를 생성하고 의존성을 설치한다**

```bash
npx create-next-app@latest . --typescript --tailwind --app --import-alias "@/*"
npm install @supabase/supabase-js
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Jest 설정 파일을 작성한다**

```js
// jest.config.js
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  testEnvironment: 'jsdom',
};

module.exports = createJestConfig(customJestConfig);
```

`package.json`의 `scripts`에 추가:

```json
"test": "jest"
```

(`backend/`는 별도의 Python 프로젝트라 이 `package.json`과 무관하게 `cd backend && python
-m pytest`로 따로 테스트한다 — Task 16 참고.)

- [ ] **Step 3: 실패하는 테스트를 작성한다**

```ts
// __tests__/config.test.ts
import { getSupabaseConfig } from '../lib/config';

test('returns url and anonKey when both are present', () => {
  const result = getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' });
  expect(result).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon-key' });
});

test('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
  expect(() => getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' })).toThrow('NEXT_PUBLIC_SUPABASE_URL');
});

test('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
  expect(() => getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
});
```

- [ ] **Step 4: 테스트 실행 → 실패 확인**

Run: `npx jest config.test.ts`
Expected: FAIL with "Cannot find module '../lib/config'"

- [ ] **Step 5: 구현한다**

```ts
// lib/config.ts
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (typeof anonKey !== 'string' || anonKey.length === 0) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}
```

```ts
// lib/supabase.ts
'use client';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

const { url, anonKey } = getSupabaseConfig(process.env as Record<string, string | undefined>);

export const supabase = createClient(url, anonKey);
```

```tsx
// app/layout.tsx
import './globals.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `npx jest config.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: `.env.local`에 실제 Supabase 프로젝트 값을 넣고 앱이 뜨는지 수동 확인한다**

Run: `npm run dev` → `http://localhost:3000` 접속 시 에러 없이 렌더링되는지 확인

- [ ] **Step 8: 커밋**

```bash
git add lib/config.ts lib/supabase.ts jest.config.js app/layout.tsx app/globals.css __tests__/config.test.ts package.json
git commit -m "chore: bootstrap Next.js project with Supabase client"
```

---

### Task 2: DB 스키마 마이그레이션 + 공통 타입 정의

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `types/models.ts`

**Interfaces:**
- Produces: 테이블 `roadmaps`, `milestones`, `habit_checkins`, `coaching_messages`,
  `notification_settings` (RLS 적용). TS 타입 `Roadmap`, `Milestone`, `HabitCheckin`,
  `CoachingMessage`, `NotificationSettings`, `PushSubscriptionData`, `RoadmapSource`,
  `RoadmapStatus`, `MilestoneStatus`.

- [ ] **Step 1: 마이그레이션 SQL을 작성한다**

```sql
-- supabase/migrations/0001_init.sql
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
```

- [ ] **Step 2: 로컬 Supabase에 마이그레이션을 적용한다**

Run: `supabase start && supabase db reset`
Expected: 마이그레이션이 에러 없이 적용됨

- [ ] **Step 3: 테이블이 실제로 생성됐는지 확인한다**

Run: `psql "$DATABASE_URL" -c "select table_name from information_schema.tables where table_schema = 'public' order by table_name;"`
Expected: `coaching_messages`, `habit_checkins`, `milestones`, `notification_settings`, `roadmaps` 5개 행 출력

- [ ] **Step 4: 스키마와 1:1로 대응하는 TS 타입을 작성한다**

```ts
// types/models.ts
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
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0001_init.sql types/models.ts
git commit -m "feat: add database schema with RLS and matching TS types"
```

---

### Task 3: 이메일/비밀번호 인증 + 라우트 가드

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/useAuth.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Test: `__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `supabase` from `lib/supabase.ts` (Task 1)
- Produces: `validateEmail(email: string): boolean`, `validatePassword(password: string): boolean`,
  `useRequireAuth(): string | null` (로그인 안 됐으면 `/login`으로 보내고, 됐으면
  `userId`를 반환 — Task 7/8/9/10/14/15/20이 이걸 가져다 쓴다),
  `useRedirectIfAuthed(): void` (이미 로그인돼 있으면 `/`로 보냄)

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/auth.test.ts
import { validateEmail, validatePassword } from '../lib/auth';

test('accepts a well-formed email', () => {
  expect(validateEmail('user@example.com')).toBe(true);
});

test('rejects an email without an @', () => {
  expect(validateEmail('userexample.com')).toBe(false);
});

test('accepts an 8-character password', () => {
  expect(validatePassword('abcd1234')).toBe(true);
});

test('rejects a password shorter than 8 characters', () => {
  expect(validatePassword('abc123')).toBe(false);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest auth.test.ts`
Expected: FAIL with "Cannot find module '../lib/auth'"

- [ ] **Step 3: 구현한다**

```ts
// lib/auth.ts
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): boolean {
  return password.length >= 8;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 라우트 가드 훅을 구현한다** (A: 비로그인 접근 차단, F: 이미 로그인된
사용자가 로그인/가입 페이지에 다시 들어오는 것 방지 — 둘 다 이 파일 하나에 둔다)

```ts
// lib/useAuth.ts
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

export function useRequireAuth(): string | null {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        router.replace('/login');
        return;
      }
      setUserId(data.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return userId;
}

export function useRedirectIfAuthed(): void {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/');
    });
  }, [router]);
}
```

- [ ] **Step 6: 로그인/회원가입 페이지를 만든다** (이미 로그인된 사용자는
`useRedirectIfAuthed`가 홈으로 돌려보낸다)

```tsx
// app/(auth)/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { validateEmail, validatePassword } from '../../../lib/auth';
import { useRedirectIfAuthed } from '../../../lib/useAuth';

export default function LoginPage() {
  useRedirectIfAuthed();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!validateEmail(email) || !validatePassword(password)) {
      setError('이메일 또는 비밀번호 형식을 확인해주세요');
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-bold">로그인</h1>
      <input className="rounded-lg border p-3" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        className="rounded-lg border p-3"
        placeholder="비밀번호"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleLogin}>
        로그인
      </button>
      <button className="text-sm text-gray-500 underline" onClick={() => router.push('/signup')}>
        회원가입
      </button>
    </div>
  );
}
```

```tsx
// app/(auth)/signup/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { validateEmail, validatePassword } from '../../../lib/auth';
import { useRedirectIfAuthed } from '../../../lib/useAuth';

export default function SignupPage() {
  useRedirectIfAuthed();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSignup() {
    if (!validateEmail(email) || !validatePassword(password)) {
      setError('이메일 또는 비밀번호 형식을 확인해주세요 (비밀번호 8자 이상)');
      return;
    }
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    router.replace('/');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-bold">회원가입</h1>
      <input className="rounded-lg border p-3" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        className="rounded-lg border p-3"
        placeholder="비밀번호 (8자 이상)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleSignup}>
        가입하기
      </button>
    </div>
  );
}
```

- [ ] **Step 7: 수동 확인**

Run: `npm run dev` → 회원가입 후 Supabase Studio의 `auth.users` 테이블에 행이 생기는지
(그리고 Task 2에서 만든 트리거 덕분에 `notification_settings`에도 기본값 행이 자동으로
생겼는지), 로그인 성공 시 홈(`/`)으로 이동을 시도하는지(홈 페이지 자체는 Task 7에서
만들어지므로 지금은 빈 화면이어도 됨), 로그인된 상태에서 주소창에 직접 `/login`을
입력해도 다시 `/`로 튕겨나오는지, 좁은 화면(모바일 폭)에서도 폼이 중앙 정렬로 잘
보이는지 확인. 비로그인 상태에서 보호된 페이지에 들어가면 `/login`으로 튕기는지는
Task 7에서 마저 확인한다

- [ ] **Step 8: 커밋**

```bash
git add lib/auth.ts lib/useAuth.ts app/\(auth\) __tests__/auth.test.ts
git commit -m "feat: add email/password auth pages and route guard hooks"
```

---

### Task 4: 진행률/지연 계산 로직 (`lib/progress.ts`)

**Files:**
- Create: `lib/progress.ts`
- Test: `__tests__/progress.test.ts`

**Interfaces:**
- Consumes: `Milestone`, `MilestoneStatus` from `types/models.ts` (Task 2)
- Produces: `milestoneStatus(milestone: Pick<Milestone,'status'|'due_date'>, now: Date): MilestoneStatus`,
  `calculateProgress(milestones: Pick<Milestone,'status'>[]): { percent: number; completedCount: number; totalCount: number }`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/progress.test.ts
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
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest progress.test.ts`
Expected: FAIL with "Cannot find module '../lib/progress'"

- [ ] **Step 3: 구현한다**

```ts
// lib/progress.ts
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest progress.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/progress.ts __tests__/progress.test.ts
git commit -m "feat: add progress and overdue calculation logic"
```

---

### Task 5: 로드맵 CRUD (`lib/roadmaps.ts`)

**Files:**
- Create: `lib/roadmaps.ts`
- Create: `test-utils/fakeSupabaseClient.ts`
- Test: `__tests__/roadmaps.test.ts`

**Interfaces:**
- Consumes: `Roadmap`, `RoadmapSource` from `types/models.ts` (Task 2)
- Produces: `createRoadmap(client, userId, input): Promise<Roadmap>`,
  `listRoadmaps(client, userId): Promise<Roadmap[]>`, `getRoadmap(client, roadmapId): Promise<Roadmap>`,
  `deleteRoadmap(client, roadmapId): Promise<void>` (DB의 `on delete cascade`
  덕분에 이 로드맵의 마일스톤도 함께 삭제된다),
  `makeFakeClient(results: { data: unknown; error: unknown }[])` (테스트 헬퍼, 이후 태스크에서 재사용)

- [ ] **Step 1: 테스트용 가짜 Supabase 클라이언트를 작성한다**

```ts
// test-utils/fakeSupabaseClient.ts
export type FakeResult = { data: unknown; error: unknown };

export function makeFakeClient(results: FakeResult[]) {
  let index = 0;
  const fromMock = jest.fn(() => {
    const result = results[index] ?? { data: null, error: null };
    index++;
    const builder: any = {
      insert: jest.fn(() => builder),
      update: jest.fn(() => builder),
      upsert: jest.fn(() => builder),
      delete: jest.fn(() => builder),
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      neq: jest.fn(() => builder),
      order: jest.fn(() => builder),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      single: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { from: fromMock } as any;
}
```

- [ ] **Step 2: 실패하는 테스트를 작성한다**

```ts
// __tests__/roadmaps.test.ts
import { createRoadmap, listRoadmaps, getRoadmap, deleteRoadmap } from '../lib/roadmaps';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('createRoadmap inserts and returns the created row', async () => {
  const fakeRow = { id: '1', user_id: 'u1', title: 'Test', description: null, source: 'manual', status: 'active', created_at: 'now' };
  const client = makeFakeClient([{ data: fakeRow, error: null }]);
  const result = await createRoadmap(client, 'u1', { title: 'Test', source: 'manual' });
  expect(result).toEqual(fakeRow);
  expect(client.from).toHaveBeenCalledWith('roadmaps');
});

test('createRoadmap throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('insert failed') }]);
  await expect(createRoadmap(client, 'u1', { title: 'Test', source: 'manual' })).rejects.toThrow('insert failed');
});

test('listRoadmaps returns rows from the query', async () => {
  const rows = [{ id: '1' }, { id: '2' }];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listRoadmaps(client, 'u1');
  expect(result).toEqual(rows);
});

test('listRoadmaps returns an empty array when data is null', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  const result = await listRoadmaps(client, 'u1');
  expect(result).toEqual([]);
});

test('getRoadmap returns a single row', async () => {
  const row = { id: '1', title: 'Test' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await getRoadmap(client, '1');
  expect(result).toEqual(row);
});

test('deleteRoadmap deletes by id', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await deleteRoadmap(client, '1');
  expect(client.from).toHaveBeenCalledWith('roadmaps');
});

test('deleteRoadmap throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('delete failed') }]);
  await expect(deleteRoadmap(client, '1')).rejects.toThrow('delete failed');
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `npx jest roadmaps.test.ts`
Expected: FAIL with "Cannot find module '../lib/roadmaps'"

- [ ] **Step 4: 구현한다**

```ts
// lib/roadmaps.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Roadmap, RoadmapSource } from '../types/models';

export async function createRoadmap(
  client: SupabaseClient,
  userId: string,
  input: { title: string; description?: string; source: RoadmapSource }
): Promise<Roadmap> {
  const { data, error } = await client
    .from('roadmaps')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      source: input.source,
      status: 'active',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Roadmap;
}

export async function listRoadmaps(client: SupabaseClient, userId: string): Promise<Roadmap[]> {
  const { data, error } = await client
    .from('roadmaps')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Roadmap[];
}

export async function getRoadmap(client: SupabaseClient, roadmapId: string): Promise<Roadmap> {
  const { data, error } = await client.from('roadmaps').select('*').eq('id', roadmapId).single();
  if (error) throw error;
  return data as Roadmap;
}

export async function deleteRoadmap(client: SupabaseClient, roadmapId: string): Promise<void> {
  const { error } = await client.from('roadmaps').delete().eq('id', roadmapId);
  if (error) throw error;
}
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `npx jest roadmaps.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: 커밋**

```bash
git add lib/roadmaps.ts test-utils/fakeSupabaseClient.ts __tests__/roadmaps.test.ts
git commit -m "feat: add roadmap CRUD (including delete) with fake-client test harness"
```

---

### Task 6: 마일스톤 CRUD (`lib/milestones.ts`)

**Files:**
- Create: `lib/milestones.ts`
- Test: `__tests__/milestones.test.ts`

**Interfaces:**
- Consumes: `Milestone` from `types/models.ts` (Task 2), `makeFakeClient` from `test-utils/fakeSupabaseClient.ts` (Task 5)
- Produces: `createMilestone(client, input): Promise<Milestone>`, `listMilestones(client, roadmapId): Promise<Milestone[]>`,
  `updateMilestone(client, milestoneId, patch): Promise<Milestone>`, `deleteMilestone(client, milestoneId): Promise<void>`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/milestones.test.ts
import { createMilestone, listMilestones, updateMilestone, deleteMilestone } from '../lib/milestones';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('createMilestone inserts and returns the created row', async () => {
  const row = { id: 'm1', roadmap_id: 'r1', title: '1km 완주', due_date: '2026-10-01', order_index: 0, status: 'pending' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await createMilestone(client, { roadmap_id: 'r1', title: '1km 완주', due_date: '2026-10-01', order_index: 0 });
  expect(result).toEqual(row);
});

test('listMilestones returns rows from the query (real ordering is verified by Supabase, not this fake client)', async () => {
  const rows = [{ id: 'm1', order_index: 0 }, { id: 'm2', order_index: 1 }];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listMilestones(client, 'r1');
  expect(result).toEqual(rows);
});

test('updateMilestone applies a partial patch and returns the updated row', async () => {
  const row = { id: 'm1', status: 'done', completed_at: '2026-09-07T00:00:00Z' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await updateMilestone(client, 'm1', { status: 'done', completed_at: '2026-09-07T00:00:00Z' });
  expect(result).toEqual(row);
});

test('updateMilestone throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('update failed') }]);
  await expect(updateMilestone(client, 'm1', { status: 'done' })).rejects.toThrow('update failed');
});

test('deleteMilestone deletes by id', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await deleteMilestone(client, 'm1');
  expect(client.from).toHaveBeenCalledWith('milestones');
});

test('deleteMilestone throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('delete failed') }]);
  await expect(deleteMilestone(client, 'm1')).rejects.toThrow('delete failed');
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest milestones.test.ts`
Expected: FAIL with "Cannot find module '../lib/milestones'"

- [ ] **Step 3: 구현한다**

```ts
// lib/milestones.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Milestone } from '../types/models';

export async function createMilestone(
  client: SupabaseClient,
  input: { roadmap_id: string; title: string; description?: string; due_date: string; order_index: number }
): Promise<Milestone> {
  const { data, error } = await client
    .from('milestones')
    .insert({
      roadmap_id: input.roadmap_id,
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date,
      order_index: input.order_index,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Milestone;
}

export async function listMilestones(client: SupabaseClient, roadmapId: string): Promise<Milestone[]> {
  // due_date는 실제 정렬 기준, order_index는 같은 날짜인 마일스톤들 사이의
  // 입력 순서를 지키기 위한 동점 처리용 보조 키다. 이렇게 하면 나중에 마일스톤을
  // 추가하거나(Task 9) 수동으로 여러 개를 한 번에 만들 때(Task 8) 입력 순서와
  // 무관하게 타임라인이 항상 날짜순으로 보인다 — order_index를 매번 다시
  // 계산해서 맞출 필요가 없다.
  const { data, error } = await client
    .from('milestones')
    .select('*')
    .eq('roadmap_id', roadmapId)
    .order('due_date', { ascending: true })
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Milestone[];
}

export async function updateMilestone(
  client: SupabaseClient,
  milestoneId: string,
  patch: Partial<Pick<Milestone, 'title' | 'description' | 'due_date' | 'status' | 'completed_at'>>
): Promise<Milestone> {
  const { data, error } = await client.from('milestones').update(patch).eq('id', milestoneId).select().single();
  if (error) throw error;
  return data as Milestone;
}

export async function deleteMilestone(client: SupabaseClient, milestoneId: string): Promise<void> {
  const { error } = await client.from('milestones').delete().eq('id', milestoneId);
  if (error) throw error;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest milestones.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/milestones.ts __tests__/milestones.test.ts
git commit -m "feat: add milestone CRUD (including delete)"
```

---

### Task 7: 홈 페이지 — 로드맵 리스트 (반응형 그리드)

**Files:**
- Create: `app/(dashboard)/page.tsx`
- Create: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `listRoadmaps` (Task 5), `listMilestones` (Task 6), `calculateProgress`, `milestoneStatus` (Task 4),
  `supabase` (Task 1), `useRequireAuth` (Task 3)

- [ ] **Step 1: 공통 네비게이션 레이아웃을 만든다**

```tsx
// app/(dashboard)/layout.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 border-b p-4 text-sm">
        <Link href="/">홈</Link>
        <Link href="/dashboard">대시보드</Link>
        <Link href="/coaching">AI 코칭</Link>
        <Link href="/settings">설정</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 홈 페이지를 구현한다**

```tsx
// app/(dashboard)/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRequireAuth } from '../../lib/useAuth';
import { listRoadmaps } from '../../lib/roadmaps';
import { listMilestones } from '../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../lib/progress';
import type { Roadmap, Milestone } from '../../types/models';

interface RoadmapRow {
  roadmap: Roadmap;
  progress: ReturnType<typeof calculateProgress>;
  nextMilestone: Milestone | null;
  nextIsOverdue: boolean;
}

export default function HomePage() {
  const userId = useRequireAuth();
  const [rows, setRows] = useState<RoadmapRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const roadmaps = await listRoadmaps(supabase, userId);
      const activeRoadmaps = roadmaps.filter((r) => r.status === 'active');
      const now = new Date();
      const withProgress = await Promise.all(
        activeRoadmaps.map(async (roadmap) => {
          const milestones = await listMilestones(supabase, roadmap.id);
          const progress = calculateProgress(milestones);
          const upcoming = milestones
            .filter((m) => m.status !== 'done')
            .sort((a, b) => a.order_index - b.order_index)[0];
          return {
            roadmap,
            progress,
            nextMilestone: upcoming ?? null,
            nextIsOverdue: upcoming ? milestoneStatus(upcoming, now) === 'overdue' : false,
          };
        })
      );
      setRows(withProgress);
    }
    load();
  }, [userId]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">내 목표</h1>
      <p className="mb-4 text-sm text-gray-500">{rows.length}개 진행 중 (완료된 로드맵은 대시보드에서 확인)</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.roadmap.id} className="rounded-2xl border p-4">
            <h2 className="font-semibold">{row.roadmap.title}</h2>
            <p className="text-sm text-gray-600">
              {row.progress.percent}% 완료 ({row.progress.completedCount}/{row.progress.totalCount})
            </p>
            {row.nextMilestone && (
              <p className={`text-sm ${row.nextIsOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                다음: {row.nextMilestone.title} · {row.nextMilestone.due_date}
              </p>
            )}
            <Link className="mt-2 inline-block text-orange-600 underline" href={`/roadmap/${row.roadmap.id}`}>
              상세 보기
            </Link>
          </div>
        ))}
      </div>
      <Link
        href="/roadmap/create"
        className="mt-6 inline-block rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white"
      >
        + 새 로드맵 만들기
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: 수동 확인**

Run: `npm run dev` → 로그인 후 홈 페이지에서 로드맵들이 진행률과 함께 카드로 보이는지,
브라우저 폭을 줄였을 때(모바일 폭) 1열, 늘렸을 때(`sm` 이상) 2열로 바뀌는지 확인.
Supabase Studio에서 로드맵 하나의 `status`를 수동으로 `completed`로 바꾸고 새로고침하면
그 로드맵이 홈 목록에서 사라지는지도 확인(자동 전환 로직은 Task 10에서 붙인다).
로그아웃한 뒤 주소창에 직접 `/`를 입력해서 들어가면 `/login`으로 바로 리다이렉트되는지도 확인

- [ ] **Step 4: 커밋**

```bash
git add app/\(dashboard\)/page.tsx app/\(dashboard\)/layout.tsx
git commit -m "feat: add home page with responsive roadmap grid"
```

---

### Task 8: 로드맵 생성 페이지 — 수동 입력 폼

**Files:**
- Create: `app/roadmap/create/page.tsx`

**Interfaces:**
- Consumes: `createRoadmap` (Task 5), `createMilestone` (Task 6), `supabase` (Task 1), `useRequireAuth` (Task 3)

- [ ] **Step 1: 수동 입력 폼을 구현한다** (AI 플로우는 Task 17에서 이 파일에 추가한다)

```tsx
// app/roadmap/create/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { createRoadmap } from '../../../lib/roadmaps';
import { createMilestone } from '../../../lib/milestones';

interface DraftMilestone {
  title: string;
  due_date: string;
}

export default function CreateRoadmapPage() {
  const userId = useRequireAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDue, setMilestoneDue] = useState('');
  const [draftMilestones, setDraftMilestones] = useState<DraftMilestone[]>([]);

  function addDraftMilestone() {
    if (!milestoneTitle || !milestoneDue) return;
    setDraftMilestones([...draftMilestones, { title: milestoneTitle, due_date: milestoneDue }]);
    setMilestoneTitle('');
    setMilestoneDue('');
  }

  async function handleSubmit() {
    if (!userId || !title) return;
    const roadmap = await createRoadmap(supabase, userId, { title, source: 'manual' });
    await Promise.all(
      draftMilestones.map((m, index) =>
        createMilestone(supabase, { roadmap_id: roadmap.id, title: m.title, due_date: m.due_date, order_index: index })
      )
    );
    router.replace(`/roadmap/${roadmap.id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-bold">새 로드맵 만들기</h1>
      <input
        className="w-full rounded-lg border p-3"
        placeholder="목표를 알려주세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="rounded-xl border p-4">
        <p className="mb-2 font-medium">마일스톤 추가</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-lg border p-3"
            placeholder="마일스톤 제목"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
          />
          <input
            className="rounded-lg border p-3"
            type="date"
            value={milestoneDue}
            onChange={(e) => setMilestoneDue(e.target.value)}
          />
          <button className="rounded-lg border px-4 py-2" onClick={addDraftMilestone}>
            + 추가
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {draftMilestones.map((m, index) => (
            <li key={`${m.title}-${index}`}>- {m.title} ({m.due_date})</li>
          ))}
        </ul>
      </div>
      <button className="w-full rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleSubmit}>
        로드맵 만들기
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 수동 확인**

Run: `npm run dev` → 목표 제목과 마일스톤 2~3개를 추가해 제출 → 로드맵 상세로
이동하고 Supabase Studio에서 `roadmaps`/`milestones` 행이 생성됐는지 확인

- [ ] **Step 3: 커밋**

```bash
git add app/roadmap/create/page.tsx
git commit -m "feat: add manual roadmap creation form"
```

---

### Task 9: 로드맵 상세 페이지 — 마일스톤 리스트 뷰 + 마일스톤 추가/로드맵 삭제

**Files:**
- Create: `app/roadmap/[id]/page.tsx`

**Interfaces:**
- Consumes: `getRoadmap`, `deleteRoadmap` (Task 5), `listMilestones`, `createMilestone` (Task 6),
  `calculateProgress`, `milestoneStatus` (Task 4), `useRequireAuth` (Task 3)

- [ ] **Step 1: 리스트 기반 상세 페이지를 구현한다** (경로형 시각화는 Task 11에서 `<ul>`
목록 부분만 교체해서 확장한다 — 그 위의 헤더/마일스톤 추가/삭제 UI는 그대로 둔다)

```tsx
// app/roadmap/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { getRoadmap, deleteRoadmap } from '../../../lib/roadmaps';
import { listMilestones, createMilestone } from '../../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../../lib/progress';
import type { Roadmap, Milestone } from '../../../types/models';

export default function RoadmapDetailPage() {
  const userId = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDue, setNewMilestoneDue] = useState('');

  async function load() {
    if (!id) return;
    setRoadmap(await getRoadmap(supabase, id));
    setMilestones(await listMilestones(supabase, id));
  }

  useEffect(() => {
    if (!userId || !id) return;
    load();
  }, [userId, id]);

  async function handleAddMilestone() {
    if (!id || !newMilestoneTitle || !newMilestoneDue) return;
    // order_index는 그냥 끝 번호만 매기면 된다 - listMilestones가 due_date로
    // 정렬해서 돌려주므로, 이 마일스톤의 마감일이 기존 것보다 이르더라도
    // 타임라인에서는 알아서 올바른 위치에 보인다.
    await createMilestone(supabase, {
      roadmap_id: id,
      title: newMilestoneTitle,
      due_date: newMilestoneDue,
      order_index: milestones.length,
    });
    // 완료 처리됐던 로드맵에 마일스톤을 새로 추가하면 다시 진행 중으로 되돌린다
    if (roadmap?.status === 'completed') {
      await supabase.from('roadmaps').update({ status: 'active' }).eq('id', id);
    }
    setNewMilestoneTitle('');
    setNewMilestoneDue('');
    await load();
  }

  async function handleDeleteRoadmap() {
    if (!id) return;
    if (!confirm('이 로드맵과 모든 마일스톤을 삭제할까요? 되돌릴 수 없어요.')) return;
    await deleteRoadmap(supabase, id);
    router.replace('/');
  }

  if (!roadmap) return null;
  const progress = calculateProgress(milestones);
  const now = new Date();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{roadmap.title}</h1>
        <button className="text-sm text-red-600 underline" onClick={handleDeleteRoadmap}>
          로드맵 삭제
        </button>
      </div>
      <p className="text-sm text-gray-600">
        전체 진행률 {progress.percent}% ({progress.completedCount}/{progress.totalCount})
      </p>

      <div className="mt-4 rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">마일스톤 추가</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-lg border p-3"
            placeholder="마일스톤 제목"
            value={newMilestoneTitle}
            onChange={(e) => setNewMilestoneTitle(e.target.value)}
          />
          <input
            className="rounded-lg border p-3"
            type="date"
            value={newMilestoneDue}
            onChange={(e) => setNewMilestoneDue(e.target.value)}
          />
          <button className="rounded-lg border px-4 py-2" onClick={handleAddMilestone}>
            + 추가
          </button>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {milestones.map((milestone) => {
          const status = milestoneStatus(milestone, now);
          return (
            <li key={milestone.id}>
              <Link href={`/milestone/${milestone.id}`} className="block rounded-xl border p-3">
                <p className="font-medium">{milestone.title}</p>
                <p className={status === 'overdue' ? 'text-red-600' : 'text-gray-500'}>
                  {milestone.due_date} · {status}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 수동 확인**

Run: `npm run dev` → 홈에서 로드맵 상세로 진입해 마일스톤 목록과 진행률, 지연 표시가
보이는지 확인. "+ 추가"로 마일스톤을 하나 더 넣으면 목록에 바로 반영되는지, "로드맵
삭제"를 누르면 확인창 뒤에 홈으로 돌아가고 Supabase Studio에서 그 로드맵과 마일스톤이
전부 사라졌는지(`on delete cascade`) 확인

- [ ] **Step 3: 커밋**

```bash
git add app/roadmap/\[id\]/page.tsx
git commit -m "feat: add roadmap detail page with add-milestone and delete-roadmap"
```

---

### Task 10: 마일스톤 상세 페이지 — 체크/메모/마감일 수정 + 로드맵 자동 완료 처리

**Files:**
- Create: `app/milestone/[id]/page.tsx`
- Modify: `lib/roadmaps.ts` (Task 5에서 만든 파일에 함수를 추가한다)
- Test: `__tests__/roadmaps.test.ts` (Task 5에서 만든 파일에 케이스를 추가한다)

**Interfaces:**
- Consumes: `updateMilestone`, `listMilestones`, `deleteMilestone` (Task 6), `makeFakeClient` (Task 5),
  `useRequireAuth` (Task 3)
- Produces: `completeRoadmapIfAllDone(client, roadmapId): Promise<void>`

- [ ] **Step 1: 실패하는 테스트를 추가한다** (`lib/roadmaps.ts`에 로드맵을 자동으로
완료 처리하는 함수)

```ts
// __tests__/roadmaps.test.ts 에 추가
import { completeRoadmapIfAllDone } from '../lib/roadmaps';

test('completeRoadmapIfAllDone marks the roadmap completed when every milestone is done', async () => {
  const client = makeFakeClient([
    { data: [{ status: 'done' }, { status: 'done' }], error: null }, // listMilestones
    { data: null, error: null }, // update
  ]);
  await completeRoadmapIfAllDone(client, 'r1');
  expect(client.from).toHaveBeenCalledWith('roadmaps');
});

test('completeRoadmapIfAllDone does nothing when a milestone is still pending', async () => {
  const client = makeFakeClient([
    { data: [{ status: 'done' }, { status: 'pending' }], error: null }, // listMilestones
  ]);
  await completeRoadmapIfAllDone(client, 'r1');
  expect(client.from).toHaveBeenCalledTimes(1); // only the listMilestones call
});

test('completeRoadmapIfAllDone does nothing for a roadmap with no milestones', async () => {
  const client = makeFakeClient([{ data: [], error: null }]);
  await completeRoadmapIfAllDone(client, 'r1');
  expect(client.from).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest roadmaps.test.ts`
Expected: FAIL with "completeRoadmapIfAllDone is not a function"

- [ ] **Step 3: `lib/roadmaps.ts`에 함수를 추가한다**

```ts
// lib/roadmaps.ts 에 추가
import { listMilestones } from './milestones';

export async function completeRoadmapIfAllDone(client: SupabaseClient, roadmapId: string): Promise<void> {
  const milestones = await listMilestones(client, roadmapId);
  const allDone = milestones.length > 0 && milestones.every((m) => m.status === 'done');
  if (!allDone) return;
  const { error } = await client.from('roadmaps').update({ status: 'completed' }).eq('id', roadmapId);
  if (error) throw error;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest roadmaps.test.ts`
Expected: PASS (10 tests — 7 from Task 5 + 3 new)

- [ ] **Step 5: 마일스톤 상세 페이지를 구현하고, 완료 체크 시 자동 완료 처리를 호출한다**

```tsx
// app/milestone/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { updateMilestone, deleteMilestone } from '../../../lib/milestones';
import { completeRoadmapIfAllDone } from '../../../lib/roadmaps';
import type { Milestone } from '../../../types/models';

export default function MilestoneDetailPage() {
  const userId = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!userId || !id) return;
    async function load() {
      const { data } = await supabase.from('milestones').select('*').eq('id', id).single();
      const row = data as Milestone;
      setMilestone(row);
      setDescription(row?.description ?? '');
      setDueDate(row?.due_date ?? '');
    }
    load();
  }, [userId, id]);

  if (!milestone) return null;

  async function toggleDone(checked: boolean) {
    if (!milestone) return;
    const updated = await updateMilestone(supabase, milestone.id, {
      status: checked ? 'done' : 'pending',
      completed_at: checked ? new Date().toISOString() : null,
    });
    setMilestone(updated);
    if (checked) {
      await completeRoadmapIfAllDone(supabase, milestone.roadmap_id);
    }
  }

  async function saveEdits() {
    if (!milestone) return;
    await updateMilestone(supabase, milestone.id, { description, due_date: dueDate });
    // App Router는 뒤로 이동 시 이전 화면을 캐시에서 그대로 보여줄 수 있어서,
    // 방금 바뀐 마감일/지연 상태가 안 보일 수 있다 - 뒤로 가기 전에 캐시를 무효화한다.
    router.refresh();
    router.back();
  }

  async function handleDelete() {
    if (!milestone) return;
    if (!confirm('이 마일스톤을 삭제할까요?')) return;
    const roadmapId = milestone.roadmap_id;
    await deleteMilestone(supabase, milestone.id);
    router.replace(`/roadmap/${roadmapId}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{milestone.title}</h1>
        <button className="text-sm text-red-600 underline" onClick={handleDelete}>
          삭제
        </button>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={milestone.status === 'done'} onChange={(e) => toggleDone(e.target.checked)} />
        완료
      </label>
      <div>
        <p className="mb-1 text-sm font-medium">메모</p>
        <textarea
          className="w-full rounded-lg border p-3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">마감일</p>
        <input className="rounded-lg border p-3" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <button className="rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white" onClick={saveEdits}>
        저장
      </button>
    </div>
  );
}
```

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → 체크박스로 완료 토글 시 상태가 `done`으로 바뀌는지, 마감일을
수정하고 저장하면 로드맵 상세로 돌아가 지연 상태가 새로고침 없이도 바로 재계산돼
보이는지(캐시 무효화 확인) 확인. 로드맵의 마지막 마일스톤까지 전부 체크한 뒤 홈으로
돌아가면 그 로드맵이 목록에서 사라지는지(Task 7에서 추가한 `active` 필터 때문에
`completed`로 전환된 로드맵은 안 보임) 확인. "삭제"를 누르면 확인창 뒤에 로드맵
상세로 돌아가고 그 마일스톤이 목록에서 사라졌는지 확인

- [ ] **Step 7: 커밋**

```bash
git add app/milestone/\[id\]/page.tsx lib/roadmaps.ts __tests__/roadmaps.test.ts
git commit -m "feat: add milestone detail page with delete, auth guard, and auto-complete roadmap"
```

---

### Task 11: 경로형 타임라인 좌표 계산 + 반응형 적용

**Files:**
- Create: `lib/timeline.ts`
- Modify: `app/roadmap/[id]/page.tsx` (좁은 화면용 리스트는 유지하고, 넓은 화면용 타임라인을 추가한다)
- Test: `__tests__/timeline.test.ts`

**Interfaces:**
- Produces: `computeNodePositions(count: number): { xPercent: number; y: number; side: 'left' | 'right' }[]`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/timeline.test.ts
import { computeNodePositions } from '../lib/timeline';

test('alternates left and right starting with left', () => {
  const positions = computeNodePositions(4);
  expect(positions.map((p) => p.side)).toEqual(['left', 'right', 'left', 'right']);
});

test('increases y by a fixed row height per node', () => {
  const positions = computeNodePositions(3);
  expect(positions[1].y - positions[0].y).toBe(140);
  expect(positions[2].y - positions[1].y).toBe(140);
});

test('uses a fixed horizontal percent for each side so the layout scales with container width', () => {
  const positions = computeNodePositions(2);
  expect(positions[0].xPercent).toBeCloseTo(0.15);
  expect(positions[1].xPercent).toBeCloseTo(0.75);
});

test('returns an empty array for zero milestones', () => {
  expect(computeNodePositions(0)).toEqual([]);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest timeline.test.ts`
Expected: FAIL with "Cannot find module '../lib/timeline'"

- [ ] **Step 3: 구현한다** (좌우 위치를 픽셀이 아닌 컨테이너 폭 대비 비율로 반환해
어떤 화면 크기에서도 컨테이너에 맞춰 스케일되게 한다)

```ts
// lib/timeline.ts
export interface NodePosition {
  xPercent: number;
  y: number;
  side: 'left' | 'right';
}

const LEFT_PERCENT = 0.15;
const RIGHT_PERCENT = 0.75;
const ROW_HEIGHT = 140;
const TOP_OFFSET = 40;

export function computeNodePositions(count: number): NodePosition[] {
  const positions: NodePosition[] = [];
  for (let i = 0; i < count; i++) {
    const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
    positions.push({ xPercent: side === 'left' ? LEFT_PERCENT : RIGHT_PERCENT, y: TOP_OFFSET + i * ROW_HEIGHT, side });
  }
  return positions;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest timeline.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 로드맵 상세 페이지에 브레이크포인트별 두 가지 뷰를 추가한다** (Task 9의
헤더 · 마일스톤 추가 폼 · 삭제 버튼은 그대로 두고, 맨 아래 `<ul className="mt-4
space-y-2">...</ul>` 블록 **하나만** 아래 두 블록으로 교체한다)

```tsx
// app/roadmap/[id]/page.tsx 상단 import에 추가
import { computeNodePositions } from '../../../lib/timeline';
```

```tsx
// 컴포넌트 안, return 문 바로 위에 추가
const positions = computeNodePositions(milestones.length);
const pathHeight = 40 + milestones.length * 140 + 100;
```

```tsx
{/* 기존 <ul className="mt-4 space-y-2">...</ul> 를 아래 두 블록으로 교체 */}
{/* 좁은 화면: 세로 리스트 */}
<ul className="mt-4 space-y-2 sm:hidden">
  {milestones.map((milestone) => {
    const status = milestoneStatus(milestone, now);
    return (
      <li key={milestone.id}>
        <Link href={`/milestone/${milestone.id}`} className="block rounded-xl border p-3">
          <p className="font-medium">{milestone.title}</p>
          <p className={status === 'overdue' ? 'text-red-600' : 'text-gray-500'}>
            {milestone.due_date} · {status}
          </p>
        </Link>
      </li>
    );
  })}
</ul>

{/* 넓은 화면: 경로형 타임라인 */}
<div className="relative mt-4 hidden sm:block" style={{ height: pathHeight }}>
  {milestones.map((milestone, index) => {
    const pos = positions[index];
    const status = milestoneStatus(milestone, now);
    return (
      <Link
        key={milestone.id}
        href={`/milestone/${milestone.id}`}
        className="absolute flex -translate-x-1/2 flex-col items-center gap-1 text-center"
        style={{ left: `${pos.xPercent * 100}%`, top: pos.y }}
      >
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full font-semibold text-white ${
            status === 'done' ? 'bg-green-500' : status === 'overdue' ? 'bg-red-500' : 'bg-gray-200 !text-gray-700'
          }`}
        >
          {index + 1}
        </div>
        <span className="text-sm font-medium">{milestone.title}</span>
        <span className="text-xs text-gray-500">{milestone.due_date}</span>
      </Link>
    );
  })}
</div>
```

교체 후 파일 전체 구조는: 헤더(제목+삭제 버튼) → 진행률 → 마일스톤 추가 폼 →
(좁은 화면용 리스트 / 넓은 화면용 타임라인, 두 블록 다 유지) 순서가 된다.

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → 브라우저 폭을 늘리면 좌/우로 번갈아 배치된 경로형 노드가,
좁히면 세로 리스트가 보이는지, 완료/지연/대기 상태 색이 구분되는지 확인

- [ ] **Step 7: 커밋**

```bash
git add lib/timeline.ts __tests__/timeline.test.ts app/roadmap/\[id\]/page.tsx
git commit -m "feat: add responsive path-style timeline for roadmap detail"
```

---

### Task 12: 스트릭 계산 로직 (`lib/streak.ts`)

**Files:**
- Create: `lib/streak.ts`
- Test: `__tests__/streak.test.ts`

**Interfaces:**
- Produces: `computeStreak(checkinDates: string[], today: Date): number`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/streak.test.ts
import { computeStreak } from '../lib/streak';

test('counts consecutive days ending today', () => {
  const checkins = ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'];
  expect(computeStreak(checkins, new Date('2026-09-07'))).toBe(4);
});

test('still counts the streak when today has not checked in yet but yesterday did', () => {
  const checkins = ['2026-09-05', '2026-09-06'];
  expect(computeStreak(checkins, new Date('2026-09-07'))).toBe(2);
});

test('resets to 0 when the most recent check-in is more than a day old', () => {
  const checkins = ['2026-09-01', '2026-09-02'];
  expect(computeStreak(checkins, new Date('2026-09-07'))).toBe(0);
});

test('ignores a gap earlier in the history once a break occurred', () => {
  const checkins = ['2026-09-01', '2026-09-05', '2026-09-06', '2026-09-07'];
  expect(computeStreak(checkins, new Date('2026-09-07'))).toBe(3);
});

test('returns 0 for no check-ins', () => {
  expect(computeStreak([], new Date('2026-09-07'))).toBe(0);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest streak.test.ts`
Expected: FAIL with "Cannot find module '../lib/streak'"

- [ ] **Step 3: 구현한다**

```ts
// lib/streak.ts
function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

export function computeStreak(checkinDates: string[], today: Date): number {
  if (checkinDates.length === 0) return 0;
  const sorted = [...new Set(checkinDates)].sort();
  const todayStr = toDateOnly(today);
  const last = sorted[sorted.length - 1];
  const gapFromToday = daysBetween(last, todayStr);
  if (gapFromToday > 1) return 0;
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest streak.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/streak.ts __tests__/streak.test.ts
git commit -m "feat: add account-wide streak calculation"
```

---

### Task 13: 체크인 기록/조회 + 홈 페이지 스트릭 표시 + 마일스톤 완료를 체크인으로 인정

**Files:**
- Create: `lib/checkins.ts`
- Modify: `app/(dashboard)/page.tsx`
- Modify: `app/milestone/[id]/page.tsx` (Task 10에서 만든 파일 — 마일스톤을 완료로
  체크하면 그날의 체크인도 함께 기록한다)
- Test: `__tests__/checkins.test.ts`

**Interfaces:**
- Consumes: `computeStreak` (Task 12), `makeFakeClient` (Task 5)
- Produces: `recordCheckin(client, userId, today): Promise<number>`, `getTodayStreak(client, userId, today): Promise<number>`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/checkins.test.ts
import { recordCheckin, getTodayStreak } from '../lib/checkins';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('recordCheckin upserts today, recomputes streak, and stores it', async () => {
  const client = makeFakeClient([
    { data: null, error: null },
    { data: [{ checkin_date: '2026-09-06' }, { checkin_date: '2026-09-07' }], error: null },
    { data: null, error: null },
  ]);
  const streak = await recordCheckin(client, 'u1', new Date('2026-09-07'));
  expect(streak).toBe(2);
});

test('getTodayStreak computes the streak without writing', async () => {
  const client = makeFakeClient([{ data: [{ checkin_date: '2026-09-07' }], error: null }]);
  const streak = await getTodayStreak(client, 'u1', new Date('2026-09-07'));
  expect(streak).toBe(1);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest checkins.test.ts`
Expected: FAIL with "Cannot find module '../lib/checkins'"

- [ ] **Step 3: 구현한다**

```ts
// lib/checkins.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStreak } from './streak';

export async function recordCheckin(client: SupabaseClient, userId: string, today: Date): Promise<number> {
  const todayStr = today.toISOString().slice(0, 10);
  const { error: insertError } = await client
    .from('habit_checkins')
    .upsert({ user_id: userId, checkin_date: todayStr, streak_count: 0 }, { onConflict: 'user_id,checkin_date', ignoreDuplicates: true });
  if (insertError) throw insertError;

  const { data, error } = await client.from('habit_checkins').select('checkin_date').eq('user_id', userId);
  if (error) throw error;

  const streak = computeStreak((data ?? []).map((row: { checkin_date: string }) => row.checkin_date), today);

  const { error: updateError } = await client
    .from('habit_checkins')
    .update({ streak_count: streak })
    .eq('user_id', userId)
    .eq('checkin_date', todayStr);
  if (updateError) throw updateError;

  return streak;
}

export async function getTodayStreak(client: SupabaseClient, userId: string, today: Date): Promise<number> {
  const { data, error } = await client.from('habit_checkins').select('checkin_date').eq('user_id', userId);
  if (error) throw error;
  return computeStreak((data ?? []).map((row: { checkin_date: string }) => row.checkin_date), today);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest checkins.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 홈 페이지에 스트릭 표시와 체크인 버튼을 추가한다**

```tsx
// app/(dashboard)/page.tsx 상단에 추가
import { recordCheckin, getTodayStreak } from '../../lib/checkins';
// ...
// 아래 두 함수는 컴포넌트 상단의 `const userId = useRequireAuth();` 를 그대로 재사용한다
const [streak, setStreak] = useState(0);
useEffect(() => {
  if (!userId) return;
  async function loadStreak() {
    setStreak(await getTodayStreak(supabase, userId, new Date()));
  }
  loadStreak();
}, [userId]);

async function handleCheckin() {
  if (!userId) return;
  setStreak(await recordCheckin(supabase, userId, new Date()));
}
```

Task 7에서 만든 헤더(`<h1>내 목표</h1>` + 진행 중 개수 `<p>`)를 다음으로 교체한다:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">내 목표</h1>
  <div className="flex items-center gap-3">
    <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">{streak}일 연속</span>
    <button className="rounded-lg border px-3 py-1 text-sm" onClick={handleCheckin}>
      오늘 체크인
    </button>
  </div>
</div>
<p className="mb-4 text-sm text-gray-500">{rows.length}개 진행 중 (완료된 로드맵은 대시보드에서 확인)</p>
```

- [ ] **Step 6: 마일스톤을 완료로 체크하는 것도 그날의 체크인으로 인정되게 연결한다**
(스펙: "그날 뭐라도 체크했는지"에는 마일스톤 완료도 포함된다)

```tsx
// app/milestone/[id]/page.tsx — import에 추가
import { recordCheckin } from '../../../lib/checkins';
```

```tsx
// app/milestone/[id]/page.tsx 의 toggleDone 함수를 다음으로 교체
// (컴포넌트 상단의 `const userId = useRequireAuth();` 를 그대로 재사용한다)
async function toggleDone(checked: boolean) {
  if (!milestone) return;
  const updated = await updateMilestone(supabase, milestone.id, {
    status: checked ? 'done' : 'pending',
    completed_at: checked ? new Date().toISOString() : null,
  });
  setMilestone(updated);
  if (checked) {
    await completeRoadmapIfAllDone(supabase, milestone.roadmap_id);
    if (userId) {
      await recordCheckin(supabase, userId, new Date());
    }
  }
}
```

- [ ] **Step 7: 수동 확인**

Run: `npm run dev` → "오늘 체크인" 버튼을 누르면 스트릭 숫자가 올라가고, 페이지를
새로고침해도 유지되는지 확인. 체크인을 하지 않은 상태에서 마일스톤 하나를 완료
처리한 뒤 홈으로 돌아오면 스트릭이 마찬가지로 올라가 있는지 확인

- [ ] **Step 8: 커밋**

```bash
git add lib/checkins.ts __tests__/checkins.test.ts app/\(dashboard\)/page.tsx app/milestone/\[id\]/page.tsx
git commit -m "feat: add check-in recording, home streak display, and milestone-as-checkin linkage"
```

---

### Task 14: 브라우저 Web Push 구독 등록 + 설정 페이지

**Files:**
- Create: `lib/notifications.ts`
- Create: `public/sw.js`
- Create: `app/(dashboard)/settings/page.tsx`
- Modify: `app/(dashboard)/layout.tsx` (Task 7에서 만든 파일 — 서비스 워커가 구독
  갱신을 알려주면 새 구독을 저장하는 리스너를 붙인다)
- Test: `__tests__/notifications.test.ts`

**Interfaces:**
- Consumes: `useRequireAuth` (Task 3), `NotificationSettings` (Task 2)
- Produces: `subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON | null>`,
  `urlBase64ToUint8Array(base64String: string): Uint8Array`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/notifications.test.ts
import { urlBase64ToUint8Array } from '../lib/notifications';

test('decodes a base64url string into the expected byte array', () => {
  // "SGVsbG8" is base64url for the ASCII bytes of "Hello"
  expect(Array.from(urlBase64ToUint8Array('SGVsbG8'))).toEqual([72, 101, 108, 108, 111]);
});

test('maps the URL-safe "-" and "_" characters back to standard base64 before decoding', () => {
  // "-_-_" is the URL-safe form of the standard base64 string "+/+/"
  expect(Array.from(urlBase64ToUint8Array('-_-_'))).toEqual([0xfb, 0xff, 0xbf]);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest notifications.test.ts`
Expected: FAIL with "Cannot find module '../lib/notifications'"

- [ ] **Step 3: 구현한다**

```ts
// lib/notifications.ts
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return subscription.toJSON();
}
```

```js
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? '로드맵 알림', {
      body: data.body ?? '',
    })
  );
});

// 브라우저가 내부적으로 구독을 갱신/만료시키면 이 이벤트가 발생한다. 서비스
// 워커에는 사용자의 로그인 세션이 없어 직접 Supabase에 쓸 수 없으므로, 새
// 구독을 열려있는 탭에 postMessage로 전달하고, 탭에 있는(로그인된) 클라이언트가
// 대신 저장하게 한다.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? { applicationServerKey: event.oldSubscription.options.applicationServerKey, userVisibleOnly: true } : undefined)
      .then((newSubscription) =>
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: newSubscription.toJSON() })
          );
        })
      )
  );
});
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest notifications.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 설정 페이지를 구현한다**

```tsx
// app/(dashboard)/settings/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { subscribeToPush } from '../../../lib/notifications';
import type { NotificationSettings } from '../../../types/models';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;

export default function SettingsPage() {
  const userId = useRequireAuth();
  const router = useRouter();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Task 2의 트리거가 가입 시점에 기본 행을 이미 만들어뒀으므로, 여기서는
    // 그 값을 읽어와 체크박스/시간 입력을 실제 DB 상태와 맞춘다(이전 버전은
    // 항상 켜진 상태로 시작해 새로고침하면 꺼둔 설정이 다시 켜진 것처럼 보였다).
    supabase
      .from('notification_settings')
      .select('reminder_enabled, reminder_time')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        const settings = data as Pick<NotificationSettings, 'reminder_enabled' | 'reminder_time'> | null;
        if (!settings) return;
        setReminderEnabled(settings.reminder_enabled);
        setReminderTime(settings.reminder_time.slice(0, 5));
        setLoaded(true);
      });
  }, [userId]);

  // "계정" 카드에 표시할 이메일 — profiles/notification_settings 어디에도 없고
  // auth.users에만 있는 값이라, 이 화면에서만 필요한 별도 조회로 가져온다
  // (useRequireAuth는 userId만 반환하고, 다른 태스크들도 그 계약에 기대고 있어
  // 여기서 굳이 리턴 타입을 바꾸지 않는다).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function toggleReminder(value: boolean) {
    setReminderEnabled(value);
    if (!userId) return;
    const subscription = value ? await subscribeToPush(VAPID_PUBLIC_KEY) : null;
    await supabase
      .from('notification_settings')
      .upsert(
        { user_id: userId, reminder_enabled: value, push_subscription: subscription },
        { onConflict: 'user_id' }
      );
  }

  async function handleReminderTimeChange(value: string) {
    setReminderTime(value);
    if (!userId) return;
    await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, reminder_time: value }, { onConflict: 'user_id' });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold">설정</h1>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={reminderEnabled} onChange={(e) => toggleReminder(e.target.checked)} />
        알림 받기
      </label>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600" htmlFor="reminder-time">
          알림 시간
        </label>
        <input
          id="reminder-time"
          type="time"
          className="rounded-lg border p-2"
          value={reminderTime}
          disabled={!reminderEnabled}
          onChange={(e) => handleReminderTimeChange(e.target.value)}
        />
      </div>
      {email && <p className="text-sm text-gray-500">{email}</p>}
      <button className="rounded-lg border px-4 py-2" onClick={handleLogout}>
        로그아웃
      </button>
    </div>
  );
}
```

- [ ] **Step 6: 서비스 워커가 알려주는 구독 갱신을 홈 레이아웃에서 받아 저장한다**
(로그인된 탭이 열려있을 때만 반영되는 MVP 수준의 대응 — Task 1 참고)

```tsx
// app/(dashboard)/layout.tsx 에 추가
'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'PUSH_SUBSCRIPTION_CHANGED') return;
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        supabase
          .from('notification_settings')
          .upsert(
            { user_id: data.user.id, push_subscription: event.data.subscription },
            { onConflict: 'user_id' }
          );
      });
    }
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div>
      <nav className="flex gap-4 border-b p-4 text-sm">
        <Link href="/">홈</Link>
        <Link href="/dashboard">대시보드</Link>
        <Link href="/coaching">AI 코칭</Link>
        <Link href="/settings">설정</Link>
      </nav>
      {children}
    </div>
  );
}
```

이 레이아웃 파일은 Task 1에서 `layout.tsx`라는 이름으로 이미 만든 것과 다른 파일이다
— Task 7이 만든 `app/(dashboard)/layout.tsx`에 `'use client'`와 위 리스너를 추가하는
것이며, 기존 `<nav>`는 그대로 둔다.

- [ ] **Step 7: 수동 확인**

Run: `npm run dev` (HTTPS 또는 `localhost`에서 실행 — Web Push는 보안 컨텍스트 필요) →
알림 받기를 켰을 때 브라우저 알림 권한 요청이 뜨는지, 허용 후
`notification_settings.push_subscription`이 채워지는지, 로그아웃이 로그인 페이지로
보내는지, 로그인 안 한 상태로 설정 페이지에 들어가면 로그인 페이지로 튕기는지, 로그아웃
버튼 위에 로그인한 계정의 이메일이 보이는지 확인.
**추가로**: 알림을 끄고 시간을 다른 값으로 바꾼 뒤 페이지를 새로고침해서 체크박스와
시간 입력이 방금 바꾼 값 그대로 유지되는지(DB에서 다시 불러왔는지), Supabase
Studio에서 `notification_settings.reminder_time`이 실제로 바뀌었는지 확인

- [ ] **Step 8: 커밋**

```bash
git add lib/notifications.ts __tests__/notifications.test.ts public/sw.js app/\(dashboard\)/settings/page.tsx app/\(dashboard\)/layout.tsx
git commit -m "feat: add web push subscription, settings page (loads existing values, editable reminder time, account email), and subscription-refresh handling"
```

---

### Task 15: 진행률 대시보드 페이지

**Files:**
- Create: `lib/dashboard.ts`
- Create: `app/(dashboard)/dashboard/page.tsx`
- Test: `__tests__/dashboard.test.ts`

**Interfaces:**
- Consumes: `calculateProgress`, `ProgressSummary` (Task 4), `Roadmap`, `Milestone` (Task 2), `useRequireAuth` (Task 3)
- Produces: `summarizeDashboard(entries): { roadmaps: { roadmap: Roadmap; progress: ProgressSummary }[]; overallPercent: number }`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/dashboard.test.ts
import { summarizeDashboard } from '../lib/dashboard';

test('computes overall percent across all roadmaps', () => {
  const entries = [
    { roadmap: { id: 'r1', title: 'A' } as any, milestones: [{ status: 'done' }, { status: 'pending' }] as any },
    { roadmap: { id: 'r2', title: 'B' } as any, milestones: [{ status: 'done' }, { status: 'done' }] as any },
  ];
  const result = summarizeDashboard(entries);
  expect(result.overallPercent).toBe(75);
  expect(result.roadmaps).toHaveLength(2);
});

test('returns 0 overall percent when there are no milestones anywhere', () => {
  const entries = [{ roadmap: { id: 'r1' } as any, milestones: [] }];
  expect(summarizeDashboard(entries).overallPercent).toBe(0);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest dashboard.test.ts`
Expected: FAIL with "Cannot find module '../lib/dashboard'"

- [ ] **Step 3: 구현한다**

```ts
// lib/dashboard.ts
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest dashboard.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 대시보드 페이지를 구현한다**

```tsx
// app/(dashboard)/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listRoadmaps } from '../../../lib/roadmaps';
import { listMilestones } from '../../../lib/milestones';
import { summarizeDashboard, DashboardSummary } from '../../../lib/dashboard';

export default function DashboardPage() {
  const userId = useRequireAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const roadmaps = await listRoadmaps(supabase, userId);
      const entries = await Promise.all(
        roadmaps.map(async (roadmap) => ({ roadmap, milestones: await listMilestones(supabase, roadmap.id) }))
      );
      setSummary(summarizeDashboard(entries));
    }
    load();
  }, [userId]);

  if (!summary) return null;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">진행률 대시보드</h1>
      <p className="mt-1 text-lg font-semibold text-orange-600">전체 {summary.overallPercent}%</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summary.roadmaps.map((item) => (
          <div key={item.roadmap.id} className="rounded-xl border p-3">
            <p className="font-medium">{item.roadmap.title}</p>
            <p className="text-sm text-gray-600">
              {item.progress.percent}% ({item.progress.completedCount}/{item.progress.totalCount})
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → 대시보드 페이지에서 전체 진행률과 로드맵별 진행률이 홈 페이지의
개별 카드 값과 일치하는지, 반응형 그리드가 폭에 따라 바뀌는지 확인

- [ ] **Step 7: 커밋**

```bash
git add lib/dashboard.ts __tests__/dashboard.test.ts app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add progress dashboard page"
```

---

### Task 16: FastAPI 백엔드 뼈대 + `POST /generate-roadmap` — AI 로드맵 생성

이 태스크가 `backend/` FastAPI 프로젝트의 첫 태스크라, AI 호출 로직과 함께 백엔드
프로젝트 자체의 뼈대(의존성, Dockerfile, 앱 진입점)도 같이 만든다. 이후 Task 18/19는
이 뼈대에 라우터/스케줄 작업을 더하기만 한다.

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/generate_roadmap_parse.py`
- Create: `backend/app/generate_roadmap.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_generate_roadmap.py`

**Interfaces:**
- Produces: `parse_roadmap_response(raw_text: str) -> list[ParsedMilestone]` (순수 함수,
  `ParsedMilestone`는 `title`/`due_date`/`order_index` 필드를 가진 dataclass),
  FastAPI 라우터 `POST /generate-roadmap` (Task 17이 프론트엔드에서 `fetch`로 호출)

- [ ] **Step 1: FastAPI 프로젝트 뼈대를 만든다**

```txt
# backend/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
httpx==0.27.2
supabase==2.9.1
pywebpush==2.0.1
apscheduler==3.10.4
pytest==8.3.3
```

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```txt
# backend/.dockerignore
__pycache__/
*.pyc
.pytest_cache/
tests/
.venv/
```

```python
# backend/app/__init__.py
```

```python
# backend/app/main.py
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .generate_roadmap import router as generate_roadmap_router

app = FastAPI(title="goal-roadmap-app backend")

# 프론트엔드(Next.js)가 별도 도커 컨테이너에서 이 백엔드를 브라우저 fetch로
# 직접 호출하므로, Supabase Edge Function 때는 필요 없던 CORS 허용이 필요하다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_roadmap_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

```python
# backend/tests/__init__.py
```

Run: `cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`
Expected: 의존성이 에러 없이 설치됨

- [ ] **Step 2: 실패하는 테스트를 작성한다** (`parse_roadmap_response` 순수 함수 —
Deno 버전의 4개 케이스를 그대로 이식)

```python
# backend/tests/test_generate_roadmap.py
import pytest

from app.generate_roadmap_parse import parse_roadmap_response


def test_parses_a_valid_json_array_of_milestones():
    raw = '[{"title": "1km 완주", "due_date": "2026-10-01"}, {"title": "3km 완주", "due_date": "2026-10-15"}]'
    result = parse_roadmap_response(raw)
    assert [(m.title, m.due_date, m.order_index) for m in result] == [
        ("1km 완주", "2026-10-01", 0),
        ("3km 완주", "2026-10-15", 1),
    ]


def test_raises_when_the_response_is_not_valid_json():
    with pytest.raises(ValueError, match="valid JSON"):
        parse_roadmap_response("not json")


def test_raises_when_a_milestone_is_missing_due_date():
    with pytest.raises(ValueError, match="missing title or due_date"):
        parse_roadmap_response('[{"title": "only title"}]')


def test_sorts_milestones_by_due_date_before_assigning_order_index():
    raw = '[{"title": "3km 완주", "due_date": "2026-10-15"}, {"title": "1km 완주", "due_date": "2026-10-01"}]'
    result = parse_roadmap_response(raw)
    assert [(m.title, m.due_date, m.order_index) for m in result] == [
        ("1km 완주", "2026-10-01", 0),
        ("3km 완주", "2026-10-15", 1),
    ]
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd backend && . .venv/bin/activate && python -m pytest tests/test_generate_roadmap.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.generate_roadmap_parse'"

- [ ] **Step 4: 순수 함수를 구현한다** (Deno 버전의 `parse.ts`에 대응 — 환경변수나
네트워크 호출이 전혀 없는 파일이라 테스트 임포트가 안전하다)

```python
# backend/app/generate_roadmap_parse.py
from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass
class ParsedMilestone:
    title: str
    due_date: str
    order_index: int


def parse_roadmap_response(raw_text: str) -> list[ParsedMilestone]:
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("AI response was not valid JSON") from exc
    if not isinstance(data, list):
        raise ValueError("AI response must be a JSON array of milestones")

    without_order: list[dict] = []
    for index, item in enumerate(data):
        title = item.get("title") if isinstance(item, dict) else None
        due_date = item.get("due_date") if isinstance(item, dict) else None
        if not isinstance(title, str) or not isinstance(due_date, str):
            raise ValueError(f"Milestone at index {index} is missing title or due_date")
        without_order.append({"title": title, "due_date": due_date})

    # 모델이 마일스톤을 항상 날짜순으로 돌려준다는 보장이 없어서, order_index를
    # 매기기 전에 due_date로 먼저 정렬한다 — 응답 순서가 뒤섞여도 타임라인은
    # 항상 날짜순으로 보이게 하기 위함.
    without_order.sort(key=lambda m: m["due_date"])
    return [
        ParsedMilestone(title=m["title"], due_date=m["due_date"], order_index=i)
        for i, m in enumerate(without_order)
    ]
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd backend && . .venv/bin/activate && python -m pytest tests/test_generate_roadmap.py -v`
Expected: PASS (4 tests)

- [ ] **Step 6: FastAPI 라우터 핸들러를 작성한다** (Deno 버전의 `index.ts`에 대응.
환경변수 읽기는 함수 본문 안에서 하고 모듈 최상단에서 하지 않는다 — 위 pytest처럼
이 파일을 임포트만 할 때 환경변수가 없어도 에러가 나지 않게 하기 위함)

```python
# backend/app/generate_roadmap.py
from __future__ import annotations

import os
from datetime import date

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from .generate_roadmap_parse import parse_roadmap_response

GEMINI_MODEL = "gemini-2.5-flash"

router = APIRouter()


class GenerateRoadmapRequest(BaseModel):
    user_id: str
    title: str
    description: str | None = None


class GenerateRoadmapResponse(BaseModel):
    roadmap_id: str


@router.post("/generate-roadmap", response_model=GenerateRoadmapResponse)
async def generate_roadmap(payload: GenerateRoadmapRequest) -> GenerateRoadmapResponse:
    gemini_api_key = os.environ["GEMINI_API_KEY"]
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    today = date.today().isoformat()
    prompt = (
        f'오늘 날짜: {today}\n'
        f'사용자의 목표: "{payload.title}"\n'
        f'추가 설명: "{payload.description or ""}"\n'
        "이 목표를 달성하기 위한 마일스톤을 5~8개, 각 마일스톤의 title과 "
        "due_date(YYYY-MM-DD, 위 오늘 날짜를 기준으로 합리적인 간격을 두고 이후 날짜로)로 "
        "구성된 JSON 배열로만 응답해. 다른 설명 텍스트는 포함하지 마."
    )

    async with httpx.AsyncClient() as client:
        ai_response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            params={"key": gemini_api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 1024},
            },
        )

    if ai_response.status_code != 200:
        raise HTTPException(status_code=502, detail="AI request failed")

    ai_json = ai_response.json()
    raw_text = (
        ai_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    )

    try:
        milestones = parse_roadmap_response(raw_text)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    supabase = create_client(supabase_url, supabase_service_role_key)

    roadmap = (
        supabase.table("roadmaps")
        .insert(
            {
                "user_id": payload.user_id,
                "title": payload.title,
                "description": payload.description,
                "source": "ai",
                "status": "active",
            }
        )
        .execute()
    ).data[0]

    try:
        supabase.table("milestones").insert(
            [
                {
                    "roadmap_id": roadmap["id"],
                    "title": m.title,
                    "due_date": m.due_date,
                    "order_index": m.order_index,
                    "status": "pending",
                }
                for m in milestones
            ]
        ).execute()
    except Exception as exc:
        # 마일스톤 insert가 실패하면 방금 만든 로드맵만 덩그러니 남는다(마일스톤 0개짜리
        # 고아 로드맵) - 실패를 알리기 전에 롤백 삼아 지운다.
        supabase.table("roadmaps").delete().eq("id", roadmap["id"]).execute()
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return GenerateRoadmapResponse(roadmap_id=roadmap["id"])
```

- [ ] **Step 7: 로컬에서 띄우고 수동 확인**

Run: `cd backend && . .venv/bin/activate && GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... uvicorn app.main:app --reload`, then:

```bash
curl -X POST "http://localhost:8000/generate-roadmap" \
  -H "content-type: application/json" \
  -d '{"user_id":"<test-user-id>","title":"3개월 안에 10km 마라톤 완주하기"}'
```

Expected: `{"roadmap_id": "..."}` 응답과 함께 `roadmaps`/`milestones`에 행 생성 확인.
`milestones` insert를 일부러 실패시켜보고(예: 마이그레이션 전에 호출) `roadmaps`에도
고아 행이 안 남고 같이 롤백되는지 확인

- [ ] **Step 8: 커밋**

```bash
git add backend/
git commit -m "feat: bootstrap FastAPI backend and add AI roadmap generation endpoint"
```

---

### Task 17: 로드맵 생성 페이지에 AI 플로우 연동

**Files:**
- Modify: `app/roadmap/create/page.tsx`

**Interfaces:**
- Consumes: `POST /generate-roadmap` (Task 16의 FastAPI 백엔드 — Supabase Edge Function이
  아니라 별도 `backend/` 컨테이너의 엔드포인트라서 `supabase.functions.invoke` 대신
  일반 `fetch()`로 호출한다)

- [ ] **Step 1: 방식 선택 토글과 AI 제출 플로우를 추가한다**

```tsx
// app/roadmap/create/page.tsx 상단, 다른 상수 선언 옆에 추가
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL as string;
```

```tsx
// app/roadmap/create/page.tsx 상단부에 추가
const [mode, setMode] = useState<'ai' | 'manual'>('ai');
const [aiDescription, setAiDescription] = useState('');
const [aiError, setAiError] = useState<string | null>(null);

async function handleAiSubmit() {
  if (!userId || !title) return;
  try {
    const response = await fetch(`${BACKEND_URL}/generate-roadmap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, title, description: aiDescription }),
    });
    if (!response.ok) throw new Error('AI request failed');
    const data = await response.json();
    router.replace(`/roadmap/${data.roadmap_id}`);
  } catch {
    setAiError('AI 생성에 실패했어요. 직접 입력으로 만들어주세요.');
    setMode('manual');
  }
}
```

JSX 상단에 방식 선택 버튼 두 개를 추가하고 `mode`에 따라 분기한다:

```tsx
<div className="flex gap-2">
  <button
    className={`flex-1 rounded-lg p-3 font-semibold ${mode === 'ai' ? 'bg-orange-500 text-white' : 'border'}`}
    onClick={() => setMode('ai')}
  >
    AI가 만들어줘
  </button>
  <button
    className={`flex-1 rounded-lg p-3 font-semibold ${mode === 'manual' ? 'bg-orange-500 text-white' : 'border'}`}
    onClick={() => setMode('manual')}
  >
    직접 만들래
  </button>
</div>
{aiError && <p className="text-sm text-red-600">{aiError}</p>}
{mode === 'ai' ? (
  <div className="space-y-3 rounded-xl border p-4">
    <input className="w-full rounded-lg border p-3" placeholder="목표를 알려주세요" value={title} onChange={(e) => setTitle(e.target.value)} />
    <textarea
      className="w-full rounded-lg border p-3"
      placeholder="추가 설명 (선택)"
      value={aiDescription}
      onChange={(e) => setAiDescription(e.target.value)}
    />
    <button className="w-full rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleAiSubmit}>
      AI로 로드맵 만들기
    </button>
  </div>
) : (
  <div className="rounded-xl border p-4">
    <p className="mb-2 font-medium">마일스톤 추가</p>
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        className="flex-1 rounded-lg border p-3"
        placeholder="마일스톤 제목"
        value={milestoneTitle}
        onChange={(e) => setMilestoneTitle(e.target.value)}
      />
      <input
        className="rounded-lg border p-3"
        type="date"
        value={milestoneDue}
        onChange={(e) => setMilestoneDue(e.target.value)}
      />
      <button className="rounded-lg border px-4 py-2" onClick={addDraftMilestone}>
        + 추가
      </button>
    </div>
    <ul className="mt-3 space-y-1 text-sm text-gray-700">
      {draftMilestones.map((m, index) => (
        <li key={`${m.title}-${index}`}>- {m.title} ({m.due_date})</li>
      ))}
    </ul>
    <button className="mt-3 w-full rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleSubmit}>
      로드맵 만들기
    </button>
  </div>
)}
```

이 JSX는 Task 8에서 만든 `milestoneTitle`/`milestoneDue`/`draftMilestones`/`addDraftMilestone`/`handleSubmit`
state와 함수를 그대로 재사용한다 (같은 파일 안이므로 이미 스코프에 있다).

- [ ] **Step 2: 수동 확인**

Run: `backend/`에서 `uvicorn app.main:app --reload` (Task 16 참고), 프론트엔드
`.env.local`에 `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` 넣고 `npm run dev` →
"AI가 만들어줘" 선택 후 목표를 입력해 제출 → 로드맵 상세로 이동하며 AI가 만든
마일스톤들이 보이는지 확인. `NEXT_PUBLIC_BACKEND_URL`을 일시적으로 틀리게 바꿔
실패를 재현했을 때 수동 입력 폼으로 폴백되는지도 확인

- [ ] **Step 3: 커밋**

```bash
git add app/roadmap/create/page.tsx
git commit -m "feat: wire AI roadmap generation into create page with manual fallback"
```

---

### Task 18: FastAPI 스케줄 작업 `check-coaching` — 지연 감지 + Web Push 코칭 발송

**Files:**
- Create: `backend/app/check_coaching_select.py`
- Create: `backend/app/check_coaching.py`
- Create: `backend/tests/test_check_coaching.py`
- Modify: `backend/app/main.py` (Task 16에서 만든 파일 — APScheduler로 이 작업을
  매일 09:00에 등록하고, 수동 테스트용 트리거 엔드포인트도 하나 둔다)

**Interfaces:**
- Consumes: `notification_settings.push_subscription` (Task 2)
- Produces: `select_overdue_milestones(milestones, now) -> list[MilestoneForCoaching]`,
  `build_coaching_prompt(milestone) -> str`, `run_check_coaching() -> int`
  (처리한 지연 마일스톤 개수를 반환하는 async 함수 — 스케줄러와 수동 트리거
  엔드포인트가 둘 다 이 함수를 호출한다)

- [ ] **Step 1: 실패하는 테스트를 작성한다** (Deno 버전의 3개 케이스를 그대로 이식)

```python
# backend/tests/test_check_coaching.py
from dataclasses import replace
from datetime import datetime

from app.check_coaching_select import (
    MilestoneForCoaching,
    build_coaching_prompt,
    select_overdue_milestones,
)

BASE = MilestoneForCoaching(
    id="m1", roadmap_id="r1", user_id="u1", title="5km 완주", due_date="2026-01-01", status="pending"
)


def test_selects_milestones_past_due_date_that_are_not_done():
    done = replace(BASE, id="m2", status="done")
    result = select_overdue_milestones([BASE, done], datetime(2026, 2, 1))
    assert result == [BASE]


def test_excludes_milestones_whose_due_date_is_still_in_the_future():
    future = replace(BASE, due_date="2027-01-01")
    result = select_overdue_milestones([future], datetime(2026, 2, 1))
    assert result == []


def test_build_coaching_prompt_includes_the_milestone_title():
    prompt = build_coaching_prompt(BASE)
    assert "5km 완주" in prompt
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && . .venv/bin/activate && python -m pytest tests/test_check_coaching.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.check_coaching_select'"

- [ ] **Step 3: 순수 함수를 구현한다** (Deno 버전의 `select.ts`에 대응)

```python
# backend/app/check_coaching_select.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class MilestoneForCoaching:
    id: str
    roadmap_id: str
    user_id: str
    title: str
    due_date: str
    status: str


def select_overdue_milestones(
    milestones: list[MilestoneForCoaching], now: datetime
) -> list[MilestoneForCoaching]:
    return [m for m in milestones if m.status != "done" and datetime.fromisoformat(m.due_date) < now]


def build_coaching_prompt(milestone: MilestoneForCoaching) -> str:
    return (
        f'사용자가 "{milestone.title}" 마일스톤의 마감일을 놓쳤어. 비난하지 않는 '
        "따뜻한 톤으로, 2문장 이내의 격려 메시지를 만들어줘. 메시지 텍스트만 응답해."
    )
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd backend && . .venv/bin/activate && python -m pytest tests/test_check_coaching.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: 실제 작업 함수를 작성한다** (Deno 버전의 `index.ts`에 대응. Web Push
발송에는 `pywebpush`를 쓴다)

```python
# backend/app/check_coaching.py
from __future__ import annotations

import json
import os
from datetime import date, datetime

import httpx
from pywebpush import WebPushException, webpush
from supabase import create_client

from .check_coaching_select import (
    MilestoneForCoaching,
    build_coaching_prompt,
    select_overdue_milestones,
)

GEMINI_MODEL = "gemini-2.5-flash"


async def run_check_coaching() -> int:
    gemini_api_key = os.environ["GEMINI_API_KEY"]
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    vapid_private_key = os.environ["VAPID_PRIVATE_KEY"]
    vapid_subject = os.environ["VAPID_SUBJECT"]

    supabase = create_client(supabase_url, supabase_service_role_key)

    rows = (
        supabase.table("milestones")
        .select("id, roadmap_id, title, due_date, status, roadmaps!inner(user_id)")
        .neq("status", "done")
        .execute()
    ).data

    normalized = [
        MilestoneForCoaching(
            id=row["id"],
            roadmap_id=row["roadmap_id"],
            user_id=row["roadmaps"]["user_id"],
            title=row["title"],
            due_date=row["due_date"],
            status=row["status"],
        )
        for row in rows
    ]

    overdue = select_overdue_milestones(normalized, datetime.now())

    async with httpx.AsyncClient() as client:
        for milestone in overdue:
            existing = (
                supabase.table("coaching_messages")
                .select("id")
                .eq("roadmap_id", milestone.roadmap_id)
                .eq("trigger_type", "delay")
                .gte("created_at", date.today().isoformat())
                .execute()
            ).data
            if existing:
                continue

            ai_response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                params={"key": gemini_api_key},
                json={
                    "contents": [{"parts": [{"text": build_coaching_prompt(milestone)}]}],
                    "generationConfig": {"maxOutputTokens": 256},
                },
            )
            if ai_response.status_code != 200:
                continue
            ai_json = ai_response.json()
            message = (
                ai_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
                or "마일스톤 마감일이 지났어요. 다시 시작해볼까요?"
            )

            supabase.table("coaching_messages").insert(
                {
                    "user_id": milestone.user_id,
                    "roadmap_id": milestone.roadmap_id,
                    "trigger_type": "delay",
                    "message": message,
                }
            ).execute()

            settings_rows = (
                supabase.table("notification_settings")
                .select("reminder_enabled, push_subscription")
                .eq("user_id", milestone.user_id)
                .execute()
            ).data
            settings = settings_rows[0] if settings_rows else None
            if settings and settings.get("reminder_enabled") and settings.get("push_subscription"):
                try:
                    webpush(
                        subscription_info=settings["push_subscription"],
                        data=json.dumps({"title": "로드맵 코칭", "body": message}),
                        vapid_private_key=vapid_private_key,
                        vapid_claims={"sub": vapid_subject},
                    )
                except WebPushException:
                    # 구독이 만료됐을 수 있음 - MVP 범위에서는 무시하고 다음 실행에서 재시도
                    pass

    return len(overdue)
```

- [ ] **Step 6: `main.py`에 스케줄 등록과 수동 트리거 엔드포인트를 추가한다**
(Supabase의 `functions schedule --cron` 대신, 백엔드 프로세스 안에서 APScheduler로
직접 스케줄링한다)

```python
# backend/app/main.py — 전체를 아래로 교체
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .check_coaching import run_check_coaching
from .generate_roadmap import router as generate_roadmap_router

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(run_check_coaching, CronTrigger(hour=9, minute=0), id="check-coaching")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="goal-roadmap-app backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_roadmap_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/check-coaching")
async def trigger_check_coaching() -> dict[str, int]:
    processed = await run_check_coaching()
    return {"processed": processed}
```

`/internal/check-coaching`은 Supabase CLI의 `supabase functions invoke check-coaching`를
대신하는 수동 실행용 엔드포인트다 — 스케줄이 돌 때까지 기다리지 않고 바로 테스트할
수 있다. 프론트엔드는 이 경로를 호출하지 않는다.

- [ ] **Step 7: 수동 확인**

Run: 마감일을 과거로 설정한 마일스톤을 만든 뒤, `cd backend && . .venv/bin/activate &&
GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=... uvicorn app.main:app --reload`로 띄우고
`curl -X POST http://localhost:8000/internal/check-coaching` 호출 → `coaching_messages`에
행이 생기고, 구독된 브라우저에 Web Push 알림이 오는지 확인. 하루 지나 다시 호출해도
같은 지연 건에 중복 메시지가 안 쌓이는지도 확인(`trigger_type`+오늘 날짜로 이미
있으면 건너뜀)

- [ ] **Step 8: 커밋**

```bash
git add backend/
git commit -m "feat: add scheduled coaching job (FastAPI + APScheduler) with web push"
```

---

### Task 19: FastAPI 스케줄 작업 `send-reminders` — 마감일 임박 알림 + 체크인 유도 알림

**Files:**
- Create: `backend/app/send_reminders_schedule.py`
- Create: `backend/app/send_reminders.py`
- Create: `backend/tests/test_send_reminders.py`
- Modify: `backend/app/main.py` (Task 16/18에서 만든 파일 — APScheduler로 이 작업을
  15분마다 등록하고, 수동 테스트용 트리거 엔드포인트도 하나 둔다)

**Interfaces:**
- Produces: `is_reminder_due(reminder_time, now, window_minutes) -> bool`,
  `select_milestones_due_tomorrow(milestones, now) -> list[MilestoneDueSoon]`,
  `run_send_reminders() -> int` (발송한 알림 개수를 반환하는 async 함수)

- [ ] **Step 1: 실패하는 테스트를 작성한다** (Deno 버전의 3개 케이스를 그대로 이식)

```python
# backend/tests/test_send_reminders.py
from datetime import datetime

from app.send_reminders_schedule import is_reminder_due


def test_is_due_when_now_falls_inside_the_reminder_window():
    assert is_reminder_due("09:00", datetime(2026, 9, 7, 9, 5), 15) is True


def test_is_not_due_before_the_reminder_time():
    assert is_reminder_due("09:00", datetime(2026, 9, 7, 8, 59), 15) is False


def test_is_not_due_after_the_window_has_passed():
    assert is_reminder_due("09:00", datetime(2026, 9, 7, 9, 20), 15) is False
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && . .venv/bin/activate && python -m pytest tests/test_send_reminders.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.send_reminders_schedule'"

- [ ] **Step 3: `is_reminder_due`를 구현한다**

```python
# backend/app/send_reminders_schedule.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


def is_reminder_due(reminder_time: str, now: datetime, window_minutes: int) -> bool:
    hours, minutes = (int(part) for part in reminder_time.split(":"))
    reminder_minutes_of_day = hours * 60 + minutes
    now_minutes_of_day = now.hour * 60 + now.minute
    return reminder_minutes_of_day <= now_minutes_of_day < reminder_minutes_of_day + window_minutes
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd backend && . .venv/bin/activate && python -m pytest tests/test_send_reminders.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: `select_milestones_due_tomorrow`에 대한 실패하는 테스트를 추가한다**
(스펙 기능 7번의 "마감일 임박 알림" — 내일 마감인 미완료 마일스톤을 골라낸다)

```python
# backend/tests/test_send_reminders.py 에 추가
from app.send_reminders_schedule import MilestoneDueSoon, select_milestones_due_tomorrow


def test_selects_a_milestone_whose_due_date_is_exactly_tomorrow():
    m = MilestoneDueSoon(id="m1", title="5km 완주", due_date="2026-09-08", status="pending")
    result = select_milestones_due_tomorrow([m], datetime(2026, 9, 7, 9, 0))
    assert result == [m]


def test_excludes_a_milestone_that_is_already_done():
    m = MilestoneDueSoon(id="m1", title="5km 완주", due_date="2026-09-08", status="done")
    result = select_milestones_due_tomorrow([m], datetime(2026, 9, 7, 9, 0))
    assert result == []


def test_excludes_a_milestone_due_further_out_than_tomorrow():
    m = MilestoneDueSoon(id="m1", title="5km 완주", due_date="2026-09-10", status="pending")
    result = select_milestones_due_tomorrow([m], datetime(2026, 9, 7, 9, 0))
    assert result == []
```

- [ ] **Step 6: 테스트 실행 → 실패 확인**

Run: `cd backend && . .venv/bin/activate && python -m pytest tests/test_send_reminders.py -v`
Expected: FAIL — `MilestoneDueSoon`/`select_milestones_due_tomorrow`를 import할 수 없음

- [ ] **Step 7: `select_milestones_due_tomorrow`를 구현한다**

```python
# backend/app/send_reminders_schedule.py 에 추가
@dataclass
class MilestoneDueSoon:
    id: str
    title: str
    due_date: str
    status: str


def select_milestones_due_tomorrow(
    milestones: list[MilestoneDueSoon], now: datetime
) -> list[MilestoneDueSoon]:
    tomorrow = (now.date() + timedelta(days=1)).isoformat()
    return [m for m in milestones if m.status != "done" and m.due_date == tomorrow]
```

- [ ] **Step 8: 테스트 실행 → 통과 확인**

Run: `cd backend && . .venv/bin/activate && python -m pytest tests/test_send_reminders.py -v`
Expected: PASS (6 tests total)

- [ ] **Step 9: 실제 작업 함수를 작성한다** (15분마다 실행되어, 리마인더 시간
창에 들어온 사용자에게 두 알림을 함께 확인해서 보낸다: (a) 내일 마감인 미완료
마일스톤이 있으면 "마감일 임박", (b) 오늘 아직 체크인하지 않았으면 "체크인 유도")

```python
# backend/app/send_reminders.py
from __future__ import annotations

import json
import os
from datetime import date, datetime

from pywebpush import WebPushException, webpush
from supabase import create_client

from .send_reminders_schedule import (
    MilestoneDueSoon,
    is_reminder_due,
    select_milestones_due_tomorrow,
)


async def run_send_reminders() -> int:
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    vapid_private_key = os.environ["VAPID_PRIVATE_KEY"]
    vapid_subject = os.environ["VAPID_SUBJECT"]

    supabase = create_client(supabase_url, supabase_service_role_key)
    now = datetime.now()
    today_str = date.today().isoformat()

    settings_rows = (
        supabase.table("notification_settings")
        .select("user_id, reminder_time, push_subscription")
        .eq("reminder_enabled", True)
        .execute()
    ).data

    due = [
        row
        for row in settings_rows
        if is_reminder_due(row["reminder_time"], now, 15) and row.get("push_subscription")
    ]

    sent = 0
    for row in due:
        # (a) 마감일 임박: 내일 마감인 이 사용자의 미완료 마일스톤이 있으면 알림
        user_milestones = (
            supabase.table("milestones")
            .select("id, title, due_date, status, roadmaps!inner(user_id)")
            .eq("roadmaps.user_id", row["user_id"])
            .neq("status", "done")
            .execute()
        ).data
        due_soon = select_milestones_due_tomorrow(
            [
                MilestoneDueSoon(id=m["id"], title=m["title"], due_date=m["due_date"], status=m["status"])
                for m in user_milestones
            ],
            now,
        )
        if due_soon:
            try:
                webpush(
                    subscription_info=row["push_subscription"],
                    data=json.dumps(
                        {
                            "title": "마감일 임박",
                            "body": f'"{due_soon[0].title}" 마감이 내일이에요. 오늘 마무리해볼까요?',
                        }
                    ),
                    vapid_private_key=vapid_private_key,
                    vapid_claims={"sub": vapid_subject},
                )
                sent += 1
            except WebPushException:
                pass  # 구독 만료 등 - MVP 범위에서는 무시

        # (b) 체크인 유도: 오늘 아직 체크인하지 않았으면 알림
        checkin_rows = (
            supabase.table("habit_checkins")
            .select("id")
            .eq("user_id", row["user_id"])
            .eq("checkin_date", today_str)
            .execute()
        ).data
        if checkin_rows:
            continue
        try:
            webpush(
                subscription_info=row["push_subscription"],
                data=json.dumps({"title": "오늘의 체크인", "body": "오늘 목표를 향해 한 걸음 나아가볼까요?"}),
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_subject},
            )
            sent += 1
        except WebPushException:
            pass  # 구독 만료 등 - MVP 범위에서는 무시

    return sent
```

- [ ] **Step 10: `main.py`에 스케줄 등록과 수동 트리거 엔드포인트를 추가한다**

```python
# backend/app/main.py — import에 추가
from apscheduler.triggers.interval import IntervalTrigger

from .send_reminders import run_send_reminders
```

```python
# backend/app/main.py — lifespan() 안, check-coaching 등록 다음 줄에 추가
    scheduler.add_job(run_send_reminders, IntervalTrigger(minutes=15), id="send-reminders")
```

```python
# backend/app/main.py — 맨 아래에 추가
@app.post("/internal/send-reminders")
async def trigger_send_reminders() -> dict[str, int]:
    sent = await run_send_reminders()
    return {"sent": sent}
```

`/internal/send-reminders`도 `/internal/check-coaching`과 같은 이유로 둔 수동
테스트용 엔드포인트다 — 프론트엔드는 호출하지 않는다.

- [ ] **Step 11: 수동 확인**

Run: (1) 마감일을 내일로 설정한 미완료 마일스톤을 만든 뒤 `curl -X POST
http://localhost:8000/internal/send-reminders`를 호출해 "마감일 임박" 알림이
오는지, (2) `notification_settings.reminder_time`을 현재 시각 근처로 설정한 뒤
오늘 체크인하지 않은 계정에만 "오늘의 체크인" 알림이 오고 이미 체크인한 계정은
건너뛰는지 확인

- [ ] **Step 12: 커밋**

```bash
git add backend/
git commit -m "feat: add scheduled deadline and check-in reminder job (FastAPI + APScheduler)"
```

---

### Task 20: 코칭 메시지 조회/읽음 처리 + 메시지함 페이지

**Files:**
- Create: `lib/coaching.ts`
- Create: `app/(dashboard)/coaching/page.tsx`
- Test: `__tests__/coaching.test.ts`

**Interfaces:**
- Consumes: `CoachingMessage` (Task 2), `makeFakeClient` (Task 5), `useRequireAuth` (Task 3)
- Produces: `listMessages(client, userId): Promise<CoachingMessageWithRoadmap[]>`
  (`CoachingMessageWithRoadmap`는 `CoachingMessage`에 `roadmap_title: string`을 더한
  타입 — 목업의 메시지함 화면이 각 메시지 아래에 "어느 로드맵" 메시지인지
  제목을 같이 보여주는데, `coaching_messages`만 조회하면 `roadmap_id`만 있고
  제목이 없어서 추가했다. `coaching_messages.roadmap_id`는 `roadmaps.id`를 직접
  참조하는 FK라 — 커뮤니티/리더보드 때의 `profiles`/`roadmaps`와 달리 — PostgREST가
  `roadmaps(title)`로 한 번에 묶어 가져와준다), `markRead(client, messageId): Promise<void>`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/coaching.test.ts
import { listMessages, markRead } from '../lib/coaching';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('listMessages returns rows ordered by newest first, flattened with the roadmap title', async () => {
  const rows = [
    { id: 'c2', roadmap_id: 'r2', message: '두 번째', created_at: '2026-09-07T00:00:00Z', read_at: null, roadmaps: { title: '정보처리기사 자격증' } },
    { id: 'c1', roadmap_id: 'r1', message: '첫 번째', created_at: '2026-09-06T00:00:00Z', read_at: null, roadmaps: { title: '10km 마라톤 완주하기' } },
  ];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listMessages(client, 'u1');
  expect(result).toEqual([
    { id: 'c2', roadmap_id: 'r2', message: '두 번째', created_at: '2026-09-07T00:00:00Z', read_at: null, roadmap_title: '정보처리기사 자격증' },
    { id: 'c1', roadmap_id: 'r1', message: '첫 번째', created_at: '2026-09-06T00:00:00Z', read_at: null, roadmap_title: '10km 마라톤 완주하기' },
  ]);
});

test('listMessages returns an empty array when data is null', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  expect(await listMessages(client, 'u1')).toEqual([]);
});

test('markRead updates read_at and throws on error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('update failed') }]);
  await expect(markRead(client, 'c1')).rejects.toThrow('update failed');
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest coaching.test.ts`
Expected: FAIL with "Cannot find module '../lib/coaching'"

- [ ] **Step 3: 구현한다**

```ts
// lib/coaching.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoachingMessage } from '../types/models';

export interface CoachingMessageWithRoadmap extends CoachingMessage {
  roadmap_title: string;
}

export async function listMessages(client: SupabaseClient, userId: string): Promise<CoachingMessageWithRoadmap[]> {
  const { data, error } = await client
    .from('coaching_messages')
    .select('*, roadmaps(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const { roadmaps, ...rest } = row;
    return { ...rest, roadmap_title: roadmaps?.title ?? '' } as CoachingMessageWithRoadmap;
  });
}

export async function markRead(client: SupabaseClient, messageId: string): Promise<void> {
  const { error } = await client
    .from('coaching_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest coaching.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 메시지함 페이지를 구현한다**

```tsx
// app/(dashboard)/coaching/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listMessages, markRead, CoachingMessageWithRoadmap } from '../../../lib/coaching';

export default function CoachingInboxPage() {
  const userId = useRequireAuth();
  const [messages, setMessages] = useState<CoachingMessageWithRoadmap[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setMessages(await listMessages(supabase, userId));
    }
    load();
  }, [userId]);

  async function handleOpen(message: CoachingMessageWithRoadmap) {
    if (message.read_at) return;
    await markRead(supabase, message.id);
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, read_at: new Date().toISOString() } : m)));
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">AI 코칭</h1>
      <ul className="mt-4 space-y-2">
        {messages.map((item) => (
          <li key={item.id}>
            <button
              className={`w-full rounded-xl border p-3 text-left ${item.read_at ? 'opacity-60' : ''}`}
              onClick={() => handleOpen(item)}
            >
              <p>{item.message}</p>
              <p className="text-xs text-gray-500">
                {item.created_at} · {item.roadmap_title}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → Task 18/19에서 발송된 코칭 메시지가 메시지함에 보이고, 클릭하면
읽음 처리(옅어짐)되는지, 좁은/넓은 화면 모두에서 레이아웃이 깨지지 않는지 확인

- [ ] **Step 7: 커밋**

```bash
git add lib/coaching.ts __tests__/coaching.test.ts app/\(dashboard\)/coaching/page.tsx
git commit -m "feat: add coaching inbox page with joined roadmap title"
```

---

## 커뮤니티 기능 (로드맵 공개 공유 / 하이파이브 / 리더보드)

Task 1~20으로 핵심 MVP가 끝난 뒤 추가하는 확장 기능. "혼자 쓰는 투두리스트" 느낌을
벗어나기 위한 세 가지: (10) 로드맵 공개 공유, (11) 마일스톤 하이파이브 응원,
(12) 스트릭 리더보드 — 스펙의 주요 기능 10~12번, 화면 구성 9~10번에 대응한다.

---

### Task 21: 커뮤니티 기능 DB 스키마 (profiles, roadmaps.is_public, milestone_reactions)

**Files:**
- Create: `supabase/migrations/0002_community.sql`
- Modify: `types/models.ts` (Task 2에서 만든 파일 — `Roadmap`에 `is_public` 추가,
  `Profile`/`MilestoneReaction` 타입 신설)

**Interfaces:**
- Consumes: Task 2의 `roadmaps`/`milestones`/`notification_settings` 테이블과
  `handle_new_user` 트리거 함수
- Produces: 테이블 `profiles`, `milestone_reactions`; `roadmaps.is_public` 컬럼.
  TS 타입 `Profile`, `MilestoneReaction`; `Roadmap`에 `is_public: boolean` 추가.

- [ ] **Step 1: 마이그레이션 SQL을 작성한다**

```sql
-- supabase/migrations/0002_community.sql
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
```

- [ ] **Step 2: 마이그레이션을 적용한다**

Run: `supabase db reset`
Expected: 에러 없이 적용됨

- [ ] **Step 3: 테이블/컬럼이 생겼는지 확인한다**

Run:
```bash
psql "$DATABASE_URL" -c "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('profiles','milestone_reactions');"
psql "$DATABASE_URL" -c "select column_name from information_schema.columns where table_name = 'roadmaps' and column_name = 'is_public';"
```
Expected: 두 테이블과 `is_public` 컬럼이 각각 출력됨

- [ ] **Step 4: 새 회원가입 시 프로필도 자동 생성되는지 확인한다**

Supabase Studio에서 테스트 계정으로 가입한 뒤:
```bash
psql "$DATABASE_URL" -c "select display_name, show_on_leaderboard from public.profiles order by created_at desc limit 1;"
```
Expected: 방금 가입한 이메일의 `@` 앞부분이 `display_name`으로 들어가 있고
`show_on_leaderboard`는 `false`

- [ ] **Step 5: 타입을 갱신한다**

```ts
// types/models.ts — Roadmap 인터페이스에 필드 추가
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
```

```ts
// types/models.ts 맨 아래에 추가
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
```

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/0002_community.sql types/models.ts
git commit -m "feat: add community schema (profiles, public roadmaps, milestone reactions)"
```

---

### Task 22: 프로필 CRUD + 설정 화면에 닉네임/리더보드 표시 추가

**Files:**
- Create: `lib/profiles.ts`
- Modify: `app/(dashboard)/settings/page.tsx` (Task 14에서 만든 파일)
- Test: `__tests__/profiles.test.ts`

**Interfaces:**
- Consumes: `Profile` (Task 21), `makeFakeClient` (Task 5)
- Produces: `getProfile(client, userId): Promise<Profile>`,
  `updateProfile(client, userId, patch): Promise<Profile>`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/profiles.test.ts
import { getProfile, updateProfile } from '../lib/profiles';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('getProfile returns the row for a user', async () => {
  const row = { id: 'p1', user_id: 'u1', display_name: 'yoon', show_on_leaderboard: false };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await getProfile(client, 'u1');
  expect(result).toEqual(row);
});

test('updateProfile applies a partial patch and returns the updated row', async () => {
  const row = { id: 'p1', user_id: 'u1', display_name: '새닉네임', show_on_leaderboard: true };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await updateProfile(client, 'u1', { display_name: '새닉네임', show_on_leaderboard: true });
  expect(result).toEqual(row);
});

test('updateProfile throws when supabase returns an error', async () => {
  const client = makeFakeClient([{ data: null, error: new Error('update failed') }]);
  await expect(updateProfile(client, 'u1', { display_name: 'x' })).rejects.toThrow('update failed');
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest profiles.test.ts`
Expected: FAIL with "Cannot find module '../lib/profiles'"

- [ ] **Step 3: 구현한다**

```ts
// lib/profiles.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../types/models';

export async function getProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client.from('profiles').select('*').eq('user_id', userId).single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  client: SupabaseClient,
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'show_on_leaderboard'>>
): Promise<Profile> {
  const { data, error } = await client.from('profiles').update(patch).eq('user_id', userId).select().single();
  if (error) throw error;
  return data as Profile;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest profiles.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 설정 화면에 닉네임/리더보드 표시 항목을 추가한다**

```tsx
// app/(dashboard)/settings/page.tsx — import에 추가
import { getProfile, updateProfile } from '../../../lib/profiles';
```

```tsx
// 컴포넌트 안에 state 추가
const [displayName, setDisplayName] = useState('');
const [showOnLeaderboard, setShowOnLeaderboard] = useState(false);
```

Task 14의 `useEffect` 안 `.then(({ data }) => {...})` 콜백은 `async`가 아니라서
그 안에서 바로 `await getProfile(...)`를 쓸 수 없다. 콜백 전체를 아래 `async` 버전으로
교체한다(`.then(async ({ data }) => {...})`):

```tsx
// app/(dashboard)/settings/page.tsx — 기존 useEffect의 .then(...) 콜백을 통째로 교체
useEffect(() => {
  if (!userId) return;
  supabase
    .from('notification_settings')
    .select('reminder_enabled, reminder_time')
    .eq('user_id', userId)
    .single()
    .then(async ({ data }) => {
      const settings = data as Pick<NotificationSettings, 'reminder_enabled' | 'reminder_time'> | null;
      if (settings) {
        setReminderEnabled(settings.reminder_enabled);
        setReminderTime(settings.reminder_time.slice(0, 5));
      }
      const profile = await getProfile(supabase, userId);
      setDisplayName(profile.display_name);
      setShowOnLeaderboard(profile.show_on_leaderboard);
      setLoaded(true);
    });
}, [userId]);
```

```tsx
// 컴포넌트 안에 핸들러 추가
async function handleDisplayNameChange(value: string) {
  setDisplayName(value);
  if (!userId) return;
  await updateProfile(supabase, userId, { display_name: value });
}

async function handleShowOnLeaderboardChange(value: boolean) {
  setShowOnLeaderboard(value);
  if (!userId) return;
  await updateProfile(supabase, userId, { show_on_leaderboard: value });
}
```

```tsx
{/* 로그아웃 버튼 위, "계정" 카드 안에 추가 */}
<div className="flex flex-col gap-2">
  <label className="text-sm text-gray-600" htmlFor="display-name">
    닉네임 (리더보드/공개 화면에 표시)
  </label>
  <input
    id="display-name"
    className="rounded-lg border p-2"
    value={displayName}
    onChange={(e) => handleDisplayNameChange(e.target.value)}
  />
</div>
<label className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={showOnLeaderboard}
    onChange={(e) => handleShowOnLeaderboardChange(e.target.checked)}
  />
  리더보드에 표시
</label>
```

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → 설정 페이지에 가입 시 자동 생성된 닉네임(이메일 앞부분)이
보이는지, 닉네임을 바꾸고 새로고침해도 유지되는지, "리더보드에 표시"를 켜면
`profiles.show_on_leaderboard`가 `true`로 바뀌는지 확인

- [ ] **Step 7: 커밋**

```bash
git add lib/profiles.ts __tests__/profiles.test.ts app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add profile CRUD and nickname/leaderboard settings"
```

---

### Task 23: 로드맵 공개 전환 + 공개 로드맵 보기 페이지

**Files:**
- Modify: `lib/roadmaps.ts` (Task 5에서 만든 파일에 함수를 추가한다)
- Modify: `lib/milestones.ts` (Task 6에서 만든 파일에 함수를 추가한다)
- Modify: `app/roadmap/[id]/page.tsx` (Task 9/11에서 만든 파일 — 공개 전환 토글 추가)
- Create: `app/r/[id]/page.tsx`
- Test: `__tests__/roadmaps.test.ts`, `__tests__/milestones.test.ts` (Task 5/6에서
  만든 파일에 케이스를 추가한다)

**Interfaces:**
- Consumes: `calculateProgress`, `milestoneStatus` (Task 4), `computeNodePositions` (Task 11)
- Produces: `setRoadmapPublic(client, roadmapId, isPublic): Promise<void>`,
  `getPublicRoadmap(client, roadmapId): Promise<Pick<Roadmap,'id'|'title'>>`,
  `listPublicMilestones(client, roadmapId): Promise<Pick<Milestone,'id'|'title'|'due_date'|'order_index'|'status'>[]>`

공개 페이지는 일부러 기존 `getRoadmap`/`listMilestones`(둘 다 `select('*')`)를
쓰지 않는다 — 그 함수들은 로드맵 설명·마일스톤 메모까지 통째로 클라이언트에
내려보내는데, 화면엔 제목/마감일만 그려도 브라우저 네트워크 응답에는 그 개인
메모가 그대로 담겨 나간다("공개"로 표시 안 한 내용까지 개발자 도구로 보이는
셈). 그래서 공개 화면 전용으로 필요한 컬럼만 딱 골라 가져오는 별도 함수를 둔다.

- [ ] **Step 1: 실패하는 테스트를 추가한다**

```ts
// __tests__/roadmaps.test.ts 에 추가
import { setRoadmapPublic, getPublicRoadmap } from '../lib/roadmaps';

test('setRoadmapPublic updates the is_public flag', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  await setRoadmapPublic(client, 'r1', true);
  expect(client.from).toHaveBeenCalledWith('roadmaps');
});

test('getPublicRoadmap only returns id and title', async () => {
  const row = { id: 'r1', title: 'Test' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await getPublicRoadmap(client, 'r1');
  expect(result).toEqual(row);
});
```

```ts
// __tests__/milestones.test.ts 에 추가
import { listPublicMilestones } from '../lib/milestones';

test('listPublicMilestones returns only the public-safe columns', async () => {
  const rows = [{ id: 'm1', title: '1km 완주', due_date: '2026-10-01', order_index: 0, status: 'pending' }];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listPublicMilestones(client, 'r1');
  expect(result).toEqual(rows);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest roadmaps.test.ts milestones.test.ts`
Expected: FAIL — `setRoadmapPublic`/`getPublicRoadmap`/`listPublicMilestones` are not functions

- [ ] **Step 3: 구현한다**

```ts
// lib/roadmaps.ts 에 추가
export async function setRoadmapPublic(client: SupabaseClient, roadmapId: string, isPublic: boolean): Promise<void> {
  const { error } = await client.from('roadmaps').update({ is_public: isPublic }).eq('id', roadmapId);
  if (error) throw error;
}

// 공개 화면 전용 — description/user_id 등 개인 정보가 담긴 컬럼은 아예
// select하지 않는다. UI가 안 그린다고 안전한 게 아니라, 네트워크 응답에
// 애초에 안 실려야 안전하다.
export async function getPublicRoadmap(client: SupabaseClient, roadmapId: string): Promise<Pick<Roadmap, 'id' | 'title'>> {
  const { data, error } = await client.from('roadmaps').select('id, title').eq('id', roadmapId).single();
  if (error) throw error;
  return data as Pick<Roadmap, 'id' | 'title'>;
}
```

```ts
// lib/milestones.ts 에 추가
// 공개 화면 전용 — description(개인 메모)과 roadmap_id는 select하지 않는다.
export async function listPublicMilestones(
  client: SupabaseClient,
  roadmapId: string
): Promise<Pick<Milestone, 'id' | 'title' | 'due_date' | 'order_index' | 'status'>[]> {
  const { data, error } = await client
    .from('milestones')
    .select('id, title, due_date, order_index, status')
    .eq('roadmap_id', roadmapId)
    .order('due_date', { ascending: true })
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Pick<Milestone, 'id' | 'title' | 'due_date' | 'order_index' | 'status'>[];
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest roadmaps.test.ts milestones.test.ts`
Expected: `roadmaps.test.ts` PASS (12 tests — 10 from before + 2 new),
`milestones.test.ts` PASS (7 tests — 6 from before + 1 new)

- [ ] **Step 5: 로드맵 상세 페이지에 공개 전환 토글과 복사 가능한 공유 링크를 추가한다**

```tsx
// app/roadmap/[id]/page.tsx — import에 추가
import { setRoadmapPublic } from '../../../lib/roadmaps';
import { useState } from 'react'; // 이미 import돼 있다면 생략
```

```tsx
// 컴포넌트 안에 state/핸들러 추가
const [linkCopied, setLinkCopied] = useState(false);

async function handleTogglePublic(checked: boolean) {
  if (!id) return;
  await setRoadmapPublic(supabase, id, checked);
  await load();
}

async function handleCopyLink() {
  if (!id) return;
  await navigator.clipboard.writeText(`${window.location.origin}/r/${id}`);
  setLinkCopied(true);
  setTimeout(() => setLinkCopied(false), 2000);
}
```

```tsx
{/* 헤더의 삭제 버튼 아래, 진행률 카드 위에 추가 */}
<div className="rounded-xl border p-3 text-sm">
  <label className="flex items-center justify-between">
    <span>공개 링크로 공유</span>
    <input type="checkbox" checked={roadmap.is_public} onChange={(e) => handleTogglePublic(e.target.checked)} />
  </label>
  {roadmap.is_public && (
    <div className="mt-2 flex items-center gap-2">
      <input
        readOnly
        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${id}`}
        className="flex-1 rounded-lg border bg-gray-50 p-2 text-xs text-gray-600"
        onFocus={(e) => e.target.select()}
      />
      <button className="rounded-lg border px-3 py-2 text-xs" onClick={handleCopyLink}>
        {linkCopied ? '복사됨' : '복사'}
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 6: 공개 로드맵 보기 페이지를 만든다** (로그인 여부와 무관하게
접근 가능 — `useRequireAuth`를 쓰지 않는다. 편집/삭제/추가 UI는 전혀 없고,
`getPublicRoadmap`/`listPublicMilestones`로 공개 화면에 필요한 컬럼만 가져온다)

```tsx
// app/r/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getPublicRoadmap } from '../../../lib/roadmaps';
import { listPublicMilestones } from '../../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../../lib/progress';
import { computeNodePositions } from '../../../lib/timeline';
import type { Roadmap, Milestone } from '../../../types/models';

type PublicRoadmap = Pick<Roadmap, 'id' | 'title'>;
type PublicMilestone = Pick<Milestone, 'id' | 'title' | 'due_date' | 'order_index' | 'status'>;

export default function PublicRoadmapPage() {
  const { id } = useParams<{ id: string }>();
  const [roadmap, setRoadmap] = useState<PublicRoadmap | null>(null);
  const [milestones, setMilestones] = useState<PublicMilestone[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPublicRoadmap(supabase, id)
      .then(async (r) => {
        setRoadmap(r);
        setMilestones(await listPublicMilestones(supabase, id));
      })
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-gray-600">
        찾을 수 없거나 비공개인 로드맵이에요.
      </div>
    );
  }
  if (!roadmap) return null;

  const progress = calculateProgress(milestones);
  const now = new Date();
  const positions = computeNodePositions(milestones.length);
  const pathHeight = 40 + milestones.length * 140 + 100;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">{roadmap.title}</h1>
      <p className="text-sm text-gray-600">
        전체 진행률 {progress.percent}% ({progress.completedCount}/{progress.totalCount})
      </p>
      <div className="relative mt-4" style={{ height: pathHeight }}>
        {milestones.map((milestone, index) => {
          const pos = positions[index];
          const status = milestoneStatus(milestone, now);
          return (
            <div
              key={milestone.id}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-1 text-center"
              style={{ left: `${pos.xPercent * 100}%`, top: pos.y }}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full font-semibold text-white ${
                  status === 'done' ? 'bg-green-500' : status === 'overdue' ? 'bg-red-500' : 'bg-gray-200 !text-gray-700'
                }`}
              >
                {index + 1}
              </div>
              <span className="text-sm font-medium">{milestone.title}</span>
              <span className="text-xs text-gray-500">{milestone.due_date}</span>
              {/* 하이파이브 버튼은 Task 24에서 이 자리에 추가한다 */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

`getPublicRoadmap`이 RLS에 막혀 에러를 던지면(비공개거나 없는 id) `catch`에서
`notFound`로 처리한다 — Task 21의 `roadmaps_public_read` 정책 덕분에, 소유자가
아니어도 `is_public = true`인 로드맵은 이 쿼리가 통과된다.

- [ ] **Step 7: 수동 확인**

Run: `npm run dev` → 로드맵을 공개로 전환하고 "복사" 버튼으로 링크를 복사해
`/r/<id>`를 시크릿 창(비로그인)으로 열어서 타임라인이 읽기 전용으로 보이는지,
브라우저 개발자 도구 네트워크 탭에서 이 페이지의 응답에 마일스톤 메모나 로드맵
설명이 전혀 안 실려있는지, 다시 비공개로 전환한 뒤 같은 링크로 들어가면
"찾을 수 없거나 비공개" 문구가 뜨는지 확인

- [ ] **Step 8: 커밋**

```bash
git add lib/roadmaps.ts lib/milestones.ts __tests__/roadmaps.test.ts __tests__/milestones.test.ts app/roadmap/\[id\]/page.tsx app/r/\[id\]/page.tsx
git commit -m "feat: add public roadmap sharing with a privacy-safe narrow read path"
```

---

### Task 24: 마일스톤 하이파이브 리액션

**Files:**
- Create: `lib/reactions.ts`
- Modify: `app/r/[id]/page.tsx` (Task 23에서 만든 파일)
- Modify: `test-utils/fakeSupabaseClient.ts` (Task 5에서 만든 파일 — `FakeResult`에
  `count` 필드를 추가한다)
- Test: `__tests__/reactions.test.ts`

**Interfaces:**
- Consumes: `makeFakeClient` (Task 5)
- Produces: `hasReacted(client, milestoneId, userId): Promise<boolean>`,
  `getReactionCount(client, milestoneId): Promise<number>`,
  `toggleReaction(client, milestoneId, userId): Promise<boolean>` (반환값은 토글 후
  "지금 눌린 상태인지")

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/reactions.test.ts
import { hasReacted, getReactionCount, toggleReaction } from '../lib/reactions';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('hasReacted returns true when a row exists', async () => {
  const client = makeFakeClient([{ data: { id: 'x1' }, error: null }]);
  expect(await hasReacted(client, 'm1', 'u1')).toBe(true);
});

test('hasReacted returns false when no row exists', async () => {
  const client = makeFakeClient([{ data: null, error: null }]);
  expect(await hasReacted(client, 'm1', 'u1')).toBe(false);
});

test('getReactionCount returns the count', async () => {
  const client = makeFakeClient([{ data: null, error: null, count: 3 }]);
  expect(await getReactionCount(client, 'm1')).toBe(3);
});

test('toggleReaction inserts and returns true when not yet reacted', async () => {
  const client = makeFakeClient([
    { data: null, error: null }, // hasReacted -> false
    { data: null, error: null }, // insert
  ]);
  expect(await toggleReaction(client, 'm1', 'u1')).toBe(true);
});

test('toggleReaction deletes and returns false when already reacted', async () => {
  const client = makeFakeClient([
    { data: { id: 'x1' }, error: null }, // hasReacted -> true
    { data: null, error: null }, // delete
  ]);
  expect(await toggleReaction(client, 'm1', 'u1')).toBe(false);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest reactions.test.ts`
Expected: FAIL with "Cannot find module '../lib/reactions'"

- [ ] **Step 3: 구현한다**

```ts
// lib/reactions.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function hasReacted(client: SupabaseClient, milestoneId: string, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from('milestone_reactions')
    .select('id')
    .eq('milestone_id', milestoneId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function getReactionCount(client: SupabaseClient, milestoneId: string): Promise<number> {
  const { count, error } = await client
    .from('milestone_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('milestone_id', milestoneId);
  if (error) throw error;
  return count ?? 0;
}

export async function toggleReaction(client: SupabaseClient, milestoneId: string, userId: string): Promise<boolean> {
  const already = await hasReacted(client, milestoneId, userId);
  if (already) {
    const { error } = await client
      .from('milestone_reactions')
      .delete()
      .eq('milestone_id', milestoneId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from('milestone_reactions').insert({ milestone_id: milestoneId, user_id: userId });
  if (error) throw error;
  return true;
}
```

`getReactionCount`의 가짜 클라이언트 테스트를 통과시키려면 `test-utils/fakeSupabaseClient.ts`의
`FakeResult` 타입과 builder의 `then` 콜백에 `count` 필드를 함께 흘려보내야 한다 —
아래처럼 한 줄만 고치면 된다.

```ts
// test-utils/fakeSupabaseClient.ts 수정
export type FakeResult = { data: unknown; error: unknown; count?: number };
// ...
then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
```
(`FakeResult`에 `count`가 이미 있으니 `result` 객체를 그대로 resolve하는 기존
`then` 구현은 고칠 필요가 없다 — 타입만 넓히면 된다.)

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest reactions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 공개 로드맵 페이지에 하이파이브 버튼을 연결한다**

```tsx
// app/r/[id]/page.tsx — import에 추가
import { hasReacted, getReactionCount, toggleReaction } from '../../../lib/reactions';
```

```tsx
// 컴포넌트 안에 state/로직 추가
const [userId, setUserId] = useState<string | null>(null);
const [reactions, setReactions] = useState<Record<string, { count: number; reacted: boolean }>>({});

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
}, []);

useEffect(() => {
  if (milestones.length === 0) return;
  Promise.all(
    milestones.map(async (m) => ({
      id: m.id,
      count: await getReactionCount(supabase, m.id),
      reacted: userId ? await hasReacted(supabase, m.id, userId) : false,
    }))
  ).then((results) => {
    setReactions(Object.fromEntries(results.map((r) => [r.id, { count: r.count, reacted: r.reacted }])));
  });
}, [milestones, userId]);

async function handleHighFive(milestoneId: string) {
  if (!userId) return;
  const nowReacted = await toggleReaction(supabase, milestoneId, userId);
  setReactions((prev) => ({
    ...prev,
    [milestoneId]: { count: (prev[milestoneId]?.count ?? 0) + (nowReacted ? 1 : -1), reacted: nowReacted },
  }));
}
```

```tsx
{/* 각 마일스톤 노드 안, "{milestone.due_date}" 아래에 추가 */}
{userId ? (
  <button
    className={`mt-1 rounded-full border px-2 py-1 text-xs ${
      reactions[milestone.id]?.reacted ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'
    }`}
    onClick={() => handleHighFive(milestone.id)}
  >
    🖐 {reactions[milestone.id]?.count ?? 0}
  </button>
) : (
  <span className="mt-1 text-xs text-gray-500">🖐 {reactions[milestone.id]?.count ?? 0}</span>
)}
```

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → 로그인한 두 계정으로 같은 공개 로드맵을 열어 서로의
마일스톤에 하이파이브를 남기고 카운트가 올라가는지, 다시 누르면 취소(카운트가
줄고 버튼이 원래 색으로 돌아옴)되는지, 로그아웃 상태에서는 버튼 없이 숫자만
보이는지 확인

- [ ] **Step 7: 커밋**

```bash
git add lib/reactions.ts __tests__/reactions.test.ts test-utils/fakeSupabaseClient.ts app/r/\[id\]/page.tsx
git commit -m "feat: add milestone high-five reactions on public roadmaps"
```

---

### Task 25: 리더보드

**Files:**
- Create: `lib/leaderboard.ts`
- Create: `app/(dashboard)/leaderboard/page.tsx`
- Modify: `app/(dashboard)/layout.tsx` (Task 7/14에서 만든 파일 — 네비게이션에
  "리더보드" 추가)
- Test: `__tests__/leaderboard.test.ts`

**Interfaces:**
- Consumes: `computeStreak` (Task 12), `makeFakeClient` (Task 5), `useRequireAuth` (Task 3)
- Produces: `getLeaderboard(client, today): Promise<{ displayName: string; streak: number }[]>`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/leaderboard.test.ts
import { getLeaderboard } from '../lib/leaderboard';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('ranks profiles by streak, highest first', async () => {
  const client = makeFakeClient([
    {
      data: [
        { user_id: 'u1', display_name: '동언' },
        { user_id: 'u2', display_name: '민수' },
      ],
      error: null,
    }, // profiles where show_on_leaderboard = true
    { data: [{ checkin_date: '2026-09-07' }], error: null }, // u1 checkins -> streak 1
    {
      data: [
        { checkin_date: '2026-09-05' },
        { checkin_date: '2026-09-06' },
        { checkin_date: '2026-09-07' },
      ],
      error: null,
    }, // u2 checkins -> streak 3
  ]);
  const result = await getLeaderboard(client, new Date('2026-09-07'));
  expect(result).toEqual([
    { displayName: '민수', streak: 3 },
    { displayName: '동언', streak: 1 },
  ]);
});

test('returns an empty array when nobody opted into the leaderboard', async () => {
  const client = makeFakeClient([{ data: [], error: null }]);
  expect(await getLeaderboard(client, new Date('2026-09-07'))).toEqual([]);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest leaderboard.test.ts`
Expected: FAIL with "Cannot find module '../lib/leaderboard'"

- [ ] **Step 3: 구현한다**

```ts
// lib/leaderboard.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStreak } from './streak';

export interface LeaderboardEntry {
  displayName: string;
  streak: number;
}

export async function getLeaderboard(client: SupabaseClient, today: Date): Promise<LeaderboardEntry[]> {
  const { data: profiles, error } = await client
    .from('profiles')
    .select('user_id, display_name')
    .eq('show_on_leaderboard', true);
  if (error) throw error;

  const entries = await Promise.all(
    (profiles ?? []).map(async (p: { user_id: string; display_name: string }) => {
      const { data: checkins, error: checkinError } = await client
        .from('habit_checkins')
        .select('checkin_date')
        .eq('user_id', p.user_id);
      if (checkinError) throw checkinError;
      const streak = computeStreak((checkins ?? []).map((c: { checkin_date: string }) => c.checkin_date), today);
      return { displayName: p.display_name, streak };
    })
  );

  return entries.sort((a, b) => b.streak - a.streak);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest leaderboard.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 리더보드 페이지를 만든다**

```tsx
// app/(dashboard)/leaderboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { getLeaderboard, LeaderboardEntry } from '../../../lib/leaderboard';

export default function LeaderboardPage() {
  const userId = useRequireAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    getLeaderboard(supabase, new Date()).then(setEntries);
  }, [userId]);

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">리더보드</h1>
      <p className="mb-4 text-sm text-gray-500">리더보드에 표시하기로 한 사용자들의 스트릭 순위예요</p>
      <ol className="space-y-2">
        {entries.map((entry, index) => (
          <li key={entry.displayName} className="flex items-center justify-between rounded-xl border p-3">
            <span className="font-medium">
              {index + 1}. {entry.displayName}
            </span>
            <span className="text-sm text-gray-600">{entry.streak}일 연속</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 6: 네비게이션에 리더보드 링크를 추가한다**

```tsx
// app/(dashboard)/layout.tsx 의 <nav> 안, "설정" 링크 뒤에 추가
<Link href="/leaderboard">리더보드</Link>
```

- [ ] **Step 7: 수동 확인**

Run: `npm run dev` → 설정에서 "리더보드에 표시"를 켠 계정 2개로 각각 스트릭을
쌓은 뒤, 리더보드 페이지에서 스트릭이 높은 순서대로 닉네임이 나열되는지,
표시를 끈 계정은 목록에서 빠지는지 확인

- [ ] **Step 8: 커밋**

```bash
git add lib/leaderboard.ts __tests__/leaderboard.test.ts app/\(dashboard\)/leaderboard/page.tsx app/\(dashboard\)/layout.tsx
git commit -m "feat: add streak leaderboard"
```

---

### Task 26: 커뮤니티 페이지 (공개 로드맵 둘러보기 + 검색)

**Files:**
- Create: `lib/community.ts`
- Create: `app/(dashboard)/community/page.tsx`
- Modify: `app/(dashboard)/layout.tsx` (Task 7/14/25에서 만든 파일 — 네비게이션에
  "커뮤니티" 추가)
- Modify: `test-utils/fakeSupabaseClient.ts` (Task 5에서 만든 파일 — 지금까지 안 쓰던
  `in`/`ilike`/`gte`를 builder에 추가한다)
- Test: `__tests__/community.test.ts`

**Interfaces:**
- Consumes: `useRequireAuth` (Task 3)
- Produces: `listCommunityRoadmaps(client, sortBy, searchName?): Promise<CommunityEntry[]>`
  (`sortBy`는 `'today' | 'total'`, `CommunityEntry`는 `{ roadmapId, title, ownerName,
  highFiveCount }`)

이 태스크는 Task 21(공개 로드맵/RLS)·Task 24(하이파이브)가 이미 끝나 있다고 전제한다.
RLS는 이미 다 갖춰져 있어서(공개 로드맵은 `roadmaps_public_read`, 그 마일스톤은
`milestones_public_read`, 리액션은 `milestone_reactions_public_read`, 닉네임은
`profiles_read_all`) 새 정책을 추가할 필요가 없다 — 조회 로직만 짜면 된다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/community.test.ts
import { listCommunityRoadmaps } from '../lib/community';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('lists public roadmaps with owner nickname and high-five count', async () => {
  const client = makeFakeClient([
    { data: [{ id: 'r1', title: '10km 마라톤', user_id: 'u1' }], error: null }, // public roadmaps
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null }, // owner profiles
    { data: [{ id: 'm1' }, { id: 'm2' }], error: null }, // r1의 마일스톤 id 목록
    { data: null, error: null, count: 5 }, // r1의 하이파이브 개수
  ]);
  const result = await listCommunityRoadmaps(client, 'total');
  expect(result).toEqual([{ roadmapId: 'r1', title: '10km 마라톤', ownerName: '동언', highFiveCount: 5 }]);
});

test('returns an empty array when there are no public roadmaps', async () => {
  const client = makeFakeClient([{ data: [], error: null }]);
  expect(await listCommunityRoadmaps(client, 'total')).toEqual([]);
});

test('skips the roadmap query entirely when a name search matches nobody', async () => {
  const client = makeFakeClient([{ data: [], error: null }]); // profiles search -> no match
  const result = await listCommunityRoadmaps(client, 'total', '존재안함');
  expect(result).toEqual([]);
  expect(client.from).toHaveBeenCalledTimes(1);
});

test('returns 0 high-fives for a roadmap with no milestones, without querying reactions', async () => {
  const client = makeFakeClient([
    { data: [{ id: 'r1', title: '빈 로드맵', user_id: 'u1' }], error: null },
    { data: [{ user_id: 'u1', display_name: '동언' }], error: null },
    { data: [], error: null }, // 마일스톤 없음
  ]);
  const result = await listCommunityRoadmaps(client, 'total');
  expect(result).toEqual([{ roadmapId: 'r1', title: '빈 로드맵', ownerName: '동언', highFiveCount: 0 }]);
  expect(client.from).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest community.test.ts`
Expected: FAIL with "Cannot find module '../lib/community'"

- [ ] **Step 3: 가짜 클라이언트에 `in`/`ilike`/`gte`를 추가한다**

Task 5에서 만든 `test-utils/fakeSupabaseClient.ts`의 builder는 지금까지
`insert`/`update`/`upsert`/`delete`/`select`/`eq`/`neq`/`order`/`maybeSingle`/`single`/`then`
(그리고 Task 24에서 추가한 `count`)만 지원한다. `lib/community.ts`는 `.in()`(2곳),
`.ilike()`, `.gte()`를 호출하므로 이 메서드들을 builder에 추가하지 않으면
Step 1의 테스트가 `TypeError: ... is not a function`으로 실패한다.

```ts
// test-utils/fakeSupabaseClient.ts 의 builder 정의에 추가
const builder: any = {
  insert: jest.fn(() => builder),
  update: jest.fn(() => builder),
  upsert: jest.fn(() => builder),
  delete: jest.fn(() => builder),
  select: jest.fn(() => builder),
  eq: jest.fn(() => builder),
  neq: jest.fn(() => builder),
  in: jest.fn(() => builder),
  ilike: jest.fn(() => builder),
  gte: jest.fn(() => builder),
  order: jest.fn(() => builder),
  maybeSingle: jest.fn(() => Promise.resolve(result)),
  single: jest.fn(() => Promise.resolve(result)),
  then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
};
```

- [ ] **Step 4: 구현한다**

```ts
// lib/community.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CommunityEntry {
  roadmapId: string;
  title: string;
  ownerName: string;
  highFiveCount: number;
}

// roadmaps와 profiles는 둘 다 auth.users를 참조할 뿐 서로 직접 FK로 안 묶여있어서
// PostgREST가 자동으로 조인(embedding)해주지 못한다 — user_id를 키 삼아 두 번
// 조회해서 직접 합친다(리더보드, Task 25와 같은 패턴).
async function countHighFivesForRoadmap(
  client: SupabaseClient,
  roadmapId: string,
  since?: string
): Promise<number> {
  const { data: milestoneRows, error: milestoneError } = await client
    .from('milestones')
    .select('id')
    .eq('roadmap_id', roadmapId);
  if (milestoneError) throw milestoneError;
  const milestoneIds = (milestoneRows ?? []).map((m: { id: string }) => m.id);
  if (milestoneIds.length === 0) return 0;

  let query = client
    .from('milestone_reactions')
    .select('id', { count: 'exact', head: true })
    .in('milestone_id', milestoneIds);
  if (since) {
    query = query.gte('created_at', since);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function listCommunityRoadmaps(
  client: SupabaseClient,
  sortBy: 'today' | 'total',
  searchName?: string
): Promise<CommunityEntry[]> {
  let roadmapQuery = client.from('roadmaps').select('id, title, user_id').eq('is_public', true);

  if (searchName) {
    const { data: matchingProfiles, error: searchError } = await client
      .from('profiles')
      .select('user_id')
      .ilike('display_name', `%${searchName}%`);
    if (searchError) throw searchError;
    const userIds = (matchingProfiles ?? []).map((p: { user_id: string }) => p.user_id);
    if (userIds.length === 0) return [];
    roadmapQuery = roadmapQuery.in('user_id', userIds);
  }

  const { data: roadmaps, error } = await roadmapQuery;
  if (error) throw error;
  if (!roadmaps || roadmaps.length === 0) return [];

  const ownerIds = [...new Set(roadmaps.map((r: { user_id: string }) => r.user_id))];
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', ownerIds);
  if (profilesError) throw profilesError;
  const nameByUserId = new Map(
    (profiles ?? []).map((p: { user_id: string; display_name: string }) => [p.user_id, p.display_name])
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const entries = await Promise.all(
    roadmaps.map(async (r: { id: string; title: string; user_id: string }) => {
      const highFiveCount = await countHighFivesForRoadmap(
        client,
        r.id,
        sortBy === 'today' ? todayStart.toISOString() : undefined
      );
      return {
        roadmapId: r.id,
        title: r.title,
        ownerName: nameByUserId.get(r.user_id) ?? '알 수 없음',
        highFiveCount,
      };
    })
  );

  return entries.sort((a, b) => b.highFiveCount - a.highFiveCount);
}
```

"오늘" 기준으로 필터링하는 `since` 값은 실제로 Postgres 쪽 `.gte('created_at', ...)`가
처리하므로, 가짜 클라이언트로는 그 경계 판정 자체(자정 넘었는지 등)를 검증할 수
없다 — Step 7의 수동 확인에서 실제 Supabase로 확인한다.

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `npx jest community.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: 커뮤니티 페이지를 만든다**

```tsx
// app/(dashboard)/community/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { listCommunityRoadmaps, CommunityEntry } from '../../../lib/community';

export default function CommunityPage() {
  const userId = useRequireAuth();
  const [sortBy, setSortBy] = useState<'today' | 'total'>('today');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<CommunityEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    listCommunityRoadmaps(supabase, sortBy, search || undefined).then(setEntries);
  }, [userId, sortBy, search]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">커뮤니티</h1>
      <div className="mt-4 flex gap-2">
        <button
          className={`rounded-lg px-3 py-2 text-sm ${sortBy === 'today' ? 'bg-orange-500 text-white' : 'border'}`}
          onClick={() => setSortBy('today')}
        >
          오늘 하이파이브순
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm ${sortBy === 'total' ? 'bg-orange-500 text-white' : 'border'}`}
          onClick={() => setSortBy('total')}
        >
          추천순
        </button>
      </div>
      <input
        className="mt-3 w-full rounded-lg border p-3"
        placeholder="닉네임으로 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {entries.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">공개된 로드맵이 아직 없어요.</p>
      )}
      <ul className="mt-4 space-y-2">
        {entries.map((entry) => (
          <li key={entry.roadmapId}>
            <Link href={`/r/${entry.roadmapId}`} className="block rounded-xl border p-3">
              <p className="font-medium">{entry.title}</p>
              <p className="text-sm text-gray-600">
                {entry.ownerName} · 하이파이브 {entry.highFiveCount}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: 네비게이션에 커뮤니티 링크를 추가한다**

```tsx
// app/(dashboard)/layout.tsx 의 <nav> 안, "리더보드" 링크 뒤에 추가
<Link href="/community">커뮤니티</Link>
```

- [ ] **Step 8: 수동 확인**

Run: `npm run dev` → 로드맵 2~3개를 공개로 전환하고 서로 하이파이브를 남긴 뒤,
커뮤니티 페이지에서 "오늘 하이파이브순"/"추천순" 전환 시 순서가 바뀌는지(둘 다
같은 값이면 구분이 안 보일 수 있으니 한쪽에만 오래된 날짜의 리액션을 만들어
차이를 만든다), 닉네임으로 검색하면 그 사람의 공개 로드맵만 남는지, 항목을
누르면 `/r/<id>` 공개 화면으로 이동하는지, 로드맵을 비공개로 돌리면 목록에서
바로 빠지는지 확인

- [ ] **Step 9: 커밋**

```bash
git add lib/community.ts __tests__/community.test.ts app/\(dashboard\)/community/page.tsx app/\(dashboard\)/layout.tsx test-utils/fakeSupabaseClient.ts
git commit -m "feat: add community page to browse public roadmaps by high-fives and nickname search"
```
