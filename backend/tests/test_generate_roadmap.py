import json

import pytest

from app.generate_roadmap_parse import parse_roadmap_response


def test_parses_a_valid_json_array_of_milestones():
    raw = '[{"title": "1km 완주", "due_date": "2026-10-01"}, {"title": "3km 완주", "due_date": "2026-10-15"}]'
    result = parse_roadmap_response(raw)
    assert [(m.title, m.due_date, m.order_index) for m in result] == [
        ("1km 완주", "2026-10-01", 0),
        ("3km 완주", "2026-10-15", 1),
    ]


def test_raises_when_the_response_is_not_valid_json():
    with pytest.raises(ValueError, match="valid JSON"):
        parse_roadmap_response("not json")


def test_raises_when_a_milestone_is_missing_due_date():
    with pytest.raises(ValueError, match="missing title or due_date"):
        parse_roadmap_response('[{"title": "only title"}]')


def test_sorts_milestones_by_due_date_before_assigning_order_index():
    raw = '[{"title": "3km 완주", "due_date": "2026-10-15"}, {"title": "1km 완주", "due_date": "2026-10-01"}]'
    result = parse_roadmap_response(raw)
    assert [(m.title, m.due_date, m.order_index) for m in result] == [
        ("1km 완주", "2026-10-01", 0),
        ("3km 완주", "2026-10-15", 1),
    ]


def test_raises_when_the_response_is_an_empty_array():
    with pytest.raises(ValueError, match="at least one milestone"):
        parse_roadmap_response("[]")


def test_raises_when_a_due_date_is_not_a_real_iso_date():
    with pytest.raises(ValueError, match="not a valid date"):
        parse_roadmap_response('[{"title": "1km 완주", "due_date": "다음 주"}]')


def test_raises_when_there_are_too_many_milestones():
    raw = json.dumps([{"title": f"마일스톤 {i}", "due_date": "2026-10-01"} for i in range(21)])
    with pytest.raises(ValueError, match="too many milestones"):
        parse_roadmap_response(raw)


def test_parses_a_response_wrapped_in_a_markdown_json_code_fence():
    # Gemini는 "다른 설명 텍스트는 포함하지 마"라고 지시해도 ```json ... ``` 코드
    # 펜스로 감싸서 응답하는 경우가 실제로 흔하다(실제 API 호출로 확인됨).
    raw = '```json\n[{"title": "1km 완주", "due_date": "2026-10-01"}]\n```'
    result = parse_roadmap_response(raw)
    assert [(m.title, m.due_date) for m in result] == [("1km 완주", "2026-10-01")]


def test_parses_a_response_wrapped_in_a_bare_code_fence_without_the_json_tag():
    raw = '```\n[{"title": "1km 완주", "due_date": "2026-10-01"}]\n```'
    result = parse_roadmap_response(raw)
    assert [(m.title, m.due_date) for m in result] == [("1km 완주", "2026-10-01")]
