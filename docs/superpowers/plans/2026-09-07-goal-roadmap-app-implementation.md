# 목표 로드맵 앱 Implementation Plan (반응형 웹)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여러 목표(로드맵)를 세우고, 마일스톤을 타임라인으로 관리하며, AI가 로드맵을
제안하고 지연 시 자동으로 코칭 메시지를 보내는 반응형 웹 앱의 MVP를 만든다.

**Architecture:** Next.js(App Router) 클라이언트가 Supabase(Postgres + Auth)에 직접
CRUD 쿼리를 날리고, AI가 필요한 두 지점(로드맵 생성, 지연 코칭)은 Supabase Edge
Function이 서버 사이드에서 Claude API를 호출해 API 키를 클라이언트에 노출하지 않는다.
알림은 서비스 워커 기반 Web Push API로 발송한다. 화면은 Tailwind CSS의 반응형
브레이크포인트로 모바일/데스크톱 브라우저 모두를 지원한다.

**Tech Stack:** Next.js(React + TypeScript, App Router) + Tailwind CSS,
@supabase/supabase-js, Supabase Edge Functions(Deno) + Anthropic Claude API,
Web Push API(서비스 워커, `web-push` 라이브러리), Jest(next/jest preset, 앱 코드),
Deno test runner(엣지 함수 코드).

**Spec:** `docs/superpowers/specs/2026-09-07-goal-roadmap-app-design.md`

## Global Constraints

- 플랫폼: 반응형 웹 (Next.js) — 별도 앱스토어 배포 없음, 브라우저로 접근
- 백엔드: Supabase (Postgres + Auth + Realtime); Edge Function은 Deno 런타임에서 동작
- 인증: 이메일/비밀번호만 (소셜 로그인 없음)
- 알림: Web Push API (서비스 워커 + VAPID 키)
- AI: Claude API — 로드맵 생성 + 프로액티브 코칭. 코칭 트리거는 마감일 경과(`delay`)
  하나만 구현하며 "정체" 판정은 범위 밖(YAGNI)
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
  progress.ts                        # calculateProgress/milestoneStatus (순수 함수)
  roadmaps.ts                        # 로드맵 CRUD
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
  functions/
    generate-roadmap/
      index.ts                       # AI 로드맵 생성 엣지 함수
      parse.ts                       # parseRoadmapResponse (순수 함수)
      parse.test.ts                  # Deno test
    check-coaching/
      index.ts                       # 지연 감지 + 코칭 Web Push 발송 (스케줄)
      select.ts                      # selectOverdueMilestones/buildCoachingPrompt
      select.test.ts                 # Deno test
    send-reminders/
      index.ts                       # 리마인더 Web Push 발송 (스케줄)
      schedule.ts                    # isReminderDue (순수 함수)
      schedule.test.ts               # Deno test
```

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
  testPathIgnorePatterns: ['/node_modules/', '/supabase/functions/'],
};

module.exports = createJestConfig(customJestConfig);
```

`package.json`의 `scripts`에 추가:

```json
"test": "jest",
"test:functions": "deno test supabase/functions"
```

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

### Task 3: 이메일/비밀번호 인증

**Files:**
- Create: `lib/auth.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Test: `__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `supabase` from `lib/supabase.ts` (Task 1)
- Produces: `validateEmail(email: string): boolean`, `validatePassword(password: string): boolean`

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

- [ ] **Step 5: 로그인/회원가입 페이지를 만든다**

