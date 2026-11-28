from datetime import datetime, timedelta, timezone
from pathlib import Path
import runpy
import unittest
from unittest.mock import Mock, patch

collector = runpy.run_path(str(Path(__file__).with_name("collect-public.py")))


class SharedAnalyticsTests(unittest.TestCase):
    def test_monday_rolling_window_is_not_queried_again(self):
        from calendar_periods import calendar_windows
        now = datetime(2026, 11, 30, 1, 15, tzinfo=timezone.utc)
        seen = now - timedelta(minutes=15)
        periods = {kind: [] for kind in ("day", "week", "month")}
        row = {"scope": "blog", "status": "ok", "periodStart": "2026-11-23", "periodEnd": "2026-11-29",
               "observedAt": seen.isoformat(), "values": {"sessions": 0, "newUsers": 0}, "timeZone": "Asia/Seoul"}
        for window in calendar_windows(now.date()):
            if window["periodStart"] == row["periodStart"] and window["periodEnd"] == row["periodEnd"]:
                continue
            periods[window["kind"]].append({key: value for key, value in {**window,
                "observedAt": seen.isoformat(), "timeZone": "Asia/Seoul", "values": row["values"]}.items() if key != "kind"})
        token = Mock(side_effect=AssertionError("unexpected GA4 request"))
        with patch.dict(collector["api"], ga4_token=token):
            collector["add_ga4_periods"]([row], {"rows": [{"scope": "blog", "periods": periods}]}, {"blog": "1"}, now)
        self.assertEqual(row["periodStatus"], "ok")
        self.assertEqual(row["periods"]["week"][-1]["observedAt"], seen.isoformat())
        token.assert_not_called()
