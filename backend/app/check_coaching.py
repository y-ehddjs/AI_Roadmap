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
    RoadmapForStatusCoaching,
    build_coaching_prompt,
    build_status_prompt,
    select_overdue_milestones,
    select_roadmaps_for_status_coaching,
)

GEMINI_MODEL = "gemini-2.5-flash"
logger = logging.getLogger(__name__)


async def _send_coaching_message(
    *,
    client: httpx.AsyncClient,
    supabase,
    gemini_api_key: str,
    vapid_private_key: str,
    vapid_subject: str,
    user_id: str,
    roadmap_id: str,
    trigger_type: str,
    prompt: str,
    fallback_message: str,
) -> None:
    ai_response = await client.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        params={"key": gemini_api_key},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            # generate_roadmap.py와 같은 이유로 확장 사고를 끈다 - 256
            # 토큰 예산으로는 "생각" 토큰만으로도 다 소진되어 실제 코칭
            # 메시지가 매번 빈 텍스트(기본 문구로 대체)가 되기 쉽다.
            "generationConfig": {"maxOutputTokens": 256, "thinkingConfig": {"thinkingBudget": 0}},
        },
    )
    if ai_response.status_code != 200:
        return
    ai_json = ai_response.json()
    # Gemini가 안전 필터 등으로 응답을 막으면 "candidates" 키는 있되 빈
    # 리스트로 온다 - `.get("candidates", [{}])`는 키가 "존재"할 때는
    # 기본값을 안 쓰므로 `[][0]`에서 그대로 IndexError가 난다.
    candidates = ai_json.get("candidates") or [{}]
    message = candidates[0].get("content", {}).get("parts", [{}])[0].get("text") or fallback_message

    supabase.table("coaching_messages").insert(
        {
            "user_id": user_id,
            "roadmap_id": roadmap_id,
            "trigger_type": trigger_type,
            "message": message,
        }
    ).execute()

    settings_rows = (
        supabase.table("notification_settings")
        .select("reminder_enabled, push_subscription")
        .eq("user_id", user_id)
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


async def run_check_coaching(manual: bool = False) -> int:
    gemini_api_key = os.environ["GEMINI_API_KEY"]
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    vapid_private_key = os.environ["VAPID_PRIVATE_KEY"]
    vapid_subject = os.environ["VAPID_SUBJECT"]

    supabase = create_client(supabase_url, supabase_service_role_key)

    milestone_rows = (
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
        for row in milestone_rows
    ]

    overdue = select_overdue_milestones(normalized, datetime.now())
    processed = 0

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

                await _send_coaching_message(
                    client=client,
                    supabase=supabase,
                    gemini_api_key=gemini_api_key,
                    vapid_private_key=vapid_private_key,
                    vapid_subject=vapid_subject,
                    user_id=milestone.user_id,
                    roadmap_id=milestone.roadmap_id,
                    trigger_type="delay",
                    prompt=build_coaching_prompt(milestone),
                    fallback_message="마일스톤 마감일이 지났어요. 다시 시작해볼까요?",
                )
                processed += 1
            except Exception:
                # 이 마일스톤 하나가 실패했다고 나머지 지연 마일스톤 전체를
                # 건너뛰면 안 된다 - 로그만 남기고 다음 마일스톤으로 계속 진행한다.
                logger.exception("check-coaching failed for milestone %s", milestone.id)
                continue

        if manual:
            # "지금 확인하기" 버튼(수동 호출)에서만: 마감을 놓친 게 없는 로드맵도
            # 그냥 조용히 끝내지 않고 현재 진행 상황 기반 코칭을 보낸다. 매일 9시
            # 스케줄러에서까지 이걸 돌리면 모든 active 로드맵에 매일 새벽 알림이
            # 쌓이므로, manual일 때만 실행한다.
            overdue_roadmap_ids = {m.roadmap_id for m in overdue}
            roadmap_rows = (
                supabase.table("roadmaps")
                .select("id, user_id, title, milestones(title, due_date, status)")
                .eq("status", "active")
                .execute()
            ).data

            status_candidates = []
            for row in roadmap_rows:
                milestones = row.get("milestones") or []
                if not milestones:
                    continue
                done = [m for m in milestones if m["status"] == "done"]
                remaining = sorted(
                    (m for m in milestones if m["status"] != "done"), key=lambda m: m["due_date"]
                )
                next_milestone = remaining[0] if remaining else None
                status_candidates.append(
                    RoadmapForStatusCoaching(
                        id=row["id"],
                        user_id=row["user_id"],
                        title=row["title"],
                        done_count=len(done),
                        total_count=len(milestones),
                        next_milestone_title=next_milestone["title"] if next_milestone else None,
                        next_due_date=next_milestone["due_date"] if next_milestone else None,
                    )
                )

            for roadmap in select_roadmaps_for_status_coaching(status_candidates, overdue_roadmap_ids):
                try:
                    await _send_coaching_message(
                        client=client,
                        supabase=supabase,
                        gemini_api_key=gemini_api_key,
                        vapid_private_key=vapid_private_key,
                        vapid_subject=vapid_subject,
                        user_id=roadmap.user_id,
                        roadmap_id=roadmap.id,
                        trigger_type="status",
                        prompt=build_status_prompt(roadmap),
                        fallback_message="지금까지 잘 하고 있어요. 계속 이어가볼까요?",
                    )
                    processed += 1
                except Exception:
                    logger.exception("status check-coaching failed for roadmap %s", roadmap.id)
                    continue

    return processed
