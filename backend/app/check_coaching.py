from __future__ import annotations

import json
import logging
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
logger = logging.getLogger(__name__)


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

    async with httpx.AsyncClient(timeout=30.0) as client:
        for milestone in overdue:
            try:
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
                # Gemini가 안전 필터 등으로 응답을 막으면 "candidates" 키는 있되 빈
                # 리스트로 온다 - `.get("candidates", [{}])`는 키가 "존재"할 때는
                # 기본값을 안 쓰므로 `[][0]`에서 그대로 IndexError가 난다.
                candidates = ai_json.get("candidates") or [{}]
                message = (
                    candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
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
            except Exception:
                # 이 마일스톤 하나가 실패했다고 나머지 지연 마일스톤 전체를
                # 건너뛰면 안 된다 - 로그만 남기고 다음 마일스톤으로 계속 진행한다.
                logger.exception("check-coaching failed for milestone %s", milestone.id)
                continue

    return len(overdue)