```tsx
// app/(auth)/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { validateEmail, validatePassword } from '../../../lib/auth';

export default function LoginPage() {
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

export default function SignupPage() {
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

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → 회원가입 후 Supabase Studio의 `auth.users` 테이블에 행이 생기는지,
로그인 성공 시 홈(`/`)으로 이동하는지, 좁은 화면(모바일 폭)에서도 폼이 중앙 정렬로
잘 보이는지 확인

- [ ] **Step 7: 커밋**

```bash
git add lib/auth.ts app/\(auth\) __tests__/auth.test.ts
git commit -m "feat: add email/password auth pages"
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
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      neq: jest.fn(() => builder),
      order: jest.fn(() => builder),
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
import { createRoadmap, listRoadmaps, getRoadmap } from '../lib/roadmaps';
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
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `npx jest roadmaps.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: 커밋**

```bash
git add lib/roadmaps.ts test-utils/fakeSupabaseClient.ts __tests__/roadmaps.test.ts
git commit -m "feat: add roadmap CRUD with fake-client test harness"
```

---

### Task 6: 마일스톤 CRUD (`lib/milestones.ts`)

**Files:**
- Create: `lib/milestones.ts`
- Test: `__tests__/milestones.test.ts`

**Interfaces:**
- Consumes: `Milestone` from `types/models.ts` (Task 2), `makeFakeClient` from `test-utils/fakeSupabaseClient.ts` (Task 5)
- Produces: `createMilestone(client, input): Promise<Milestone>`, `listMilestones(client, roadmapId): Promise<Milestone[]>`,
  `updateMilestone(client, milestoneId, patch): Promise<Milestone>`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/milestones.test.ts
import { createMilestone, listMilestones, updateMilestone } from '../lib/milestones';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('createMilestone inserts and returns the created row', async () => {
  const row = { id: 'm1', roadmap_id: 'r1', title: '1km 완주', due_date: '2026-10-01', order_index: 0, status: 'pending' };
  const client = makeFakeClient([{ data: row, error: null }]);
  const result = await createMilestone(client, { roadmap_id: 'r1', title: '1km 완주', due_date: '2026-10-01', order_index: 0 });
  expect(result).toEqual(row);
});

test('listMilestones returns rows ordered by order_index', async () => {
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
  const { data, error } = await client
    .from('milestones')
    .select('*')
    .eq('roadmap_id', roadmapId)
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest milestones.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/milestones.ts __tests__/milestones.test.ts
git commit -m "feat: add milestone CRUD"
```

---

### Task 7: 홈 페이지 — 로드맵 리스트 (반응형 그리드)

