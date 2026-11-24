import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
import unittest
from unittest.mock import patch

from calendar_periods import calendar_windows, merge_periods, requested_periods

spec = importlib.util.spec_from_file_location("collector", Path(__file__).with_name("collect-analytics.py"))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CalendarTests(unittest.TestCase):
    now = datetime(2024, 3, 1, 0, 30, tzinfo=timezone.utc)

    def test_complete_calendar_windows_across_leap_month_and_week(self):
        windows = calendar_windows(self.now.date())
        by_kind = {k: [w for w in windows if w["kind"] == k] for k in ("day", "week", "month")}
        self.assertEqual([len(group) for group in by_kind.values()], [7, 4, 2])
        self.assertEqual(by_kind["day"][-1]["periodStart"], "2024-02-29")
        self.assertEqual((by_kind["week"][-1]["periodStart"], by_kind["week"][-1]["periodEnd"]),
                         ("2024-02-19", "2024-02-25"))
        self.assertEqual((by_kind["month"][-1]["periodStart"], by_kind["month"][-1]["periodEnd"]),
                         ("2024-02-01", "2024-02-29"))

    def test_reuse_cached_measurements_and_retry_late_data(self):
        windows = requested_periods("ga4", {}, self.now)
        day = next(w for w in windows if w["kind"] == "day" and w["periodEnd"] == "2024-02-28")
        p = {k:v for k,v in day.items() if k != "kind"}
        p.update(timeZone="Asia/Seoul", observedAt=self.now.isoformat(), values={"newUsers": 0, "sessions": 8})
        saved, complete = merge_periods("ga4", {}, {"day": [p]}, self.now)
        self.assertFalse(complete)
        self.assertEqual(saved["day"], [p])
        self.assertNotIn(day, requested_periods("ga4", saved, self.now))
        self.assertIn(day, requested_periods("ga4", saved, self.now + timedelta(hours=21)))
        self.assertEqual(merge_periods("ga4", saved, {}, self.now)[0]["day"], [p])
        with self.assertRaises(ValueError):
            merge_periods("ga4", {}, {"day": [{**p, "timeZone": "UTC"}]}, self.now)

    def test_posthog_uniques_are_queried_for_each_complete_range(self):
        windows = [w for w in calendar_windows(self.now.date()) if w["kind"] == "week"][-2:]
        with patch.object(collector, "request", return_value={"results": [[8, 10, 22, 6, 20, 44]]}) as request:
            rows = collector.posthog_period_batch({"project": "42", "app_id": "demo"}, "stub", [], windows)
            query = request.call_args.args[2]["query"]["query"]
            self.assertEqual(query.count("uniqIf("), 2)
            self.assertIn("toDateTime(1707663600)", query)  # Feb 12, 00:00 KST
            self.assertIn("properties.app_id = 'demo'", query)
            self.assertIn("!= 'synthetic'", query)
            self.assertEqual([r["sessions"] for r in rows], [8,6])

    def test_ga4_batches_use_explicit_source_dates_and_distinguish_missing(self):
        w = calendar_windows(self.now.date())[:2]
        headers = {"metadata": {"timeZone":"Asia/Seoul"}, "metricHeaders":[{"name":"newUsers"},{"name":"sessions"}]}
        reports = [headers, {**headers, "rows":[{"metricValues":[{"value":"0"},{"value":"3"}]}]}]
        with patch.object(collector, "request", return_value={"reports": reports}) as request:
            values = collector.ga4_period_batch("42", "stub", w)
            self.assertEqual(values,[{"newUsers":None,"sessions":None},{"newUsers":0,"sessions":3}])
            self.assertEqual(request.call_args.args[2]["requests"][0]["dateRanges"][0],
                             {"startDate":w[0]["periodStart"],"endDate":w[0]["periodEnd"]})


if __name__ == "__main__":
    unittest.main()
