from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass
class ParsedMilestone:
    title: str
    due_date: str
    order_index: int


def parse_roadmap_response(raw_text: str) -> list[ParsedMilestone]:
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("AI response was not valid JSON") from exc
    if not isinstance(data, list):
        raise ValueError("AI response must be a JSON array of milestones")

    without_order: list[dict] = []
    for index, item in enumerate(data):
        title = item.get("title") if isinstance(item, dict) else None
        due_date = item.get("due_date") if isinstance(item, dict) else None
        if not isinstance(title, str) or not isinstance(due_date, str):
            raise ValueError(f"Milestone at index {index} is missing title or due_date")
        without_order.append({"title": title, "due_date": due_date})

    # 모델이 마일스톤을 항상 날짜순으로 돌려준다는 보장이 없어서, order_index를
    # 매기기 전에 due_date로 먼저 정렬한다 — 응답 순서가 뒤섞여도 타임라인은
    # 항상 날짜순으로 보이게 하기 위함.
    without_order.sort(key=lambda m: m["due_date"])
    return [
        ParsedMilestone(title=m["title"], due_date=m["due_date"], order_index=i)
        for i, m in enumerate(without_order)
    ]