**Files:**
- Create: `app/(dashboard)/page.tsx`
- Create: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `listRoadmaps` (Task 5), `listMilestones` (Task 6), `calculateProgress`, `milestoneStatus` (Task 4), `supabase` (Task 1)

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
  const [rows, setRows] = useState<RoadmapRow[]>([]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const roadmaps = await listRoadmaps(supabase, userId);
      const now = new Date();
      const withProgress = await Promise.all(
        roadmaps.map(async (roadmap) => {
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
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">내 목표</h1>
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
브라우저 폭을 줄였을 때(모바일 폭) 1열, 늘렸을 때(`sm` 이상) 2열로 바뀌는지 확인

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
- Consumes: `createRoadmap` (Task 5), `createMilestone` (Task 6), `supabase` (Task 1)

- [ ] **Step 1: 수동 입력 폼을 구현한다** (AI 플로우는 Task 17에서 이 파일에 추가한다)

```tsx
// app/roadmap/create/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { createRoadmap } from '../../../lib/roadmaps';
import { createMilestone } from '../../../lib/milestones';

interface DraftMilestone {
  title: string;
  due_date: string;
}

export default function CreateRoadmapPage() {
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
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
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

### Task 9: 로드맵 상세 페이지 — 마일스톤 리스트 뷰

**Files:**
- Create: `app/roadmap/[id]/page.tsx`

**Interfaces:**
- Consumes: `getRoadmap` (Task 5), `listMilestones` (Task 6), `calculateProgress`, `milestoneStatus` (Task 4)

- [ ] **Step 1: 리스트 기반 상세 페이지를 구현한다** (경로형 시각화는 Task 11에서 확장한다)

```tsx
// app/roadmap/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getRoadmap } from '../../../lib/roadmaps';
import { listMilestones } from '../../../lib/milestones';
import { calculateProgress, milestoneStatus } from '../../../lib/progress';
import type { Roadmap, Milestone } from '../../../types/models';

export default function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setRoadmap(await getRoadmap(supabase, id));
      setMilestones(await listMilestones(supabase, id));
    }
    load();
  }, [id]);

  if (!roadmap) return null;
  const progress = calculateProgress(milestones);
  const now = new Date();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">{roadmap.title}</h1>
      <p className="text-sm text-gray-600">
        전체 진행률 {progress.percent}% ({progress.completedCount}/{progress.totalCount})
      </p>
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
보이는지 확인

- [ ] **Step 3: 커밋**

```bash
git add app/roadmap/\[id\]/page.tsx
git commit -m "feat: add roadmap detail page with milestone list view"
```

---

### Task 10: 마일스톤 상세 페이지 — 체크/메모/마감일 수정

**Files:**
- Create: `app/milestone/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateMilestone` (Task 6)

- [ ] **Step 1: 페이지를 구현한다**

```tsx
// app/milestone/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { updateMilestone } from '../../../lib/milestones';
import type { Milestone } from '../../../types/models';

export default function MilestoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data } = await supabase.from('milestones').select('*').eq('id', id).single();
      const row = data as Milestone;
      setMilestone(row);
      setDescription(row?.description ?? '');
      setDueDate(row?.due_date ?? '');
    }
    load();
  }, [id]);

  if (!milestone) return null;

  async function toggleDone(checked: boolean) {
    if (!milestone) return;
    const updated = await updateMilestone(supabase, milestone.id, {
      status: checked ? 'done' : 'pending',
      completed_at: checked ? new Date().toISOString() : null,
    });
    setMilestone(updated);
  }

  async function saveEdits() {
    if (!milestone) return;
    await updateMilestone(supabase, milestone.id, { description, due_date: dueDate });
    router.back();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-bold">{milestone.title}</h1>
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

- [ ] **Step 2: 수동 확인**

Run: `npm run dev` → 체크박스로 완료 토글 시 상태가 `done`으로 바뀌는지, 마감일을
수정하고 저장하면 로드맵 상세로 돌아가 지연 상태가 재계산되는지 확인

- [ ] **Step 3: 커밋**

```bash
git add app/milestone/\[id\]/page.tsx
git commit -m "feat: add milestone detail page with check/edit"
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

- [ ] **Step 5: 로드맵 상세 페이지에 브레이크포인트별 두 가지 뷰를 추가한다** (좁은
화면은 Task 9의 리스트를 유지하고, `sm` 이상에서만 경로형 뷰를 보여준다)

```tsx
// app/roadmap/[id]/page.tsx 의 렌더 부분을 다음으로 교체 (state/로딩 로직은 Task 9와 동일)
import { computeNodePositions } from '../../../lib/timeline';
// ...
const positions = computeNodePositions(milestones.length);
const pathHeight = 40 + milestones.length * 140 + 100;

return (
  <div className="mx-auto max-w-2xl p-6">
    <h1 className="text-xl font-bold">{roadmap.title}</h1>
    <p className="text-sm text-gray-600">
      전체 진행률 {progress.percent}% ({progress.completedCount}/{progress.totalCount})
    </p>

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
  </div>
);
```

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

### Task 13: 체크인 기록/조회 + 홈 페이지 스트릭 표시

**Files:**
- Create: `lib/checkins.ts`
- Modify: `app/(dashboard)/page.tsx`
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
const [streak, setStreak] = useState(0);
useEffect(() => {
  async function loadStreak() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    setStreak(await getTodayStreak(supabase, userId, new Date()));
  }
  loadStreak();
}, []);

async function handleCheckin() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  setStreak(await recordCheckin(supabase, userId, new Date()));
}
```

JSX 헤더 영역에 추가:

```tsx
<div className="mb-4 flex items-center justify-between">
  <h1 className="text-2xl font-bold">내 목표</h1>
  <div className="flex items-center gap-3">
    <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">{streak}일 연속</span>
    <button className="rounded-lg border px-3 py-1 text-sm" onClick={handleCheckin}>
      오늘 체크인
    </button>
  </div>
