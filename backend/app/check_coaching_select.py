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


@dataclass
class RoadmapForStatusCoaching:
    id: str
    user_id: str
    title: str
    done_count: int
    total_count: int
    next_milestone_title: str | None
    next_due_date: str | None


def select_roadmaps_for_status_coaching(
    roadmaps: list[RoadmapForStatusCoaching], overdue_roadmap_ids: set[str]
) -> list[RoadmapForStatusCoaching]:
    # 같은 실행에서 이미 지연(delay) 코칭을 받은 로드맵까지 상태 코칭으로 또
    # 찌르면 "지금 확인하기" 한 번에 같은 로드맵 메시지가 두 개 생긴다.
    return [r for r in roadmaps if r.id not in overdue_roadmap_ids]


def build_status_prompt(roadmap: RoadmapForStatusCoaching) -> str:
    progress = f'"{roadmap.title}" 로드맵은 마일스톤 {roadmap.total_count}개 중 {roadmap.done_count}개를 완료했어.'
    if roadmap.next_milestone_title:
        progress += f' 다음 마일스톤은 "{roadmap.next_milestone_title}"이고 마감일은 {roadmap.next_due_date}야.'
    else:
        progress += " 남은 마일스톤은 없어."
    return (
        f"{progress} 아직 마감을 놓친 건 없어. 지금까지의 진행 상황을 짚어주면서 "
        "다음에 뭘 하면 좋을지 2문장 이내로 가볍게 격려해줘. 메시지 텍스트만 응답해."
    )
