from dataclasses import replace
from datetime import datetime

from app.check_coaching_select import (
    MilestoneForCoaching,
    RoadmapForStatusCoaching,
    build_coaching_prompt,
    build_status_prompt,
    select_overdue_milestones,
    select_roadmaps_for_status_coaching,
)

BASE = MilestoneForCoaching(
    id="m1", roadmap_id="r1", user_id="u1", title="5km 완주", due_date="2026-01-01", status="pending"
)

ROADMAP = RoadmapForStatusCoaching(
    id="r1",
    user_id="u1",
    title="10km 마라톤 완주하기",
    done_count=1,
    total_count=4,
    next_milestone_title="5km 완주",
    next_due_date="2026-03-01",
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


def test_selects_roadmaps_not_already_covered_by_an_overdue_message():
    covered = replace(ROADMAP, id="r2")
    result = select_roadmaps_for_status_coaching([ROADMAP, covered], overdue_roadmap_ids={"r2"})
    assert result == [ROADMAP]


def test_build_status_prompt_includes_progress_and_next_milestone():
    prompt = build_status_prompt(ROADMAP)
    assert "10km 마라톤 완주하기" in prompt
    assert "1" in prompt and "4" in prompt
    assert "5km 완주" in prompt


def test_build_status_prompt_handles_roadmap_with_no_remaining_milestones():
    finished = replace(ROADMAP, done_count=4, next_milestone_title=None, next_due_date=None)
    prompt = build_status_prompt(finished)
    assert "10km 마라톤 완주하기" in prompt