</div>
```

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → "오늘 체크인" 버튼을 누르면 스트릭 숫자가 올라가고, 페이지를
새로고침해도 유지되는지 확인

- [ ] **Step 7: 커밋**

```bash
git add lib/checkins.ts __tests__/checkins.test.ts app/\(dashboard\)/page.tsx
git commit -m "feat: add check-in recording and home streak display"
```

---

### Task 14: 브라우저 Web Push 구독 등록 + 설정 페이지

**Files:**
- Create: `lib/notifications.ts`
- Create: `public/sw.js`
- Create: `app/(dashboard)/settings/page.tsx`
- Test: `__tests__/notifications.test.ts`

**Interfaces:**
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest notifications.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 설정 페이지를 구현한다**

```tsx
// app/(dashboard)/settings/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { subscribeToPush } from '../../../lib/notifications';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;

export default function SettingsPage() {
  const router = useRouter();
  const [reminderEnabled, setReminderEnabled] = useState(true);

  async function toggleReminder(value: boolean) {
    setReminderEnabled(value);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const subscription = value ? await subscribeToPush(VAPID_PUBLIC_KEY) : null;
    await supabase
      .from('notification_settings')
      .upsert(
        { user_id: userId, reminder_enabled: value, reminder_time: '09:00', push_subscription: subscription },
        { onConflict: 'user_id' }
      );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold">설정</h1>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={reminderEnabled} onChange={(e) => toggleReminder(e.target.checked)} />
        알림 받기
      </label>
      <button className="rounded-lg border px-4 py-2" onClick={handleLogout}>
        로그아웃
      </button>
    </div>
  );
}
```

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` (HTTPS 또는 `localhost`에서 실행 — Web Push는 보안 컨텍스트 필요) →
알림 받기를 켰을 때 브라우저 알림 권한 요청이 뜨는지, 허용 후
`notification_settings.push_subscription`이 채워지는지, 로그아웃이 로그인 페이지로
보내는지 확인

- [ ] **Step 7: 커밋**

```bash
git add lib/notifications.ts __tests__/notifications.test.ts public/sw.js app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add web push subscription and settings page"
```

---

### Task 15: 진행률 대시보드 페이지

**Files:**
- Create: `lib/dashboard.ts`
- Create: `app/(dashboard)/dashboard/page.tsx`
- Test: `__tests__/dashboard.test.ts`

**Interfaces:**
- Consumes: `calculateProgress`, `ProgressSummary` (Task 4), `Roadmap`, `Milestone` (Task 2)
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
import { listRoadmaps } from '../../../lib/roadmaps';
import { listMilestones } from '../../../lib/milestones';
import { summarizeDashboard, DashboardSummary } from '../../../lib/dashboard';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const roadmaps = await listRoadmaps(supabase, userId);
      const entries = await Promise.all(
        roadmaps.map(async (roadmap) => ({ roadmap, milestones: await listMilestones(supabase, roadmap.id) }))
      );
      setSummary(summarizeDashboard(entries));
    }
    load();
  }, []);

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

### Task 16: Edge Function `generate-roadmap` — AI 로드맵 생성

**Files:**
- Create: `supabase/functions/generate-roadmap/parse.ts`
- Create: `supabase/functions/generate-roadmap/parse.test.ts`
- Create: `supabase/functions/generate-roadmap/index.ts`

**Interfaces:**
- Produces: `parseRoadmapResponse(rawText: string): { title: string; due_date: string; order_index: number }[]`

- [ ] **Step 1: 실패하는 Deno 테스트를 작성한다**

