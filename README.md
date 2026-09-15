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

`frontend/`와 `backend/`는 아직 각자 실행하며, 5주차에 도커 컨테이너로 분리해
묶을 예정이다.

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
