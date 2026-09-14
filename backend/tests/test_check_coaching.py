from dataclasses import replace
from datetime import datetime

from app.check_coaching_select import (
    MilestoneForCoaching,
    build_coaching_prompt,
    select_overdue_milestones,
)

BASE = MilestoneForCoaching(
    id="m1", roadmap_id="r1", user_id="u1", title="5km 완주", due_date="2026-01-01", status="pending"
)


def test_selects_milestones_past_due_date_that_are_not_done():
    done = replace(BASE, id="m2", status="done")
    result = select_overdue_milestones([BASE, done], datetime(2026, 2, 1))
    assert result == [BASE]


def test_excludes_milestones_whose_due_date_is_still_in_the_future():
    future = replace(BASE, due_date="2027-01-01")
    result = select_overdue_milestones([future], datetime(2026, 2, 1))
    assert result == []


def test_build_coaching_prompt_includes_the_milestone_title():
    prompt = build_coaching_prompt(BASE)
    assert "5km 완주" in prompt
