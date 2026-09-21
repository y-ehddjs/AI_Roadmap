from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


def is_reminder_due(reminder_time: str, now: datetime, window_minutes: int) -> bool:
    # notification_settings.reminder_time은 Postgres `time` 컬럼이라 PostgREST가
    # 초까지 포함해 "HH:MM:SS"로 내려준다 ("HH:MM"만 저장한 적이 없어도). 앞
    # 두 조각(시, 분)만 쓰면 되므로 나머지는 버린다.
    hours, minutes = (int(part) for part in reminder_time.split(":")[:2])
    reminder_minutes_of_day = hours * 60 + minutes
    now_minutes_of_day = now.hour * 60 + now.minute
    return reminder_minutes_of_day <= now_minutes_of_day < reminder_minutes_of_day + window_minutes


@dataclass
class MilestoneDueSoon:
    id: str
    title: str
    due_date: str
    status: str


def select_milestones_due_tomorrow(
    milestones: list[MilestoneDueSoon], now: datetime
) -> list[MilestoneDueSoon]:
    tomorrow = (now.date() + timedelta(days=1)).isoformat()
    return [m for m in milestones if m.status != "done" and m.due_date == tomorrow]
