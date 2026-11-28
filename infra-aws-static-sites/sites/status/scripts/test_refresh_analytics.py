from datetime import datetime, timedelta, timezone
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

spec = spec_from_file_location("refresh", Path(__file__).with_name("refresh-analytics.py"))
refresh = module_from_spec(spec)
spec.loader.exec_module(refresh)


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.start = datetime.now(timezone.utc) - timedelta(seconds=2)
        self.row = {"scope": "a", "status": "ok", "observedAt": datetime.now(timezone.utc).isoformat(),
                    "values": {"newUsers": 0, "sessions": 4}}
        self.feed = {"schemaVersion": 1, "source": "ga4", "observedAt": self.row["observedAt"],
                     "rows": [self.row, {"scope": "b", "status": "unavailable"}]}
        self.old = {"rows": [{"scope": "b", "status": "ok", "observedAt": "2026-01-01T00:00:00Z",
                              "values": {"newUsers": 8, "sessions": 13}}]}
        self.inventory = {"ga4": {"a": "1", "b": "2"}}

    def test_scheduled_refresh_does_not_query_gmail(self):
        with TemporaryDirectory() as tmp, patch.object(Path, "home", return_value=Path(tmp)), \
             patch.object(refresh.sys, "argv", ["refresh-analytics.py"]), \
             patch.object(refresh, "s3_client"), patch.object(refresh, "log"), \
             patch.object(refresh, "collect_support") as gmail, patch.object(refresh, "refresh", return_value=True) as public:
            self.assertEqual(refresh.main(), 0)
            gmail.assert_not_called()
            self.assertEqual(public.call_count, len(refresh.SOURCES))

    def test_daily_instagram_includes_private_snapshot_and_ga4_private_is_opt_in(self):
        for source, flag in (("ga4", b"const collectPrivateEngagement = true;"),
                             ("instagram", b"const collectPrivateInstagram = true;")):
            for legacy in (False, True):
                with self.subTest(source=source, legacy=legacy), patch.object(refresh.subprocess, "run") as run:
                    run.return_value.stdout = b'{"rows":[]}'
                    refresh.collect(source, {}, legacy)
                    code = run.call_args.kwargs["input"]
                    self.assertEqual(flag in code, source == "instagram" or legacy)

    def merged(self):
        return refresh.merge("ga4", self.feed, self.old, self.inventory, self.start)

    def test_exporter_cache_preserves_observation_and_rejects_stale_or_partial_snapshots(self):
        from calendar_periods import calendar_windows
        from zoneinfo import ZoneInfo
        self.start = (datetime.now(timezone.utc) - timedelta(days=1)).replace(hour=3, minute=30, second=0, microsecond=0)
        observed = self.start - timedelta(minutes=10)
        clock = patch.object(refresh, "datetime", wraps=datetime)
        mocked = clock.start()
        self.addCleanup(clock.stop)
        mocked.now.return_value = self.start
        periods = {"day": [], "week": [], "month": []}
        values = {"events": 14, "sessions": 0, "pageviews": 0}
        for window in calendar_windows(observed.astimezone(ZoneInfo("Asia/Seoul")).date()):
            kind = window.pop("kind")
            periods[kind].append({**window, "timeZone": "Asia/Seoul", "values": values,
                                  "observedAt": observed.isoformat(), "eventsWithSessionId": 0})
        today = self.start.date()
        row = {"scope": "a", "values": values, "eventsWithSessionId": 0, "timeZone": "UTC",
               "observedAt": observed.isoformat(), "status": "ok", "periods": periods,
               "periodStart": (today - timedelta(days=7)).isoformat(),
               "periodEnd": (today - timedelta(days=1)).isoformat()}
        result = {"schemaVersion": 1, "source": "posthog", "rows": [row], "observedAt": row["observedAt"]}
        args = ("posthog", result, {}, {"posthog": {"a": {}}}, self.start)
        feed, complete = refresh.merge(*args)
        self.assertTrue(complete)
        self.assertEqual(feed["rows"][0]["observedAt"], observed.isoformat())
        for change in ({"eventsWithSessionId": 15}, {"periods": {}},
                       {"observedAt": (observed - timedelta(hours=1)).isoformat()}):
            with self.subTest(change=change), patch.dict(row, change), self.assertRaises(ValueError):
                refresh.merge(*args)

    def test_private_engagement_isolated_and_zero_session_is_undefined(self):
        self.row["avgSessionEngagementSeconds"] = 0
        self.row["instagramAcquisition"] = {"sessions": 2, "newUsers": 0}
        self.row["channelSessions"] = {"Direct": 3, "Referral": 1}
        self.feed["rows"][1].update(status="ok", observedAt=self.row["observedAt"],
                                    values={"newUsers": 0, "sessions": 0}, channelSessions={},
                                    instagramAcquisition={"newUsers": 0, "sessions": 0})
        private, complete = refresh.split_engagement(self.feed)
        self.assertTrue(complete)
        self.assertEqual(private["rows"][0]["seconds"], 0)
        self.assertEqual(private["rows"][0]["channelSessions"]["Referral"], 1)
        self.assertEqual(private["rows"][1]["status"], "no_sessions")
        self.assertNotIn("seconds", private["rows"][1])
        public, _ = self.merged()
        self.assertNotIn("engagement", str(public).lower())
        self.assertNotIn("channelSessions", str(public))
        self.assertNotIn("instagramAcquisition", str(public))
        self.assertEqual(private["rows"][0]["instagramAcquisition"], {"sessions": 2, "newUsers": 0})
        private, complete = refresh.split_engagement(self.feed)
        self.assertFalse(complete)
        self.assertEqual(private["rows"][0]["status"], "unavailable")

    def test_instagram_breakdowns_remain_independent_and_partial_is_flagged(self):
        self.row.update(avgSessionEngagementSeconds=0, channelSessions={"Direct": 4},
                        instagramAcquisition={"sessions": 2, "newUsers": 3})
        self.feed["rows"][1]["instagramAcquisition"] = {"newUsers": 0, "sessions": 5}
        report, complete = refresh.split_engagement(self.feed)
        self.assertFalse(complete)
        self.assertEqual(report["rows"][0]["instagramAcquisition"], {"sessions": 2})
        self.assertEqual(report["rows"][1]["instagramAcquisition"], {"sessions": 5, "newUsers": 0})

    def test_private_instagram_records_only_verified_account_measures(self):
        collected = {"privateAccounts": [
            {"scope": "minimal_collector", "status": "ok", "observedAt": self.start.isoformat(),
             "values": {"views": 0, "viewers": 0}},
            {"scope": "every.policy", "status": "unavailable", "values": {"views": 8}},
        ]}
        report = refresh.private_instagram(collected, self.start)
        self.assertNotIn("privateAccounts", collected)
        self.assertEqual(report["rows"][0]["values"], {"views": 0, "viewers": 0})
        self.assertEqual(report["rows"][1], {"scope": "every.policy", "status": "unavailable"})

    def test_partial_failure_preserves_observation(self):
        result, complete = self.merged()
        self.assertFalse(complete)
        self.assertEqual(result["rows"][1], {**self.old["rows"][0], "status": "unavailable", "history": []})
        self.assertEqual(result["rows"][0]["values"]["newUsers"], 0)

    def test_merge_preserves_recent_observations_and_real_zero_on_failure(self):
        old_time = (self.start - timedelta(hours=2)).isoformat()
        self.old["rows"] = [{**self.row, "observedAt": old_time, "periodLabel": "previous week"},
                            {**self.row, "scope": "b", "observedAt": old_time}]
        feed, _ = self.merged()
        a, b = feed["rows"]
        self.assertEqual([p["observedAt"] for p in a["history"]], [old_time, self.row["observedAt"]])
        self.assertEqual(a["history"][0]["periodLabel"], "previous week")
        self.assertEqual(b["history"], [{"observedAt": old_time, "values": self.row["values"]}])
        self.assertEqual(b["status"], "unavailable")

    def test_backfill_preserves_current_reading_and_uses_period_time_for_retention(self):
        now = datetime(2026, 11, 24, 12, tzinfo=timezone.utc)
        observed = now.isoformat()
        def backfilled(days, hour):
            when = (now - timedelta(days=days)).replace(hour=hour)
            return {"observedAt": observed, "sampleAt": when.isoformat(),
                    "values": {"newUsers": None, "sessions": 0}, "periodEnd": when.date().isoformat()}
        points = [backfilled(32, 1), backfilled(5, 1), backfilled(5, 2), backfilled(1, 18)]
        current = {"scope": "a", "values": {"newUsers": 8, "sessions": 10}, "observedAt": observed}
        feed = {"schemaVersion": 1, "source": "ga4", "rows": [current]}
        seed = {**feed, "rows": [{"scope": "a", "history": points}]}
        result = refresh.attach_history("ga4", feed, {}, seed, now)
        row = result["rows"][0]
        self.assertEqual(row["values"], current["values"])
        self.assertEqual(row["history"], [points[2], points[3], {"values": current["values"], "observedAt": observed}])
        self.assertEqual(refresh.attach_history("ga4", result, result, seed, now), result)
        with self.assertRaises(ValueError):
            refresh.attach_history("ga4", feed, {}, {**seed, "source": "instagram"}, now)

    def test_total_failure_does_not_publish(self):
        self.row["status"] = "unavailable"
        with self.assertRaises(ValueError):
            self.merged()

    def test_rejects_duplicate_scopes_invalid_metrics_and_stale_timestamp(self):
        for invalid in ({"scope": "b"}, {"values": {"newUsers": -1, "sessions": 0}},
                        {"observedAt": "2020-01-01T00:00:00Z"}, {"email": "unexpected"}):
            with self.subTest(invalid=invalid), patch.dict(self.row, invalid), self.assertRaises(ValueError):
                self.merged()

    def test_default_credential_fields_only_in_legacy_file(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp, "credentials")
            path.write_text("[default]\naws_access_key_id=a\naws_secret_access_key=b\nignored line\n"
                            "[other]\naws_access_key_id=c\naws_secret_access_key=d\n")
            self.assertEqual(refresh.aws_credentials(path), {"aws_access_key_id": "a", "aws_secret_access_key": "b"})


if __name__ == "__main__":
    unittest.main()
