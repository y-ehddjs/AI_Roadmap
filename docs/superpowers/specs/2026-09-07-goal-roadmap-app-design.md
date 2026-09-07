# 목표 로드맵 앱 설계 문서

## 개요 및 목적

사용자가 장기/단기 목표(운동, 자격증, 새 프로그래밍 언어 학습 등 범용)를 세우고, 이를
마일스톤 단위로 쪼갠 로드맵을 시각적으로 관리할 수 있는 반응형 웹 애플리케이션.
개인 사용 및 포트폴리오용 MVP로, 빠른 구축과 핵심 기능 완성도를 우선한다.

## 제약 조건 / 전제

- 개발자는 웹(JS/TS) 개발 배경 위주 — React 기반 웹 개발에 익숙함
- 개인/포트폴리오 규모 MVP — 과도한 인프라 투자 지양
- 클라우드 계정 기반 데이터 동기화 필요 (여러 기기)
- 별도 앱스토어 배포 없이 브라우저로 접근 — 데스크톱/모바일 브라우저 모두에서
  반응형으로 동작해야 함

## 성공 기준

- 사용자가 목표를 만들고(AI 제안 또는 직접 입력), 마일스톤을 타임라인으로 보고,
  체크하고, 진행률을 확인할 수 있다.
- 마감일이 지연되면 앱이 자동으로 알아채고 AI가 개입 메시지를 보낸다.
- 여러 기기에서 로그인하면 동일한 데이터가 보인다.

## 검토한 접근 방식

1. **(채택) Next.js(React) + Supabase + Claude API** — 웹 개발 배경과 바로 맞고,
   Supabase의 관계형(Postgres) 구조가 로드맵/마일스톤의 계층·순서 데이터에 자연스러움.
   앱스토어 배포 없이 링크 하나로 포트폴리오 공유가 가능하고, Tailwind CSS로
   반응형 레이아웃을 빠르게 구현할 수 있음.
2. Firebase(Firestore) + Claude API — FCM 웹 푸시는 강력하지만 Firestore(NoSQL)가
   마일스톤 순서/의존관계 표현에는 Supabase보다 손이 더 감.
3. 자체 백엔드(Node.js/Express + Postgres) — 제어권은 최대지만 개인 MVP 규모에
   비해 인증/배포/운영 부담이 과함.

**결정:** 1번 채택.

## 아키텍처

- **클라이언트**: Next.js(React, App Router), Tailwind CSS로 반응형 레이아웃
  (모바일/태블릿/데스크톱 브레이크포인트 대응)
- **백엔드**: Supabase (Postgres + Auth + Realtime)
- **인증**: 이메일/비밀번호 (Supabase Auth)
- **알림**: Web Push API (서비스 워커 + VAPID 키 기반 브라우저 푸시)
- **AI**: Claude API — (a) 로드맵 자동 생성, (b) 프로액티브 코칭 메시지 생성
- **AI 코칭 트리거**: 마일스톤 지연 감지는 서버 사이드 스케줄 작업(Supabase
  Edge Function 또는 cron)이 주기적으로 `due_date` 경과 여부를 확인해 트리거.
  MVP는 이 지연(delay) 기준 하나만 구현하며, "정체" 같은 별도 판정 기준은
  범위 밖(YAGNI)으로 둔다.

## 주요 기능

1. 회원가입/로그인 (이메일+비밀번호)
2. 로드맵 생성 — AI 제안(목표 입력 → Claude API가 마일스톤 초안 생성) 또는 수동 입력
3. 다중 로드맵 관리 — 여러 목표 동시 진행, 홈에서 리스트로 확인
4. 로드맵 타임라인 뷰 — 경로형(게임 스테이지 맵 스타일) 시각화, 마일스톤은 고정
   마감일(달력형)
5. 마일스톤 체크 — 완료/미완료, 지연 여부 자동 표시(`due_date` 경과 시 `overdue`)
6. 진행률 대시보드 — 로드맵별 완료율(%), 전체 요약
7. 알림/리마인더 — 마감일 임박 알림, 체크인 유도 알림 (Web Push)
8. 습관 추적 — 계정 전체 통합 스트릭(로드맵 무관, 그날 뭐라도 체크했는지)
9. AI 코칭 — 마일스톤 지연(마감일 경과) 감지 시 자동으로 푸시 + 인앱 메시지로 개입
   (프로액티브, 사용자가 요청하지 않아도 발동)

## 화면 구성

1. 온보딩/로그인
2. 홈 — 로드맵 리스트(진행률 카드) + 스트릭 표시
3. 로드맵 생성 — AI 생성 vs 직접 입력 선택 → 입력폼 / AI 대화형 플로우
4. 로드맵 상세 — 타임라인/경로형 뷰, 마일스톤 노드
5. 마일스톤 상세 — 체크, 메모, 마감일 수정
6. 진행률 대시보드 — 전체 로드맵 요약
7. AI 코칭 메시지함 — 프로액티브 메시지 히스토리
8. 설정 — 알림 on/off, 계정 관리

## 데이터 모델 초안

- **users** (Supabase Auth 기본 제공: id, email)
- **roadmaps**: id, user_id(FK), title, description, source(`ai`|`manual`),
  status(`active`|`completed`|`archived`), created_at
- **milestones**: id, roadmap_id(FK), title, description, due_date, order_index,
  status(`pending`|`done`|`overdue`), completed_at
- **habit_checkins**: id, user_id(FK), checkin_date, streak_count
  (로드맵 무관, 계정 전체 통합 스트릭)
- **coaching_messages**: id, user_id(FK), roadmap_id(FK),
  trigger_type(`delay`), message, created_at, read_at
- **notification_settings**: id, user_id(FK), reminder_enabled, reminder_time,
  push_subscription (jsonb, 브라우저 Web Push 구독 정보. 코칭/리마인더 발송에
  필요해 계획 단계에서 추가)

## 에러 처리 / 엣지 케이스

- Claude API 호출 실패 시 로드맵 생성은 수동 입력 폼으로 폴백
- Web Push 구독이 없는 브라우저/기기는 알림 없이도 인앱 코칭 메시지함에서
  확인 가능해야 함
- 마일스톤 마감일 수정 시 `overdue` 상태 재계산

## 테스트 방침

- 데이터 모델/진행률 계산(완료율, 스트릭 갱신, overdue 판정) 로직은 유닛 테스트로 검증
- AI 연동(로드맵 생성, 코칭 메시지)은 프롬프트-응답 계약을 모킹해 테스트, 실제 API
  호출은 수동 검증
- 화면 단위 동작은 개발 중 수동 확인(포트폴리오 MVP 규모, E2E 자동화는 범위 밖)

## 개발 순서

1. Next.js 프로젝트 셋업 + Supabase 연동 + 이메일/비밀번호 인증
2. DB 스키마 구축 (roadmaps, milestones)
3. 로드맵 수동 생성 + 목록/상세 페이지 (리스트 뷰로 먼저, 타임라인 시각화 이전)
4. 마일스톤 체크 + 진행률 계산
5. 타임라인/경로형 시각화 (커스텀 UI, 반응형 레이아웃)
6. 알림/리마인더 (Web Push) + 스트릭 로직
7. AI 로드맵 생성 (Claude API 연동)
8. AI 프로액티브 코칭 (지연 감지 스케줄 작업 + 메시지 발송)
