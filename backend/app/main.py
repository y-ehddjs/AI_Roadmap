import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/check-coaching")
async def trigger_check_coaching() -> dict[str, int]:
    processed = await run_check_coaching()
    return {"processed": processed}


@app.post("/internal/send-reminders")
async def trigger_send_reminders() -> dict[str, int]:
    sent = await run_send_reminders()
    return {"sent": sent}
