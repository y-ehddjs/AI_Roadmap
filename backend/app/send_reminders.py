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