```ts
// supabase/functions/generate-roadmap/parse.test.ts
import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { parseRoadmapResponse } from './parse.ts';

Deno.test('parses a valid JSON array of milestones', () => {
  const raw = JSON.stringify([
    { title: '1km 완주', due_date: '2026-10-01' },
    { title: '3km 완주', due_date: '2026-10-15' },
  ]);
  const result = parseRoadmapResponse(raw);
  assertEquals(result, [
    { title: '1km 완주', due_date: '2026-10-01', order_index: 0 },
    { title: '3km 완주', due_date: '2026-10-15', order_index: 1 },
  ]);
});

Deno.test('throws when the response is not valid JSON', () => {
  assertThrows(() => parseRoadmapResponse('not json'), Error, 'valid JSON');
});

Deno.test('throws when a milestone is missing due_date', () => {
  const raw = JSON.stringify([{ title: 'only title' }]);
  assertThrows(() => parseRoadmapResponse(raw), Error, 'missing title or due_date');
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `deno test supabase/functions/generate-roadmap/parse.test.ts`
Expected: FAIL — `parse.ts` module not found

- [ ] **Step 3: 구현한다**

```ts
// supabase/functions/generate-roadmap/parse.ts
export interface ParsedMilestone {
  title: string;
  due_date: string;
  order_index: number;
}

export function parseRoadmapResponse(rawText: string): ParsedMilestone[] {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error('AI response was not valid JSON');
  }
  if (!Array.isArray(json)) {
    throw new Error('AI response must be a JSON array of milestones');
  }
  return json.map((item, index) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>).title !== 'string' ||
      typeof (item as Record<string, unknown>).due_date !== 'string'
    ) {
      throw new Error(`Milestone at index ${index} is missing title or due_date`);
    }
    return {
      title: (item as Record<string, string>).title,
      due_date: (item as Record<string, string>).due_date,
      order_index: index,
    };
  });
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `deno test supabase/functions/generate-roadmap/parse.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 엣지 함수 핸들러를 작성한다**

```ts
// supabase/functions/generate-roadmap/index.ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseRoadmapResponse } from './parse.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const { user_id, title, description } = await req.json();

  const prompt = `사용자의 목표: "${title}"\n추가 설명: "${description ?? ''}"\n이 목표를 달성하기 위한 마일스톤을 5~8개, 각 마일스톤의 title과 due_date(YYYY-MM-DD, 오늘부터 합리적인 간격)로 구성된 JSON 배열로만 응답해. 다른 설명 텍스트는 포함하지 마.`;

  const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!aiResponse.ok) {
    return new Response(JSON.stringify({ error: 'AI request failed' }), { status: 502 });
  }

  const aiJson = await aiResponse.json();
  const rawText = aiJson.content?.[0]?.text ?? '';

  let milestones;
  try {
    milestones = parseRoadmapResponse(rawText);
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 502 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: roadmap, error: roadmapError } = await supabase
    .from('roadmaps')
    .insert({ user_id, title, description, source: 'ai', status: 'active' })
    .select()
    .single();
  if (roadmapError) {
    return new Response(JSON.stringify({ error: roadmapError.message }), { status: 500 });
  }

  const { error: milestonesError } = await supabase.from('milestones').insert(
    milestones.map((m) => ({
      roadmap_id: roadmap.id,
      title: m.title,
      due_date: m.due_date,
      order_index: m.order_index,
      status: 'pending',
    }))
  );
  if (milestonesError) {
    return new Response(JSON.stringify({ error: milestonesError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ roadmap_id: roadmap.id }), { status: 200 });
});
```

- [ ] **Step 6: 배포하고 수동 확인**

Run: `supabase functions deploy generate-roadmap`, then:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/generate-roadmap" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "content-type: application/json" \
  -d '{"user_id":"<test-user-id>","title":"3개월 안에 10km 마라톤 완주하기"}'
```

Expected: `{"roadmap_id": "..."}` 응답과 함께 `roadmaps`/`milestones`에 행 생성 확인

- [ ] **Step 7: 커밋**

```bash
git add supabase/functions/generate-roadmap
git commit -m "feat: add AI roadmap generation edge function"
```

---

### Task 17: 로드맵 생성 페이지에 AI 플로우 연동

**Files:**
- Modify: `app/roadmap/create/page.tsx`

**Interfaces:**
- Consumes: `generate-roadmap` edge function (Task 16), `supabase.functions.invoke`

