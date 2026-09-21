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

### docker-compose (전체 스택)

`docker-compose.yml`이 저장소 루트에 있고 `backend`, `frontend` 두 서비스를 함께 띄운다.
`NEXT_PUBLIC_*` 빌드 인자 보간에 `frontend/.env.local` 값을 쓰므로 `--env-file`을 지정한다.

```bash
docker compose --env-file frontend/.env.local up --build
# 종료: docker compose --env-file frontend/.env.local down
```

컨테이너 간 네트워킹은 개별 `docker run`과 다르다 — 두 서비스가 같은 compose
네트워크에 있어서 서로를 서비스 이름(`backend`)으로 부를 수 있고, 로컬 Supabase는
여전히 컨테이너 바깥(호스트)에 떠 있다. 그래서 `docker-compose.yml`이
`backend/.env` / `frontend/.env.local`의 일부 값을 `environment:`로 오버라이드한다:

| 변수 | `.env` 값 (로컬/비-Docker 개발용) | compose 오버라이드 | 이유 |
|---|---|---|---|
| `SUPABASE_URL` (backend) | `http://127.0.0.1:54321` | `http://host.docker.internal:54321` | 컨테이너 안의 `127.0.0.1`은 컨테이너 자신을 가리킴 |
| `BACKEND_URL` (frontend, server-side) | `http://localhost:8000` | `http://backend:8000` | `/api/check-coaching`이 frontend 컨테이너 안에서 실행되므로 자기 자신이 아니라 backend 서비스를 가리켜야 함 |
| `NEXT_PUBLIC_*` | 그대로 사용 | (오버라이드 없음) | 브라우저(호스트)에서 직접 실행되는 코드라 `localhost`/`127.0.0.1`로도 문제없음 |

backend의 `./backend/data`를 `/app/data`로 바인드 마운트해뒀다 — 지금은 SQLite를
쓰지 않아 아무것도 쓰지 않지만, 나중에 로컬 파일 DB를 추가하면 `docker compose down`
후 재생성해도 데이터가 남도록 이 경로 밑에 두면 된다. 실제 앱 데이터(로드맵,
커뮤니티 게시물 등)는 이 볼륨과 무관하게 로컬 Supabase(호스트에서 별도로 띄운
Postgres 컨테이너들)에 저장되고, 거기서 자체 볼륨으로 영속된다.

**배포 확인 체크리스트**

- [ ] **환경변수**: `backend/.env`, `frontend/.env.local`이 실제 값으로 채워져 있는가 (`*.env.example` 기준으로 diff)
- [ ] **환경변수(컨테이너 간)**: `SUPABASE_URL`(backend), `BACKEND_URL`(frontend)이 위 표대로 compose 안에서 오버라이드됐는가 — `docker compose exec backend printenv SUPABASE_URL` / `docker compose exec frontend printenv BACKEND_URL`로 확인
- [ ] **포트**: 8000(backend), 3000(frontend)이 호스트에서 이미 사용 중이 아닌가 (`lsof -i :8000`, `lsof -i :3000`)
- [ ] **로컬 Supabase 기동 여부**: `docker ps --filter name=supabase`로 전체 스택(db/auth/rest/storage 등)이 healthy인지 확인 — 안 떠 있으면 backend/frontend가 죽지 않아도 데이터 관련 기능이 전부 실패한다
- [ ] **볼륨**: `./backend/data:/app/data`가 마운트됐는가 (`docker compose config`에서 `volumes` 확인). 앱이 실제로 이 경로에 파일을 쓰는 기능을 추가했다면 `docker compose down && up`으로 파일이 남는지 재확인
- [ ] **데이터 영속성(Supabase 쪽)**: 컨테이너를 내렸다 올려도 Supabase에 저장된 데이터(로드맵/커뮤니티 게시물 등)가 남아있는가 — 이건 우리 볼륨이 아니라 Supabase 자체 컨테이너의 영속성이므로 별도로 확인 필요
- [ ] **컨테이너 간 통신**: frontend → backend(`http://backend:8000`), backend → Supabase(`http://host.docker.internal:54321`) 둘 다 실제로 붙는지 `docker compose exec`로 직접 호출해 확인
- [ ] **헬스체크**: `curl localhost:8000/docs` (200), `curl localhost:3000/` (200)
- [ ] **브라우저 동작**: 로그인/회원가입, 로드맵 생성, 커뮤니티 피드 조회가 실제 브라우저에서 에러 없이 동작하는가

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
