import hmac
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .check_coaching import run_check_coaching
from .generate_roadmap import router as generate_roadmap_router
from .send_reminders import run_send_reminders

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(run_check_coaching, CronTrigger(hour=9, minute=0), id="check-coaching")
    scheduler.add_job(run_send_reminders, IntervalTrigger(minutes=15), id="send-reminders")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="goal-roadmap-app backend", lifespan=lifespan)

# 프론트엔드(Next.js)가 별도 도커 컨테이너에서 이 백엔드를 브라우저 fetch로
# 직접 호출하므로, Supabase Edge Function 때는 필요 없던 CORS 허용이 필요하다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_roadmap_router)


def require_internal_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    # 이 두 엔드포인트는 원래 스케줄러가 프로세스 내부에서만 부르는 것이라 인증이
    # 없었는데, 로컬 밖으로 배포되는 순간(README의 "5주차 도커 분리") 누구나 이
    # 경로를 때려 Gemini 호출/실제 Web Push 발송을 트리거할 수 있게 된다.
    # INTERNAL_API_SECRET 미설정도 실패로 처리해 "설정 깜빡함 = 무방비 공개"가
    # 되지 않게 한다.
    expected = os.environ.get("INTERNAL_API_SECRET")
    if not expected or not x_internal_secret or not hmac.compare_digest(x_internal_secret, expected):
        raise HTTPException(status_code=401, detail="missing or invalid X-Internal-Secret header")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/check-coaching", dependencies=[Depends(require_internal_secret)])
async def trigger_check_coaching() -> dict[str, int]:
    processed = await run_check_coaching(manual=True)
    return {"processed": processed}


@app.post("/internal/send-reminders", dependencies=[Depends(require_internal_secret)])
async def trigger_send_reminders() -> dict[str, int]:
    sent = await run_send_reminders()
    return {"sent": sent}
