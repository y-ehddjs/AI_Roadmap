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