- [ ] **Step 1: 방식 선택 토글과 AI 제출 플로우를 추가한다**

```tsx
// app/roadmap/create/page.tsx 상단부에 추가
const [mode, setMode] = useState<'ai' | 'manual'>('ai');
const [aiDescription, setAiDescription] = useState('');
const [aiError, setAiError] = useState<string | null>(null);

async function handleAiSubmit() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId || !title) return;
  const { data, error } = await supabase.functions.invoke('generate-roadmap', {
    body: { user_id: userId, title, description: aiDescription },
  });
  if (error || !data?.roadmap_id) {
    setAiError('AI 생성에 실패했어요. 직접 입력으로 만들어주세요.');
    setMode('manual');
    return;
  }
  router.replace(`/roadmap/${data.roadmap_id}`);
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

Run: `npm run dev` → "AI가 만들어줘" 선택 후 목표를 입력해 제출 → 로드맵 상세로
이동하며 AI가 만든 마일스톤들이 보이는지 확인. Edge Function URL을 일시적으로 틀리게
바꿔 실패를 재현했을 때 수동 입력 폼으로 폴백되는지도 확인

- [ ] **Step 3: 커밋**

```bash
git add app/roadmap/create/page.tsx
git commit -m "feat: wire AI roadmap generation into create page with manual fallback"
```

---

### Task 18: Edge Function `check-coaching` — 지연 감지 + Web Push 코칭 발송

**Files:**
- Create: `supabase/functions/check-coaching/select.ts`
- Create: `supabase/functions/check-coaching/select.test.ts`
- Create: `supabase/functions/check-coaching/index.ts`

**Interfaces:**
- Consumes: `notification_settings.push_subscription` (Task 2)
- Produces: `selectOverdueMilestones(milestones, now): MilestoneForCoaching[]`, `buildCoachingPrompt(milestone): string`

- [ ] **Step 1: 실패하는 Deno 테스트를 작성한다**

```ts
// supabase/functions/check-coaching/select.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { selectOverdueMilestones, buildCoachingPrompt } from './select.ts';

const base = { id: 'm1', roadmap_id: 'r1', user_id: 'u1', title: '5km 완주', due_date: '2026-01-01', status: 'pending' };

Deno.test('selects milestones past due_date that are not done', () => {
  const result = selectOverdueMilestones([base, { ...base, id: 'm2', status: 'done' }], new Date('2026-02-01'));
  assertEquals(result, [base]);
});

Deno.test('excludes milestones whose due_date is still in the future', () => {
  const future = { ...base, due_date: '2027-01-01' };
  const result = selectOverdueMilestones([future], new Date('2026-02-01'));
  assertEquals(result, []);
});

