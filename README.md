# 목표 로드맵 앱

목표(운동, 자격증, 새 언어 학습 등)를 세우고 마일스톤 단위로 쪼갠 로드맵을 경로형
타임라인으로 관리하는 반응형 웹 앱. AI(Gemini)가 로드맵을 제안하거나 지연을 감지해
코칭 메시지를 보내고, 로드맵을 공개로 공유해 다른 사용자에게 하트와 댓글을 받거나
서로 팔로우할 수도 있다.

## 구조 (모노레포)

```
frontend/   # Next.js(App Router) 웹 클라이언트 — 대부분의 CRUD가 여기서
            # Supabase REST(PostgREST)에 직접 접근한다
backend/    # FastAPI(Python) — API 키를 클라이언트에 못 내보내는 세 곳만 담당:
            # AI 로드맵 생성, 코칭 지연 감지, 리마인더 발송(5주차 도커 분리 대상)
supabase/   # DB 마이그레이션 + 로컬 Supabase(Postgres/Auth) 설정
docs/       # 설계 문서(spec)와 구현 계획(plan)
```

`frontend/`와 `backend/`는 각각 Dockerfile을 갖고 있고 개별적으로 이미지로
빌드/실행할 수 있다. 아직 이 둘과 Supabase를 한 번에 묶는 `docker-compose.yml`은
없어서, 지금은 로컬 개발 시 각자 `npm run dev`/`uvicorn`으로 직접 실행하는 쪽을
기본으로 안내한다 — Docker 빌드 방법은 아래 "Docker" 섹션 참고.

## 필요 환경

- Node.js 20+
- Python 3.12+
- Docker Desktop (로컬 Supabase 스택 구동용)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)

## 실행 방법

### 1. 로컬 Supabase 스택 (저장소 루트에서)

```bash
supabase start
```

`http://127.0.0.1:54321`(API), `http://127.0.0.1:54323`(Studio)로 뜨고, 콘솔에
`anon key`/`service_role key`가 출력된다. 처음 실행하면 `supabase/migrations/`의
마이그레이션이 자동으로 적용된다.

### 2. 프론트엔드 (`frontend/`)

```bash
cd frontend
npm install
cp .env.example .env.local   # 위에서 뜬 anon key 등을 채워 넣는다
npm run dev
```

`http://localhost:3000`에서 확인. 필요한 환경변수는 `frontend/.env.example` 참고.

### 3. 백엔드 (`backend/`)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
export $(grep -v '^#' .env | xargs)   # 아래 값들을 채운 뒤 환경변수로 로드
uvicorn app.main:app --reload
```

`http://localhost:8000/health`로 확인. 필요한 환경변수는 `backend/.env.example`
참고 (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, VAPID 키 등).

## Docker

### 백엔드

```bash
cd backend
docker build -t goal-roadmap-backend .
docker run -p 8000:8000 \
  -e SUPABASE_URL=http://host.docker.internal:54321 \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e GEMINI_API_KEY=... \
  -e VAPID_PUBLIC_KEY=... -e VAPID_PRIVATE_KEY=... -e VAPID_SUBJECT=mailto:you@example.com \
  -e FRONTEND_ORIGIN=http://localhost:3000 \
  -e INTERNAL_API_SECRET=... \
  goal-roadmap-backend
```

로컬 Supabase를 가리킬 때는 컨테이너 안에서 `127.0.0.1`이 호스트가 아니라
컨테이너 자신을 가리키므로 `host.docker.internal`을 써야 한다.

### 프론트엔드

Next.js App Router 앱이라 `npm run build`만으로는 정적 파일이 안 나온다 —
`/roadmap/[id]`, `/milestone/[id]`, `/r/[id]`처럼 실행 중에 생성된 UUID를 받는
동적 라우트가 있어서, 빌드 시점에 모든 경로를 미리 알 수 없는 정적 export로는
만들 수 없다. 그래서 `next.config.ts`에 `output: 'standalone'`을 설정해 빌드
단계(`npm run build`)와 실행 단계를 나누되, 실행 단계는 Nginx가 아니라 경량
Node 런타임에서 `node server.js`로 뜬다(Next.js 공식 컨테이너화 패턴).

`NEXT_PUBLIC_*` 환경변수는 브라우저 번들에 빌드 시점에 그대로 박히므로
런타임에 넘겨봐야 소용없다 — 빌드 인자(`--build-arg`)로 넘긴다.

```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=... \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 \
  -t goal-roadmap-frontend .
docker run -p 3000:3000 goal-roadmap-frontend
```

## 테스트

```bash
# 프론트엔드
cd frontend && npm test

# 백엔드
cd backend && source .venv/bin/activate && pytest
```

## 문서

- API 명세서: [`docs/API.md`](docs/API.md)
- 설계 문서: `docs/superpowers/specs/`
- 구현 계획(태스크별 작업 내역): `docs/superpowers/plans/`
