from datetime import datetime

from app.send_reminders_schedule import (
    MilestoneDueSoon,
    is_reminder_due,
    select_milestones_due_tomorrow,
)


def test_is_due_when_now_falls_inside_the_reminder_window():
    assert is_reminder_due("09:00", datetime(2026, 9, 7, 9, 5), 15) is True


def test_is_not_due_before_the_reminder_time():
    assert is_reminder_due("09:00", datetime(2026, 9, 7, 8, 59), 15) is False


def test_is_not_due_after_the_window_has_passed():
    assert is_reminder_due("09:00", datetime(2026, 9, 7, 9, 20), 15) is False


def test_is_due_with_seconds_included_as_postgrest_returns_time_columns():
    assert is_reminder_due("09:00:00", datetime(2026, 9, 7, 9, 5), 15) is True


def test_selects_a_milestone_whose_due_date_is_exactly_tomorrow():
    m = MilestoneDueSoon(id="m1", title="5km 완주", due_date="2026-09-08", status="pending")
    result = select_milestones_due_tomorrow([m], datetime(2026, 9, 7, 9, 0))
    assert result == [m]


def test_excludes_a_milestone_that_is_already_done():
    m = MilestoneDueSoon(id="m1", title="5km 완주", due_date="2026-09-08", status="done")
    result = select_milestones_due_tomorrow([m], datetime(2026, 9, 7, 9, 0))
    assert result == []


def test_excludes_a_milestone_due_further_out_than_tomorrow():
    m = MilestoneDueSoon(id="m1", title="5km 완주", due_date="2026-09-10", status="pending")
    result = select_milestones_due_tomorrow([m], datetime(2026, 9, 7, 9, 0))
    assert result == []