Deno.test('buildCoachingPrompt includes the milestone title', () => {
  const prompt = buildCoachingPrompt(base);
  assertEquals(prompt.includes('5km 완주'), true);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `deno test supabase/functions/check-coaching/select.test.ts`
Expected: FAIL — `select.ts` module not found

- [ ] **Step 3: 구현한다**

```ts
// supabase/functions/check-coaching/select.ts
export interface MilestoneForCoaching {
  id: string;
  roadmap_id: string;
  user_id: string;
  title: string;
  due_date: string;
  status: string;
}

export function selectOverdueMilestones(milestones: MilestoneForCoaching[], now: Date): MilestoneForCoaching[] {
  const nowTime = now.getTime();
  return milestones.filter((m) => m.status !== 'done' && new Date(m.due_date).getTime() < nowTime);
}

export function buildCoachingPrompt(milestone: MilestoneForCoaching): string {
  return `사용자가 "${milestone.title}" 마일스톤의 마감일을 놓쳤어. 비난하지 않는 따뜻한 톤으로, 2문장 이내의 격려 메시지를 만들어줘. 메시지 텍스트만 응답해.`;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `deno test supabase/functions/check-coaching/select.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 엣지 함수 핸들러를 작성한다** (Web Push 발송에는 `web-push` npm
패키지를 Deno의 `npm:` 스펙시파이어로 가져온다)

```ts
// supabase/functions/check-coaching/index.ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { selectOverdueMilestones, buildCoachingPrompt } from './select.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: milestones, error } = await supabase
    .from('milestones')
    .select('id, roadmap_id, title, due_date, status, roadmaps!inner(user_id)')
    .neq('status', 'done');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const normalized = (milestones ?? []).map((m: any) => ({
    id: m.id,
    roadmap_id: m.roadmap_id,
    user_id: m.roadmaps.user_id,
    title: m.title,
    due_date: m.due_date,
    status: m.status,
  }));

  const overdue = selectOverdueMilestones(normalized, new Date());

  for (const milestone of overdue) {
    const { data: existing } = await supabase
      .from('coaching_messages')
      .select('id')
      .eq('roadmap_id', milestone.roadmap_id)
      .eq('trigger_type', 'delay')
      .gte('created_at', new Date().toISOString().slice(0, 10));
    if (existing && existing.length > 0) continue;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 256,
        messages: [{ role: 'user', content: buildCoachingPrompt(milestone) }],
      }),
    });
    if (!aiResponse.ok) continue;
    const aiJson = await aiResponse.json();
    const message = aiJson.content?.[0]?.text ?? '마일스톤 마감일이 지났어요. 다시 시작해볼까요?';

    await supabase.from('coaching_messages').insert({
      user_id: milestone.user_id,
      roadmap_id: milestone.roadmap_id,
      trigger_type: 'delay',
      message,
    });

    const { data: settings } = await supabase
      .from('notification_settings')
      .select('reminder_enabled, push_subscription')
      .eq('user_id', milestone.user_id)
      .single();
    if (settings?.reminder_enabled && settings.push_subscription) {
      try {
        await webpush.sendNotification(
          settings.push_subscription,
          JSON.stringify({ title: '로드맵 코칭', body: message })
        );
      } catch (_err) {
        // 구독이 만료됐을 수 있음 - MVP 범위에서는 무시하고 다음 실행에서 재시도
      }
    }
  }

  return new Response(JSON.stringify({ processed: overdue.length }), { status: 200 });
});
```

- [ ] **Step 6: 배포하고 매일 실행되도록 스케줄을 등록한다**

```bash
supabase functions deploy check-coaching
supabase functions schedule check-coaching --cron "0 9 * * *"
```

수동 확인: 마감일을 과거로 설정한 마일스톤을 만든 뒤 `supabase functions invoke check-coaching`을
직접 호출해 `coaching_messages`에 행이 생기고, 구독된 브라우저에 Web Push 알림이 오는지 확인

- [ ] **Step 7: 커밋**

```bash
git add supabase/functions/check-coaching
git commit -m "feat: add scheduled coaching edge function with web push"
```

---

### Task 19: Edge Function `send-reminders` — 리마인더 스케줄 발송

**Files:**
- Create: `supabase/functions/send-reminders/schedule.ts`
- Create: `supabase/functions/send-reminders/schedule.test.ts`
- Create: `supabase/functions/send-reminders/index.ts`

**Interfaces:**
- Produces: `isReminderDue(reminderTime: string, now: Date, windowMinutes: number): boolean`

- [ ] **Step 1: 실패하는 Deno 테스트를 작성한다**

```ts
// supabase/functions/send-reminders/schedule.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { isReminderDue } from './schedule.ts';

Deno.test('is due when now falls inside the reminder window', () => {
  assertEquals(isReminderDue('09:00', new Date('2026-09-07T09:05:00'), 15), true);
});

Deno.test('is not due before the reminder time', () => {
  assertEquals(isReminderDue('09:00', new Date('2026-09-07T08:59:00'), 15), false);
});

Deno.test('is not due after the window has passed', () => {
  assertEquals(isReminderDue('09:00', new Date('2026-09-07T09:20:00'), 15), false);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `deno test supabase/functions/send-reminders/schedule.test.ts`
Expected: FAIL — `schedule.ts` module not found

- [ ] **Step 3: 구현한다**

```ts
// supabase/functions/send-reminders/schedule.ts
export function isReminderDue(reminderTime: string, now: Date, windowMinutes: number): boolean {
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const reminderMinutesOfDay = hours * 60 + minutes;
  const nowMinutesOfDay = now.getHours() * 60 + now.getMinutes();
  return nowMinutesOfDay >= reminderMinutesOfDay && nowMinutesOfDay < reminderMinutesOfDay + windowMinutes;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `deno test supabase/functions/send-reminders/schedule.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 엣지 함수 핸들러를 작성한다** (15분마다 실행되어, 리마인더 시간
창에 들어온 사용자 중 오늘 아직 체크인하지 않은 사람에게만 Web Push를 보낸다)

```ts
// supabase/functions/send-reminders/index.ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { isReminderDue } from './schedule.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const { data: settingsRows, error } = await supabase
    .from('notification_settings')
    .select('user_id, reminder_time, push_subscription')
    .eq('reminder_enabled', true);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const due = (settingsRows ?? []).filter(
    (row: any) => isReminderDue(row.reminder_time, now, 15) && row.push_subscription
  );

  let sent = 0;
  for (const row of due) {
    const { data: checkin } = await supabase
      .from('habit_checkins')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('checkin_date', todayStr)
      .maybeSingle();
    if (checkin) continue;
    try {
      await webpush.sendNotification(
        row.push_subscription,
        JSON.stringify({ title: '오늘의 체크인', body: '오늘 목표를 향해 한 걸음 나아가볼까요?' })
      );
      sent++;
    } catch (_err) {
      // 구독 만료 등 - MVP 범위에서는 무시
    }
  }

  return new Response(JSON.stringify({ sent }), { status: 200 });
});
```

- [ ] **Step 6: 배포하고 15분마다 실행되도록 스케줄을 등록한다**

```bash
supabase functions deploy send-reminders
supabase functions schedule send-reminders --cron "*/15 * * * *"
```

수동 확인: `notification_settings.reminder_time`을 현재 시각 근처로 설정한 뒤
`supabase functions invoke send-reminders`를 직접 호출해, 오늘 체크인하지 않은
계정에만 알림이 오고 이미 체크인한 계정은 건너뛰는지 확인

- [ ] **Step 7: 커밋**

```bash
git add supabase/functions/send-reminders
git commit -m "feat: add scheduled reminder edge function with web push"
```

---

### Task 20: 코칭 메시지 조회/읽음 처리 + 메시지함 페이지

**Files:**
- Create: `lib/coaching.ts`
- Create: `app/(dashboard)/coaching/page.tsx`
- Test: `__tests__/coaching.test.ts`

**Interfaces:**
- Consumes: `CoachingMessage` (Task 2), `makeFakeClient` (Task 5)
- Produces: `listMessages(client, userId): Promise<CoachingMessage[]>`, `markRead(client, messageId): Promise<void>`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
// __tests__/coaching.test.ts
import { listMessages, markRead } from '../lib/coaching';
import { makeFakeClient } from '../test-utils/fakeSupabaseClient';

test('listMessages returns rows ordered by newest first', async () => {
  const rows = [{ id: 'c2' }, { id: 'c1' }];
  const client = makeFakeClient([{ data: rows, error: null }]);
  const result = await listMessages(client, 'u1');
  expect(result).toEqual(rows);
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

export async function listMessages(client: SupabaseClient, userId: string): Promise<CoachingMessage[]> {
  const { data, error } = await client
    .from('coaching_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CoachingMessage[];
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
import { listMessages, markRead } from '../../../lib/coaching';
import type { CoachingMessage } from '../../../types/models';

export default function CoachingInboxPage() {
  const [messages, setMessages] = useState<CoachingMessage[]>([]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      setMessages(await listMessages(supabase, userId));
    }
    load();
  }, []);

  async function handleOpen(message: CoachingMessage) {
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
              <p className="text-xs text-gray-500">{item.created_at}</p>
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
git commit -m "feat: add coaching inbox page"
```
