from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date

MAX_MILESTONES = 20

# Gemini는 "다른 설명 텍스트는 포함하지 마"라고 프롬프트에 지시해도 응답을
# ```json ... ``` (또는 태그 없는 ``` ... ```) 코드 펜스로 감싸는 경우가 실제
# 호출로 확인될 만큼 흔하다 - 모델 입장에서는 펜스가 "설명 텍스트"가 아니라
# 포맷팅이라 지시를 어긴 게 아니다. json.loads 이전에 벗겨낸다.
_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```$", re.DOTALL)


def _strip_code_fence(raw_text: str) -> str:
    match = _CODE_FENCE_RE.match(raw_text.strip())
    return match.group(1) if match else raw_text


@dataclass
class ParsedMilestone:
    title: str
    due_date: str
    order_index: int


def parse_roadmap_response(raw_text: str) -> list[ParsedMilestone]:
    try:
        data = json.loads(_strip_code_fence(raw_text))
    except json.JSONDecodeError as exc:
        raise ValueError("AI response was not valid JSON") from exc
    if not isinstance(data, list):
        raise ValueError("AI response must be a JSON array of milestones")
    if len(data) == 0:
        raise ValueError("AI response must contain at least one milestone")
    if len(data) > MAX_MILESTONES:
        raise ValueError(f"AI response has too many milestones (max {MAX_MILESTONES})")

    without_order: list[dict] = []
    for index, item in enumerate(data):
        title = item.get("title") if isinstance(item, dict) else None
        due_date = item.get("due_date") if isinstance(item, dict) else None
        if not isinstance(title, str) or not isinstance(due_date, str):
            raise ValueError(f"Milestone at index {index} is missing title or due_date")
        try:
            date.fromisoformat(due_date)
        except ValueError as exc:
            raise ValueError(f"Milestone at index {index} has a due_date that is not a valid date") from exc
        without_order.append({"title": title, "due_date": due_date})

    # 모델이 마일스톤을 항상 날짜순으로 돌려준다는 보장이 없어서, order_index를
    # 매기기 전에 due_date로 먼저 정렬한다 — 응답 순서가 뒤섞여도 타임라인은
    # 항상 날짜순으로 보이게 하기 위함.
    without_order.sort(key=lambda m: m["due_date"])
    return [
        ParsedMilestone(title=m["title"], due_date=m["due_date"], order_index=i)
        for i, m in enumerate(without_order)
    ]
