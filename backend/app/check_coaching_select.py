from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class MilestoneForCoaching:
    id: str
    roadmap_id: str
    user_id: str
    title: str
    due_date: str
    status: str


def select_overdue_milestones(
    milestones: list[MilestoneForCoaching], now: datetime
) -> list[MilestoneForCoaching]:
    return [m for m in milestones if m.status != "done" and datetime.fromisoformat(m.due_date) < now]


def build_coaching_prompt(milestone: MilestoneForCoaching) -> str:
    return (
        f'사용자가 "{milestone.title}" 마일스톤의 마감일을 놓쳤어. 비난하지 않는 '
        "따뜻한 톤으로, 2문장 이내의 격려 메시지를 만들어줘. 메시지 텍스트만 응답해."
    )
