from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


def is_reminder_due(reminder_time: str, now: datetime, window_minutes: int) -> bool:
    hours, minutes = (int(part) for part in reminder_time.split(":"))
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
