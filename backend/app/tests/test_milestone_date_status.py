from datetime import datetime, timezone as dt_timezone
from types import SimpleNamespace

from django.test import SimpleTestCase

from app.services.batch_progress import compute_milestone_status


class MilestoneDateStatusTests(SimpleTestCase):
    @staticmethod
    def milestone(start, end):
        batch = SimpleNamespace(is_closed=False, current_stage="PHASE_1_SETUP")
        return SimpleNamespace(
            batch=batch,
            stage_number=1,
            start_date=start,
            end_date=end,
        )

    def test_start_date_is_active_before_configured_eight_am(self):
        milestone = self.milestone(
            datetime(2026, 11, 27, 1, 0, tzinfo=dt_timezone.utc),  # 08:00 VN
            datetime(2026, 12, 6, 16, 59, tzinfo=dt_timezone.utc),
        )

        now = datetime(2026, 11, 26, 17, 30, tzinfo=dt_timezone.utc)  # 00:30 27/11 VN

        self.assertEqual(compute_milestone_status(milestone, now=now), "ACTIVE")

    def test_end_date_remains_active_for_whole_vietnam_day(self):
        milestone = self.milestone(
            datetime(2026, 11, 27, 1, 0, tzinfo=dt_timezone.utc),
            datetime(2026, 12, 6, 16, 59, tzinfo=dt_timezone.utc),
        )

        now = datetime(2026, 12, 6, 16, 59, 59, tzinfo=dt_timezone.utc)

        self.assertEqual(compute_milestone_status(milestone, now=now), "ACTIVE")

    def test_future_vietnam_date_is_upcoming(self):
        milestone = self.milestone(
            datetime(2026, 11, 27, 1, 0, tzinfo=dt_timezone.utc),
            datetime(2026, 12, 6, 16, 59, tzinfo=dt_timezone.utc),
        )

        now = datetime(2026, 11, 26, 16, 59, tzinfo=dt_timezone.utc)  # 23:59 26/11 VN

        self.assertEqual(compute_milestone_status(milestone, now=now), "UPCOMING")
